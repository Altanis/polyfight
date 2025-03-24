use axum::extract::{
    ws::{
        self,
        CloseFrame,
        Message,
        WebSocket,
    },
    State,
};
use bytes::{
    Bytes,
    BytesMut,
};
use futures_util::{
    stream::SplitSink,
    SinkExt,
    StreamExt,
};
use rand::Rng;
use skillratings::glicko2::Glicko2Rating;
use std::{
    borrow::{
        Borrow,
        BorrowMut,
    },
    net::{
        IpAddr,
        SocketAddr,
    },
    sync::{
        atomic::AtomicU32,
        Arc,
        Mutex,
        Weak,
    },
    time::Instant,
};
use strum::EnumCount;
use tokio::sync::Mutex as AsyncMutex;

use crate::{
    constrain,
    debug,
    error,
    game::{
        entity::{
            self,
            base_entity::{
                self,
                GenericEntity,
                GenericEntityHelpers,
            },
            components::entity_identity::{
                get_score_from_level,
                get_spectator_identity,
                EntityIdentity,
                EntityIdentityIds,
                TankCategories,
            },
            shape_entity::{
                ShapeEntity,
                ShapeType,
            },
            tank_entity::{
                PrivilegeLevel,
                TankEntity,
            },
        },
        server::{
            ArenaState,
            ClanInfo,
            GameMode,
            GameServer,
        },
    },
    normalise_angle,
    physics::vec2::Vec2,
    randi,
    seconds_to_ticks,
    server::{
        RankedRequest,
        Server,
        TankInfo,
        WebSocketServer,
    },
    utils::{
        self,
        config::{
            self,
            BUILD_ID,
        },
        stream::SwiftStream,
        timed_mutex::AsyncTimedLock,
    },
};

use super::{
    apis::UserData,
    packets::{
        self, form_notification_packet, ClanIncomingPacketType, ClientBound, CommandExecution, Inputs, ServerBound, UpgradeStats
    },
};

pub struct CloseReason(u16, String);

/// A struct representing a player connection.
#[derive(Clone, PartialEq, Debug)]
pub struct PlayerConnection
{
    /// The player's IP.
    pub ip: String,
    /// The player's hardware fingerprint.
    pub fingerprint: String,
    /// The player's UID.
    pub uid: String,
    /// The player's user data.
    pub user_data: Option<UserData>,
}

/// A struct which represents a WebSocket client.
pub struct WebSocketClient
{
    pub addr: SocketAddr,
    pub entity_id: Option<u32>,
    pub ws_id: isize,
    pub sender: Option<SplitSink<WebSocket, Message>>,
    pub server: Weak<AsyncMutex<Server>>,
    pub connection: PlayerConnection,
    /// The cipher the player agreed on.
    pub cipher: u32,
    /// Whether or not the initial packet was sent.
    pub initial_packet: bool,
    /// The game server the client belongs to.
    pub game_server: String,
    /// (should_close, should_ban)
    pub close: (bool, bool),
}

impl WebSocketClient
{
    pub fn new(
        addr: SocketAddr,
        server: Arc<AsyncMutex<Server>>,
        ws_id: isize,
        uid: String,
        user_data: Option<UserData>,
        ip: String,
        game_server: String,
    ) -> Self
    {
        WebSocketClient {
            addr,
            entity_id: None,
            ws_id,
            sender: None,
            server: Arc::downgrade(&server),
            connection: PlayerConnection {
                ip,
                fingerprint: String::new(),
                uid,
                user_data,
            },
            cipher: 0,
            initial_packet: false,
            game_server,
            close: (false, false),
        }
    }
}

pub async fn incoming_1v1_connection(
    stream: WebSocket,
    server: Arc<AsyncMutex<Server>>,
    uid: String,
)
{
    let (mut sender, mut receiver) = stream.split();

    let user_data: &Option<UserData> = &{
        let mut full_server = server.lock_with_timeout().await;

        if let Ok(Some(t)) = full_server.ws_server.db.read_user_by_id(&uid) {
            Some(t)
        } else {
            None
        }
    };

    if let Some(elo) = user_data {
        let mut full_server = server.lock_with_timeout().await;
        full_server
            .ws_server
            .ranked_clients
            .lock()
            .await
            .insert(uid.clone(), sender);
    } else {
        let _ = sender
            .send(Message::Close(Some(CloseFrame {
                code: 4000,
                reason: "You are either not logged in or not registered.".into(),
            })))
            .await;

        let mut full_server = server.lock_with_timeout().await;
        full_server.ws_server.ranked_requests.remove(&uid);
        return;
    }

    'block: while let Some(Ok(Message::Binary(bin))) = receiver.next().await {
        let mut full_server = server.lock_with_timeout().await;
        if full_server.ws_server.ranked_requests.contains_key(&uid) {
            continue 'block;
        }

        let mut tanks = [TankInfo {
            identity: EntityIdentityIds::Projectile,
            build: [0; UpgradeStats::COUNT],
        }; 6];

        let mut stream = SwiftStream::from_bytes(BytesMut::from(&bin[..]), 0);

        for i in 0..6 {
            if let Ok(identity) = stream.read_u8() {
                let identity_id: EntityIdentityIds = if let Ok(id) = identity.try_into() {
                    id
                } else {
                    continue 'block;
                };
                let identity: EntityIdentity = if let Ok(id) = identity_id.try_into() {
                    id
                } else {
                    continue 'block;
                };
                if identity.category == TankCategories::Illegal {
                    continue 'block;
                }

                let mut build = [0; UpgradeStats::COUNT];

                for j in 0..UpgradeStats::COUNT {
                    if let Ok(stat) = stream.read_u8() {
                        if stat > identity.max_stat_investments[j as usize] {
                            continue 'block;
                        } else {
                            build[j as usize] = stat;
                        }
                    } else {
                        continue 'block;
                    }
                }

                if build.iter().sum::<u8>() > 33 {
                    continue 'block;
                }

                tanks[i as usize] = TankInfo {
                    identity: identity_id,
                    build,
                };
            } else {
                continue 'block;
            }
        }

        full_server.ws_server.ranked_requests.insert(
            uid.clone(),
            RankedRequest {
                tanks,
                identity_idx: 0,
                score_1v1: 0,
                user_data: user_data.clone().unwrap(),
            },
        );
    }

    let mut full_server = server.lock_with_timeout().await;
    full_server.ws_server.ranked_requests.remove(&uid);
}

pub async fn incoming_scoring_connection(
    stream: WebSocket,
    server: Arc<AsyncMutex<Server>>,
    ws_id: isize,
    addr: SocketAddr,
    game_server_key: String,
    uid: String,
)
{
    debug!("A client has connected!");

    let (mut sender, mut receiver) = stream.split();
    let mut entity_id: Option<u32> = None;

    {
        let mut full_server = server.lock_with_timeout().await;
        let mut id = 0;

        if let Some(game_server) = full_server.game_servers.get_mut(&game_server_key) {
            id = game_server.add_player(None, ws_id, "".to_string(), String::new(), uid);
            if let GenericEntity::Tank(t) = &mut *game_server.entities[&id].borrow_mut() {
                t.base_entity.position = Vec2::new(
                    game_server.config.arena_size / 2.0,
                    game_server.config.arena_size / 2.0,
                );
                t.base_entity.alive = false;
                t.base_entity.identity = get_spectator_identity();
                t.fov = 2.0;
            }
        }

        let cipher: u32 = randi!(1, 4294967295);
        let _ = sender
            .send(Message::Binary(packets::form_cipher_packet(cipher).into()))
            .await;

        let mut ws_client = full_server.ws_server.ws_clients.get_mut(&ws_id).unwrap();
        ws_client.sender = Some(sender);
        ws_client.entity_id = Some(id);
        ws_client.cipher = cipher;
    }

    while let Some(Ok(message)) = receiver.next().await {
        let mut cipher: u32 = 0;
        let mut encode: bool = false;

        let mut full_server = server.lock_with_timeout().await;

        let ws_client = full_server.ws_server.ws_clients.get_mut(&ws_id);

        if let Some(ws_client) = ws_client {
            cipher = ws_client.cipher;

            encode = !ws_client.initial_packet;
            ws_client.initial_packet = true;

            entity_id = ws_client.entity_id;
        } else {
            continue;
        }

        match message {
            Message::Ping(b) => {
                let ws_client = full_server.ws_server.ws_clients.get_mut(&ws_id).unwrap();
                let _ = ws_client
                    .sender
                    .as_mut()
                    .unwrap()
                    .send(Message::Pong(b))
                    .await;
            }
            Message::Binary(bin) => {
                let bytes = BytesMut::from(&bin[..]);
                if let Some(byte) = bytes.first() {
                    let opcode = (*byte).try_into() as Result<ServerBound, ()>;
                    if let Ok(ServerBound::Ping) = opcode
                        && bytes.len() == 1
                    {
                        {
                            let ws_client =
                                full_server.ws_server.ws_clients.get_mut(&ws_id).unwrap();
                            let _ = ws_client
                                .sender
                                .as_mut()
                                .unwrap()
                                .send(Message::Binary(vec![ClientBound::Pong as u8]))
                                .await;

                            if let Some(id) = entity_id {
                                if let Some(game_server) =
                                    full_server.game_servers.get(&game_server_key.clone())
                                {
                                    let base_entity = game_server.entities.get(&id);

                                    if let Some(tank) = base_entity
                                        && let GenericEntity::Tank(tank) = &mut *tank.borrow_mut()
                                    {
                                        tank.last_ping = tank.base_entity.ticks;
                                    };
                                }
                            }
                        }

                        continue;
                    }
                }

                let data = on_message(
                    server.clone(),
                    &mut full_server,
                    bytes,
                    entity_id,
                    ws_id,
                    &addr,
                    game_server_key.clone(),
                    cipher,
                    encode,
                )
                .await;

                if let Err(should_ban) = data {
                    on_close(
                        &mut full_server,
                        entity_id,
                        ws_id,
                        should_ban,
                        &addr,
                        game_server_key,
                        None,
                    )
                    .await;
                    return;
                }
            }
            Message::Close(_) => {
                on_close(
                    &mut full_server,
                    entity_id,
                    ws_id,
                    false,
                    &addr,
                    game_server_key,
                    None,
                )
                .await;
                return;
            }
            _ => (),
        }
    }

    debug!("While loop broken, connection closed.");

    let mut full_server = server.lock_with_timeout().await;
    on_close(
        &mut full_server,
        entity_id,
        ws_id,
        false,
        &addr,
        game_server_key,
        None,
    )
    .await;
}

async fn on_message(
    server: Arc<AsyncMutex<Server>>,
    full_server: &mut Server,
    mut bin: BytesMut,
    entity_id: Option<u32>,
    ws_id: isize,
    addr: &SocketAddr,
    game_server_key: String,
    cipher: u32,
    encode: bool,
) -> Result<(), bool>
{
    let mut stream = SwiftStream::from_bytes(bin, cipher);
    if !encode {
        stream.transcode();
    }

    let opcode = stream.read_u8();

    if opcode.is_err() {
        debug!("Client sent invalid buffer.");
        return Err(true);
    }

    let opcode = opcode.unwrap().try_into() as Result<ServerBound, ()>;
    match opcode {
        Ok(ServerBound::Spawn) => {
            let (name, fingerprint, cipher) = packets::parse_spawn_packet(&mut stream)?;
            let mut uid = String::new();
            let mut user_data: Option<UserData> = None;

            let mut new_id: Option<u32> = None;

            {
                let mut ip = String::new();
                let mut needs_close: Option<(bool, CloseReason)> = None;

                {
                    let ws_client = full_server.ws_server.ws_clients.get_mut(&ws_id).unwrap();
                    if ws_client.cipher != cipher {
                        return Err(true);
                    }

                    ip.clone_from(&ws_client.connection.ip);

                    ws_client.connection.fingerprint.clone_from(&fingerprint);
                    uid.clone_from(&ws_client.connection.uid);
                    user_data.clone_from(&ws_client.connection.user_data);
                }

                if config::PRODUCTION {
                    for (i, client) in full_server.ws_server.ws_clients.iter() {
                        if client.ws_id == ws_id {
                            continue;
                        }

                        if 
                        // client.connection.fingerprint == fingerprint 
                        (!uid.is_empty() && client.connection.uid == uid)
                        // || client.connection.ip == ip
                        {
                            // eprintln!("Duplicate connection detected! {} vs {}, {} vs {}, {} vs
                            // {}", client.connection.fingerprint, fingerprint,
                            // client.connection.uid, uid, client.connection.ip, ip);
                            eprintln!(
                                "Duplicate connection detected! {} vs {}, {} vs {}",
                                client.connection.uid, uid, client.connection.fingerprint, fingerprint
                            );
                            needs_close = Some((
                                false,
                                CloseReason(4000, "You are already connected.".to_string()),
                            ));
                        }
                    }

                    if needs_close.is_none() {
                        if let Some(game_server) =
                            full_server.game_servers.get_mut(&game_server_key)
                            && game_server.banned_connections.contains(&PlayerConnection {
                                fingerprint: fingerprint.clone(),
                                uid: uid.clone(),
                                ip,
                                user_data,
                            })
                        {
                            needs_close = Some((
                                false,
                                CloseReason(
                                    4001,
                                    "You are banned (or your IP was banned previously as a VPN)."
                                        .to_string(),
                                ),
                            ));
                        } else if uid.is_empty() {
                            // let sus_result =
                            // full_server.ws_server.proxy_detector.check_proxy(addr.ip());
                            // if let Ok(true) = sus_result
                            // {
                            //     needs_close = Some((true, CloseReason(4002, "Guest users are not
                            // allowed to use VPNs. Please log in with Google or disable the
                            // VPN.".to_string()))); }
                        }
                    }
                }

                if let Some((should_ban, close_reason)) = needs_close {
                    on_close(
                        full_server,
                        entity_id,
                        ws_id,
                        should_ban,
                        addr,
                        game_server_key,
                        Some(close_reason),
                    )
                    .await;
                    return Ok(());
                }
            }
            {
                if let Some(game_server) = full_server.game_servers.get_mut(&game_server_key) {
                    if let Some(entity_id) = entity_id
                    && let Some(entity) = game_server.entities.get(&entity_id) {
                        if let GenericEntity::Tank(tank) = &mut *entity.borrow_mut() {
                            if tank.base_entity.alive {
                                return Ok(());
                            }
                        }
                    }

                    new_id = Some(game_server.add_player(
                        entity_id,
                        ws_id,
                        name,
                        fingerprint.clone(),
                        uid.clone(),
                    ));

                    if game_server.arena_state != ArenaState::Open
                        && !matches!(game_server.arena_state, ArenaState::TimeoutClosing(_))
                    {
                        let reason = if game_server.config.game_mode == GameMode::LastManStanding {
                            "the server is in the middle of a round."
                        } else {
                            "of an unknown reason."
                        };
                        if let GenericEntity::Tank(t) =
                            &mut *game_server.entities[&new_id.unwrap()].borrow_mut()
                        {
                            t.notifications.push((
                                format!("Respawning is disabled because {}", reason),
                                [255, 0, 0],
                            ));
                            t.base_entity.alive = false;
                            t.base_entity.health = 0.0;
                            t.killer = Some(t.base_entity.id);
                        }
                    }
                }
            }
            {
                {
                    let ws_client = full_server.ws_server.ws_clients.get_mut(&ws_id).unwrap();
                    ws_client.entity_id = new_id;
                }
            }

            return Ok(());
        }
        Ok(ServerBound::Input) => {
            if let Some(entity_id) = entity_id {
                let (
                    mut inputs,
                    mouse
                ) = packets::parse_input_packet(&mut stream)?;

                if let Some(game_server) = full_server.game_servers.get_mut(&game_server_key) {
                    let mut deletions = Vec::new();

                    {
                        let entity = game_server.entities.get(&entity_id);
                        if entity.is_none() {
                            return Ok(());
                        }
                        let entity = &mut *entity.unwrap().borrow_mut();

                        let base_entity = entity.get_mut_base_entity();

                        if let GenericEntity::Tank(tank) = entity {
                            tank.inputs = inputs.clone();

                            let screen_width = (1920.0 + 150.0) * tank.fov;
                            let screen_height = (1080.0 + 150.0) * tank.fov;
                            let position = mouse;

                            let screen_top_left =
                                position - Vec2::new(screen_width / 2.0, screen_height / 2.0);
                            let screen_bottom_right =
                                position + Vec2::new(screen_width / 2.0, screen_height / 2.0);

                            let pos = tank.base_entity.position;

                            if pos.x >= screen_top_left.x
                                && pos.x <= screen_bottom_right.x
                                && pos.y >= screen_top_left.y
                                && pos.y <= screen_bottom_right.y
                            {
                                tank.base_entity.mouse = mouse;
                                let angle = mouse.angle(Some(tank.base_entity.position));
                                let radius = mouse.distance(tank.base_entity.position);
                                if tank.base_entity.identity.respond_to_angle_input {
                                    tank.base_entity.angle = angle;
                                }
                            }

                            let entity_id: Result<EntityIdentityIds, ()> =
                                tank.base_entity.identity.id.try_into();
                            let is_predator = entity_id == Ok(EntityIdentityIds::Predator);

                            if is_predator {
                                if !inputs.is_set(Inputs::Repel) {
                                    tank.zoom_translation = 0.0;
                                } else if tank.zoom_translation == 0.0 {
                                    tank.zoom_translation = tank.base_entity.angle;
                                }

                                if !tank.fov_pos.is_zero(1e-1) {
                                    tank.base_entity.angle = mouse.angle(Some(
                                        tank.base_entity.position
                                            - Vec2::from_polar(1000.0, tank.base_entity.angle),
                                    ));
                                }
                            }

                            if inputs.is_set(Inputs::SwitchTank)
                                && !game_server
                                    .config
                                    .disabled_flags
                                    .contains(&packets::Inputs::SwitchTank)
                                && (tank.base_entity.ticks - tank.last_switch) as f32 > 5.0
                            {
                                deletions.clone_from(&tank.base_entity.owned_entities);

                                let mut identity_id = ((tank.base_entity.identity.id + 1)
                                    % (EntityIdentityIds::COUNT as u8));

                                loop {
                                    let new_entity_id: EntityIdentityIds =
                                        identity_id.try_into().unwrap();
                                    if let Ok(identity) =
                                        TryInto::<EntityIdentity>::try_into(new_entity_id)
                                    {
                                        let max_stat_investments = identity.max_stat_investments;

                                        tank.last_switch = tank.base_entity.ticks;
                                        tank.base_entity.identity = identity;
                                        tank.opacity = 1.0;

                                        tank.upgrades.clear();
                                        tank.check_for_upgrades();

                                        tank.stats.max_stat_investments = max_stat_investments;
                                        for index in 0..tank.stats.stat_investments.len() {
                                            let old = tank.stats.stat_investments[index];
                                            let new =
                                                tank.stats.max_stat_investments[index].min(old);

                                            if (old - new) > 0 {
                                                tank.stats.available_stat_points += (old - new);
                                            }

                                            tank.stats.stat_investments[index] = new;
                                        }

                                        if tank.level < 28 {
                                            tank.stats.available_stat_points = tank.level - 1;
                                        } else {
                                            tank.stats.available_stat_points =
                                                27 + ((tank.level - 27) / 3);
                                        }

                                        for stat in tank.stats.stat_investments.iter() {
                                            match tank
                                                .stats
                                                .available_stat_points
                                                .checked_sub(*stat)
                                            {
                                                Some(val) => tank.stats.available_stat_points = val,
                                                None => tank.stats.available_stat_points = 0,
                                            }
                                        }

                                        tank.send_upgrades_info = true;
                                        tank.send_stat_info = true;

                                        break;
                                    } else {
                                        identity_id =
                                            ((identity_id + 1) % (EntityIdentityIds::COUNT as u8));
                                    }
                                }
                            }

                            if inputs.is_set(Inputs::GodMode)
                                && !game_server
                                    .config
                                    .disabled_flags
                                    .contains(&packets::Inputs::GodMode)
                                && (tank.base_entity.ticks - tank.last_god_mode) as f32 > 3.0
                            {
                                tank.last_god_mode = tank.base_entity.ticks;
                                tank.base_entity.force_invincible =
                                    !tank.base_entity.force_invincible;
                            }

                            if inputs.is_set(Inputs::Suicide)
                                && (game_server.config.game_mode == GameMode::Sandbox
                                    || game_server.config.game_mode == GameMode::LastManStanding)
                            {
                                tank.base_entity.alive = false;
                                tank.base_entity.health = 0.0;
                                tank.killer = Some(tank.base_entity.id);
                            }
                        }
                    }

                    for id in deletions.into_iter() {
                        game_server.delete_entity(id);
                    }
                }
            }
        }
        Ok(ServerBound::Stat) => {
            if let Some(entity_id) = entity_id {
                let stat = packets::parse_stat_packet(&mut stream)?;

                if let Some(game_server) = full_server.game_servers.get(&game_server_key) {
                    if let GameMode::Ranked(_) = game_server.config.game_mode {
                        return Ok(());
                    }

                    let entity = game_server.entities.get(&entity_id);
                    if entity.is_none() {
                        return Ok(());
                    }
                    let entity = &mut *entity.unwrap().borrow_mut();

                    if let GenericEntity::Tank(tank) = entity {
                        if !tank.base_entity.alive {
                            return Ok(());
                        }

                        let current_stat = tank.stats.stat_investments[stat as usize];
                        let max_stat = tank.stats.max_stat_investments[stat as usize];

                        if current_stat < max_stat && tank.stats.available_stat_points > 0 {
                            tank.stats.stat_investments[stat as usize] += 1;
                            tank.stats.available_stat_points -= 1;
                            tank.send_stat_info = true;
                        }
                    }
                }
            }
        }
        Ok(ServerBound::Upgrades) => {
            if let Some(entity_id) = entity_id {
                let upgrade = packets::parse_upgrades_packet(&mut stream)?;

                if let Some(game_server) = full_server.game_servers.get_mut(&game_server_key) {
                    if let GameMode::Ranked(_) = game_server.config.game_mode {
                        return Ok(());
                    }

                    let mut owned_entities = vec![];

                    {
                        let entity = game_server.entities.get(&entity_id);
                        if entity.is_none() {
                            return Ok(());
                        }
                        let entity = &mut *entity.unwrap().borrow_mut();

                        if let GenericEntity::Tank(tank) = entity {
                            if let Some(upgrade) = tank.upgrades.get(upgrade) {
                                let entity_identity_id: EntityIdentityIds =
                                    match (*upgrade).try_into() {
                                        Ok(identity) => identity,
                                        Err(_) => return Ok(()),
                                    };

                                let identity: EntityIdentity = match entity_identity_id.try_into() {
                                    Ok(identity) => identity,
                                    _ => return Ok(()),
                                };

                                let investments = identity.max_stat_investments;
                                tank.base_entity.identity = identity;
                                tank.stats.max_stat_investments = investments;

                                // Update tank's AI if it has one.
                                for turret in tank.base_entity.identity.turrets.iter_mut() {
                                    if let Some(ref mut ai) = turret.ai {
                                        ai.owner = tank.base_entity.id;
                                    }
                                }

                                for index in 0..tank.stats.stat_investments.len() {
                                    let old = tank.stats.stat_investments[index];
                                    let new = tank.stats.max_stat_investments[index].min(old);

                                    if (old - new) > 0 {
                                        tank.stats.available_stat_points += (old - new);
                                    }

                                    tank.stats.stat_investments[index] = new;
                                }

                                tank.upgrades.clear();
                                tank.check_for_upgrades();

                                tank.send_upgrades_info = true;
                                tank.send_stat_info = true;

                                {
                                    while let Some(id) = tank.base_entity.owned_entities.pop() {
                                        owned_entities.push(id);
                                    }
                                }
                            }
                        }
                    }

                    for entity in owned_entities.into_iter() {
                        game_server.delete_entity(entity);
                    }
                }
            }
        }
        Ok(ServerBound::Chat) => {
            if let Some(entity_id) = entity_id {
                let message = packets::parse_chat_packet(&mut stream)?;

                if let Some(game_server) = full_server.game_servers.get(&game_server_key) {
                    let entity = game_server.entities.get(&entity_id);
                    if entity.is_none() {
                        return Ok(());
                    }
                    let entity = &mut *entity.unwrap().borrow_mut();

                    if let GenericEntity::Tank(tank) = entity {
                        tank.typing = !tank.typing;

                        match packets::parse_command(&message) {
                            CommandExecution::Login(privilege) => {
                                tank.privilege = privilege;
                                tank.notifications.push((
                                    format!("You are now a {}.", tank.privilege),
                                    [0, 255, 0],
                                ));
                            }
                            CommandExecution::GodMode => {
                                if tank.privilege == PrivilegeLevel::Developer {
                                    tank.base_entity.force_invincible =
                                        !tank.base_entity.force_invincible;
                                    tank.notifications.push((
                                        format!("GOD MODE: {}", tank.base_entity.force_invincible),
                                        [0, 255, 0],
                                    ));
                                }
                            }
                            CommandExecution::Invisible => {
                                if tank.privilege == PrivilegeLevel::Developer {
                                    tank.opacity = if tank.opacity == -1.0 { 1.0 } else { -1.0 };
                                    tank.notifications.push((
                                        format!("INVISIBILITY: {}", tank.opacity == -1.0),
                                        [0, 255, 0],
                                    ));
                                }
                            }
                            CommandExecution::Remove(id, remove) => {
                                if Into::<u8>::into(tank.privilege.clone()) >= Into::<u8>::into(PrivilegeLevel::Host)
                                    && tank.base_entity.id != id
                                    && let Some(other) = game_server.entities.get(&id)
                                    && let GenericEntity::Tank(t) = (&mut *other.borrow_mut())
                                    && let Some(ws_client) =
                                        full_server.ws_server.ws_clients.get_mut(&t.ws_id)
                                {
                                    ws_client.close = (true, remove);
                                }
                            },
                            CommandExecution::SetScore(player_id, score) => {
                                if Into::<u8>::into(tank.privilege.clone()) >= Into::<u8>::into(PrivilegeLevel::Developer)
                                    && let Some(other) = game_server.entities.get(&player_id)
                                    && let GenericEntity::Tank(t) = (&mut *other.borrow_mut())
                                {
                                    t.score = score;
                                }
                            },
                            CommandExecution::Broadcast(msg) => {
                                if tank.privilege.clone() == PrivilegeLevel::Developer {
                                    for (id, entity) in game_server.entities.iter() {
                                        if *id == tank.base_entity.id {
                                            tank.notifications.push((
                                                msg.clone(),
                                                [0, 0, 0]
                                            ));

                                            continue;
                                        }

                                        if let GenericEntity::Tank(tank) =  &mut *entity.borrow_mut() {
                                            tank.notifications.push((
                                                msg.clone(),
                                                [0, 0, 0]
                                            ));
                                        }
                                    }
                                }
                            },
                            CommandExecution::Nil => {
                                if !message.is_empty() {
                                    if tank.messages.len() >= 3 {
                                        tank.notifications.push((
                                            "You may send another message in a few seconds."
                                                .to_string(),
                                            [255, 0, 0],
                                        ));
                                    } else {
                                        tank.messages.push((message, tank.base_entity.ticks));
                                    }
                                }
                            }
                            _ => (),
                        }
                    }
                }
            }
        }
        Ok(ServerBound::Clan) => {
            if let Some(entity_id) = entity_id {
                let clan_packet_structure = packets::parse_clan_packet(&mut stream)?;

                if let Some(game_server) = full_server.game_servers.get_mut(&game_server_key) {
                    if let GameMode::Ranked(_) = game_server.config.game_mode {
                        return Ok(());
                    }

                    match clan_packet_structure {
                        ClanIncomingPacketType::Create(name) => {
                            if game_server.clans.len() >= config::MAX_CLANS as usize
                                || (&*game_server.entities.get(&entity_id).unwrap().borrow()
                                    as &GenericEntity)
                                    .get_base_entity()
                                    .clan
                                    .is_some()
                            {
                                return Ok(());
                            }

                            let index = game_server
                                .clans
                                .iter()
                                .position(|c| c.is_none())
                                .unwrap_or(game_server.clans.len())
                                as u8;

                            let clan = ClanInfo {
                                name,
                                owner: entity_id,
                                members: vec![entity_id],
                                pending_members: vec![],
                                id: index,
                            };

                            if index as usize == game_server.clans.len() {
                                game_server.clans.push(Some(clan));
                            } else {
                                game_server.clans[index as usize] = Some(clan);
                            }

                            (&mut *game_server.entities.get(&entity_id).unwrap().borrow_mut()
                                as &mut GenericEntity)
                                .get_mut_base_entity()
                                .clan = Some(index);
                        }
                        ClanIncomingPacketType::Join(clan_id) => {
                            if let Some(Some(ref mut clan)) = game_server.clans.get_mut(clan_id) {
                                if !clan.pending_members.contains(&entity_id) {
                                    clan.pending_members.push(entity_id);
                                }
                            } else {
                                return Err(false);
                            }
                        }
                        ClanIncomingPacketType::Leave() => {
                            // let clan_id =
                            // game_server.entities.get(&entity_id).unwrap().get_mut_base_entity().
                            // clan;
                            let player = game_server.entities.get(&entity_id);
                            // if let Some(GenericEntity::Tank(tank)) = player
                            if let Some(tank) = player
                                && let GenericEntity::Tank(tank) = &mut *tank.borrow_mut()
                            {
                                tank.leaving = true;
                                tank.leave_timestamp = Instant::now();
                            } else {
                                return Ok(());
                            }
                        }
                        ClanIncomingPacketType::AcceptDecline(player_id, accept) => {
                            let mut clan: Option<u8> = None;

                            if !game_server.entities.contains_key(&player_id) {
                                {
                                    let owner = &mut *game_server
                                        .entities
                                        .get(&entity_id)
                                        .unwrap()
                                        .borrow_mut();
                                    let base_entity = owner.get_base_entity();

                                    if let Some(c) = base_entity.clan {
                                        clan = Some(c);
                                    }
                                }

                                if let Some(clan) = clan {
                                    if let Some(Some(clan)) =
                                        game_server.clans.get_mut(clan as usize)
                                    {
                                        clan.pending_members.retain(|&id| id != player_id);
                                    }
                                }

                                return Ok(());
                            }

                            {
                                let owner = &mut *game_server
                                    .entities
                                    .get(&entity_id)
                                    .unwrap()
                                    .borrow_mut();
                                let base_entity = owner.get_base_entity();

                                if let Some(c) = base_entity.clan {
                                    clan = Some(c);
                                }
                            }

                            if let Some(clan) = clan {
                                if let Some(Some(clan)) =
                                    &mut game_server.clans.get_mut(clan as usize)
                                {
                                    let clan_id = clan.id;

                                    if clan.pending_members.contains(&player_id) {
                                        clan.pending_members.retain(|&id| id != player_id);

                                        if accept {
                                            clan.members.push(player_id);

                                            (&mut *game_server
                                                .entities
                                                .get(&player_id)
                                                .unwrap()
                                                .borrow_mut()
                                                as &mut GenericEntity)
                                                .get_mut_base_entity()
                                                .clan = Some(clan_id);
                                        }
                                    }
                                }
                            }
                        }
                        ClanIncomingPacketType::Kick(player_id) => {
                            let mut clan: Option<u8> = None;

                            {
                                let owner = &mut *game_server
                                    .entities
                                    .get(&entity_id)
                                    .unwrap()
                                    .borrow_mut();
                                let base_entity = owner.get_base_entity();

                                if let Some(c) = base_entity.clan {
                                    clan = Some(c);
                                }
                            }

                            let mut verified = false;
                            if let Some(clan) = clan {
                                if let Some(Some(ref mut clan)) =
                                    game_server.clans.get_mut(clan as usize)
                                {
                                    if clan.owner == entity_id && clan.members.contains(&player_id)
                                    {
                                        verified = true;
                                    }
                                }
                            }

                            if verified {
                                let player = game_server.entities.get(&player_id);
                                if let Some(t) = player
                                    && let GenericEntity::Tank(t) = &mut *t.borrow_mut()
                                {
                                    t.leaving = true;
                                    t.leave_timestamp = Instant::now();
                                }
                            }
                        }
                        ClanIncomingPacketType::Distress() => {
                            let owner =
                                &mut *game_server.entities.get(&entity_id).unwrap().borrow_mut();
                            if let GenericEntity::Tank(tank) = owner {
                                tank.distressed = true;
                            }
                        }
                    }
                }
            }
        }
        Ok(ServerBound::ArenaUpdate) => {
            if let Some(entity_id) = entity_id {
                let player_uid = full_server
                    .ws_server
                    .ws_clients
                    .get_mut(&ws_id)
                    .unwrap()
                    .connection
                    .uid
                    .clone();

                if let Some(game_server) = full_server.game_servers.get_mut(&game_server_key)
                    && let Some(host_uid) = &game_server.host_uid
                    && player_uid == *host_uid
                {
                    let was_lms = game_server.config.game_mode == GameMode::LastManStanding;

                    let parsed_packet =
                        packets::parse_arena_update_packet(&mut stream, &game_server.config)?;
                    game_server.config = parsed_packet;

                    if game_server.config.game_mode == GameMode::LastManStanding && !was_lms {
                        game_server.broadcast(("The sandbox is now last man standing! You will not be able to respawn (30 seconds from now) until one person is left.".to_string(), [255, 255, 0]));
                    } else if game_server.config.game_mode != GameMode::LastManStanding && was_lms {
                        game_server.broadcast(("The sandbox is no longer last man standing. Respawns can happen anytime.".to_string(), [255, 255, 0]));
                    }
                }
            }
        }
        Ok(ServerBound::Ready) => {
            if let Some(entity_id) = entity_id
                && let Some(game_server) = full_server.game_servers.get_mut(&game_server_key)
                && let Some(entity) = game_server.entities.get(&entity_id)
                && let GenericEntity::Tank(tank) = &mut *entity.borrow_mut()
                && !tank.is_in_1v1
            {
                tank.ready = match stream.read_u8() {
                    Ok(v) => v != 0,
                    Err(_) => false,
                };

                if let Some(opp) = tank.opponent
                    && let Some(entity2) = game_server.entities.get(&opp)
                    && let GenericEntity::Tank(tank2) = &mut *entity2.borrow_mut()
                    && tank2.ready
                {
                    if tank.ready {
                        tank.notifications.push(("The 1v1 will start in 3 seconds. Unmark yourself as ready if you cannot play.".to_string(), [0, 255, 0]));
                        tank2.notifications.push(("The 1v1 will start in 3 seconds. Unmark yourself as ready if you cannot play.".to_string(), [0, 255, 0]));

                        tank.start_1v1_time = tank.base_entity.ticks + seconds_to_ticks!(3) as u32;
                        tank2.start_1v1_time =
                            tank2.base_entity.ticks + seconds_to_ticks!(3) as u32;
                    } else {
                        tank.notifications
                            .push((format!("{} is no longer ready.", tank.name), [255, 0, 0]));
                        tank2
                            .notifications
                            .push((format!("{} is no longer ready.", tank.name), [255, 0, 0]));

                        tank.start_1v1_time = 0;
                        tank2.start_1v1_time = 0;
                    }
                }
            }
        }
        _ => {
            debug!("Client sent invalid opcode. Perhaps you forgot to match the integer to the enum value?");
            return Err(true);
        }
    }

    Ok(())
}

pub async fn on_close(
    full_server: &mut Server,
    entity_id: Option<u32>,
    ws_id: isize,
    should_ban: bool,
    addr: &SocketAddr,
    game_server_key: String,
    close_frame: Option<CloseReason>,
)
{
    println!("A client has disconnected!");

    let mut connection: Option<PlayerConnection> = None;

    {
        if should_ban {
            let mut ws_client = full_server.ws_server.ws_clients.get_mut(&ws_id).unwrap();
            connection = Some(ws_client.connection.clone());
        }

        {
            let mut ws_client = full_server.ws_server.ws_clients.get_mut(&ws_id);
            if ws_client.is_none() {
                return;
            }
            let ws_client = ws_client.unwrap();
            let mut sender = ws_client.sender.as_mut().unwrap();

            if let Some(close_frame) = close_frame {
                let _ = sender
                    .send(Message::Close(Some(CloseFrame {
                        code: close_frame.0,
                        reason: close_frame.1.into(),
                    })))
                    .await;
            }

            let _ = sender.close().await;

            debug!("Gracefully closed the connection.");
        }

        full_server.ws_server.ws_clients.remove(&ws_id);
    }

    println!("Entity ID: {:?}", entity_id);
    if let Some(entity_id) = entity_id {
        debug!("Deleting the entity!");

        if let Some(game_server) = full_server.game_servers.get_mut(&game_server_key) {
            if let Some(connection) = connection {
                game_server.banned_connections.push(connection);
            }

            let mut deletion_ids = vec![entity_id];

            let entity = game_server.entities.get(&entity_id);
            if let Some(entity) = entity
                && let GenericEntity::Tank(entity) = &mut *entity.borrow_mut()
            {
                while let Some(id) = entity.base_entity.owned_entities.pop() {
                    deletion_ids.push(id);
                }
            }

            for (i, deletion_id) in deletion_ids.into_iter().enumerate() {
                if !game_server.entities.contains_key(&deletion_id) {
                    continue;
                }

                game_server.delete_entity(deletion_id);
            }

            for clan in game_server.clans.iter_mut().flatten() {
                clan.members.retain(|&id| id != entity_id);
                clan.pending_members.retain(|&id| id != entity_id);

                if clan.owner == entity_id && !clan.members.is_empty() {
                    clan.owner = clan.members[0];

                    let mut clan_owner_name = String::new();
                    if let Some(entity) = game_server.entities.get(&clan.owner) {
                        if let GenericEntity::Tank(tank) = &*entity.borrow() {
                            clan_owner_name.clone_from(&tank.name);
                        }
                    }

                    for member in clan.members.iter() {
                        if let Some(entity) = game_server.entities.get(member) {
                            if let GenericEntity::Tank(tank) = &mut *entity.borrow_mut() {
                                tank.notifications.push((
                                    format!("The previous owner has left, and {} is now the new owner of the clan.", clan_owner_name),
                                    [255, 0, 0],
                                ));
                            }
                        }
                    }
                }
            }
        }
    }
}
