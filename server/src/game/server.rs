use axum::extract::ws::Message;
use bichannel::Channel;
use chrono::Timelike;
use eliza::Eliza;
use futures_util::SinkExt;
use rand::Rng;
use skillratings::glicko2::{
    glicko2,
    Glicko2Config,
    Glicko2Rating,
};
use std::{
    array,
    borrow::Borrow,
    cell::RefCell,
    cmp::Reverse,
    collections::{
        BTreeMap,
        BTreeSet,
        BinaryHeap,
        HashMap,
        HashSet,
    },
    fs::DirEntry,
    rc::Rc,
    sync::{
        Arc,
        Mutex,
    },
    time::Instant,
};
use strum::{
    EnumCount,
    IntoEnumIterator,
};
use tokio::sync::Mutex as AsyncMutex;

use super::entity::{
    ai::{
        AIState, TankBot, AI
    },
    base_entity::{
        self,
        BaseEntity,
        GenericEntity,
        GenericEntityHelpers,
    },
    components::entity_identity::{
        get_projectile_identity,
        get_score_from_level,
        EntityIdentity,
        EntityIdentityIds,
        TankCategories,
    },
    projectile_entity::{
        ProjectileConstructionInfo,
        ProjectileEntity,
        ProjectileType,
    },
    shape_entity::{
        self,
        ShapeEntity,
        ShapeType,
    },
    tank_entity::{
        Chatbot, DeadType, PrivilegeLevel, TankEntity
    },
};
use crate::{
    connection::{
        apis::UserData,
        packets::{
            self,
            form_elo_change_packet,
            ClientBound,
            Inputs,
        },
        wss::PlayerConnection,
    },
    constrain,
    debug,
    physics::{
        collision,
        shg::SpatialHashGrid,
        vec2::{
            fuzzy_compare,
            Vec2,
        },
    },
    randf,
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
            self, BASE_TANK_RADIUS, BOT_NAMES, LEADER_ARROW_VIEW, STUPIDS, STUPID_NAMES
        },
        stream::SwiftStream,
        timed_mutex::AsyncTimedLock,
    },
};

#[derive(Debug)]
pub struct ClanInfo
{
    pub name: String,
    pub owner: u32,
    pub members: Vec<u32>,
    pub pending_members: Vec<u32>,
    pub id: u8,
}

/// A struct representing the options for the game server.
pub struct GameServerOptions
{
    /// The target number of shapes in the arena.
    pub wanted_shape_count: u32,
}

pub type EntityDataStructure = HashMap<u32, RefCell<GenericEntity>>;

#[derive(strum::Display, PartialEq, Debug, Clone)]
pub enum GameMode
{
    FFA,
    Sandbox,
    LastManStanding,
    Ranked(HashMap<String, RankedRequest>),
}

/// A struct representing the configuration of a game server.
#[derive(Debug)]
pub struct GameServerConfig
{
    /// The size of the arena.
    pub arena_size: f32,
    /// The target number of shapes in the arena.
    pub wanted_shape_count: u32,
    /// Disabled flags.
    pub disabled_flags: Vec<Inputs>,
    /// Whether or not the server is private.
    pub private: bool,
    /// The gamemode of the server.
    pub game_mode: GameMode,
    /// The maximum number of players.
    pub max_players: u32,
    /// The only allowed UIDs to join the arena.
    pub allowed_uids: Vec<String>,
    /// The number of bots in the arena.
    pub bot_count: u8,
}

/// The state of the arena.
#[derive(PartialEq)]
pub enum ArenaState
{
    Open,
    NotAccepting,
    Closing(u32),
    TimeoutClosing(u32),
    Closed,
}

/// The game server, responsible for managing the arena.
pub struct GameServer
{
    /// The number of ticks the game server went through.
    pub ticks: u32,
    /// The configuration of the game server.
    pub config: GameServerConfig,
    /// The entities in the arena.
    pub entities: EntityDataStructure,
    /// The entity ID counter.
    pub counter: u32,
    /// The entities deleted last tick.
    pub deletions: HashSet<u32>,
    /// The spatial hashgrid managing every entity.
    pub spatial_hash_grid: SpatialHashGrid,
    /// The clans in the server.
    pub clans: Vec<Option<ClanInfo>>,
    /// The last time the server ticked.
    pub last_tick: Instant,
    /// The time when the server was created.
    pub creation_tick: Instant,
    /// The MSPT of the server.
    pub mspt: f32,
    /// The UID of the host.
    pub host_uid: Option<String>,
    /// A vector of every banned player connection.
    pub banned_connections: Vec<PlayerConnection>,
    /// The last time the last man standing gamemode initiated.
    pub lms_last_init: u32,
    /// The state of the arena.
    pub arena_state: ArenaState,
    /// The player count in the server.
    pub player_count: u32,

    bots: Vec<PrivilegeLevel>,
}

impl GameServer
{
    pub fn new(config: GameServerConfig, host_uid: Option<String>) -> Self
    {
        let wanted_shape_count = config.wanted_shape_count;
        let bots = GameServer::generate_bots(&config);

        GameServer {
            config,
            ticks: 0,
            entities: HashMap::with_capacity(100 + wanted_shape_count as usize),
            counter: 0,
            deletions: HashSet::new(),
            spatial_hash_grid: SpatialHashGrid::new(2048, config::CELL_SIZE),
            clans: Vec::default(),
            last_tick: Instant::now(),
            creation_tick: Instant::now(),
            mspt: 0.0,
            host_uid,
            banned_connections: Vec::new(),
            lms_last_init: 0,
            arena_state: ArenaState::Open,
            player_count: 0,
            bots,
        }
    }

    fn generate_bots(config: &GameServerConfig) -> Vec<PrivilegeLevel>
    {
        let bot_count = config.bot_count;
        if bot_count == 0 {
            return Vec::new();
        }

        let mut vec = Vec::with_capacity(255);

        for i in 0..STUPIDS {
            let name = {
                let max_name_len = config::MAX_NICKNAME_LENGTH;
                format!("[BOT] {}", STUPID_NAMES[randi!(0, STUPID_NAMES.len() - 1)])
                    .chars()
                    .take(max_name_len as usize)
                    .collect()
            };

            vec.push(PrivilegeLevel::Bot {
                ai: AI::new(0, false, false, TankBot::Stupid, |_, _, _, _| true),
                target_angle: 0.0,
                roam_pos: Vec2::new(randf!(200.0, config.arena_size - 200.0), randf!(200.0, config.arena_size - 200.0)),
                randomness: 0.0,
                aim: 0.0,
                old_respawn: 0,
                respawn: 0,
                identities: array::from_fn(|_| get_projectile_identity(2)),
                name,
                dead: DeadType::Inactive,
                idx: i,
                id: 0,
                stupid: true,
                chatbot: Box::new(Chatbot::default())
            });
        }

        for i in STUPIDS..255 {
            let name = {
                let max_name_len = config::MAX_NICKNAME_LENGTH;
                BOT_NAMES[randi!(0, BOT_NAMES.len() - 1)]
                    .chars()
                    .take(max_name_len as usize)
                    .collect()
            };

            vec.push(PrivilegeLevel::Bot {
                ai: AI::new(0, false, false, TankBot::Smart, |_, _, _, _| true),
                target_angle: 0.0,
                roam_pos: Vec2::new(randf!(200.0, config.arena_size - 200.0), randf!(200.0, config.arena_size - 200.0)),
                randomness: 0.0,
                aim: 0.0,
                old_respawn: 0,
                respawn: 0,
                identities: array::from_fn(|_| get_projectile_identity(2)),
                name,
                dead: DeadType::Inactive,
                idx: i,
                id: 0,
                stupid: false,
                chatbot: Box::new(Chatbot::default())
            });
        }

        vec
    }

    /// Finds an ID to use.
    pub fn find_entity_id(&mut self) -> u32
    {
        self.counter += 1;
        self.counter
    }

    /// Broadcasts a message to all players.
    pub fn broadcast(&mut self, notification: (String, [u8; 3]))
    {
        for (i, entity) in self.entities.iter() {
            if let GenericEntity::Tank(entity) = &mut *entity.borrow_mut() {
                entity.notifications.push(notification.clone());
            }
        }
    }

    /// Adds a player to the server.
    pub fn add_player(
        &mut self,
        entity_id: Option<u32>,
        ws_id: isize,
        name: String,
        fingerprint: String,
        uid: String,
    ) -> u32
    {
        let mut id: u32 = 0;

        if let GameMode::Ranked(map) = &self.config.game_mode {
            let player_info = map.get(&uid).unwrap().clone();
            let mut identity_idx = 0;
            let mut score = 0;

            if let Some(id) = entity_id {
                if let Some(entity) = self.entities.get(&id)
                    && let GenericEntity::Tank(tank) = &*entity.borrow()
                {
                    identity_idx = tank.identity_idx;
                    score = tank.score_1v1;
                }

                self.delete_entity(id);
            } else {
                identity_idx = map.get(&uid).unwrap().identity_idx as usize;
                score = map.get(&uid).unwrap().score_1v1 as u8;
            }

            id = TankEntity::new(
                self,
                ws_id,
                name,
                fingerprint,
                uid.clone(),
                config::BASE_TANK_RADIUS,
                false,
            );
            if let Some(tank) = self.entities.get(&id)
                && let GenericEntity::Tank(tank) = &mut *tank.borrow_mut()
            {
                tank.score_1v1 = score;
                tank.base_entity.identity = player_info.tanks[identity_idx]
                    .identity
                    .try_into()
                    .expect("Something went terribly wrong [invalid identity when spawning].");
                tank.stats.stat_investments = player_info.tanks[identity_idx].build;
                tank.identity_idx = identity_idx;

                tank.score = get_score_from_level(45);
                tank.update_level(45);

                tank.send_stat_info = true;
                tank.check_for_upgrades();
                tank.send_upgrades_info = true;

                tank.base_entity.force_invincible = true;
                tank.opponent = self
                    .entities
                    .iter()
                    .find(|(i, entity)| {
                        **i != id && matches!(&*(**entity).borrow(), GenericEntity::Tank(_))
                    })
                    .map(|(id, _)| *id);
            }

            for (eid, entity) in self.entities.iter() {
                if *eid == id {
                    continue;
                } else if let GenericEntity::Tank(tank) = &mut *entity.borrow_mut() {
                    tank.opponent = self
                        .entities
                        .iter()
                        .find(|(i, entity)| {
                            *i != eid && matches!(&*(**entity).borrow(), GenericEntity::Tank(_))
                        })
                        .map(|(id, _)| *id);
                }
            }
        } else {
            let mut old_level = 1;
            let mut old_clan: Option<u8> = None;

            if let Some(id) = entity_id {
                if let Some(entity) = self.entities.get(&id) {
                    let entity = &*entity.borrow();

                    if let GenericEntity::Tank(tank) = entity {
                        old_level = tank.level;
                        old_clan = tank.base_entity.clan;
                    }
                }

                self.delete_entity(id);
            }

            let host_uid = self.host_uid.clone().unwrap_or_default();
            id = TankEntity::new(
                self,
                ws_id,
                name,
                fingerprint,
                uid.clone(),
                config::BASE_TANK_RADIUS,
                (!uid.is_empty() && uid == host_uid),
            );

            if let Some(tank) = self.entities.get(&id)
                && let GenericEntity::Tank(tank) = &mut *tank.borrow_mut()
            {
                if old_level != 1 {
                    println!("Old level: {}", old_level);
                    tank.score = get_score_from_level(old_level / 2);
                    tank.update_level(old_level / 2);
                }

                if tank.level < 28 {
                    tank.stats.available_stat_points = tank.level - 1;
                } else {
                    tank.stats.available_stat_points = 27 + ((tank.level - 27) / 3);
                }

                tank.base_entity.clan = old_clan;

                if let Some(clan) = old_clan {
                    if let Some(Some(clan)) = self.clans.get_mut(clan as usize) {
                        clan.members.push(id);

                        if let Some(entity_id) = entity_id {
                            if clan.owner == entity_id {
                                clan.owner = id;
                            }
                        }
                    }
                }

                tank.send_stat_info = true;
                tank.check_for_upgrades();
                tank.send_upgrades_info = true;
            }
        }

        id
    }

    /// Deletes an entity from the server.
    pub fn delete_entity(&mut self, id: u32)
    {
        if let Some(entity) = self.entities.get(&id)
            && let GenericEntity::Tank(entity) = &mut *entity.borrow_mut()
        {
            while let Some(id) = entity.get_mut_base_entity().owned_entities.pop() {
                self.deletions.insert(id);
            }
        }

        self.deletions.remove(&id);
        self.entities.remove(&id);
        self.spatial_hash_grid.delete(id);
    }

    /// Finds an available spot for an entity to spawn itself.
    pub fn find_spawn_position(&self) -> Vec2
    {
        let mut position = Vec2::new(
            randf!(0.0, self.config.arena_size),
            randf!(0.0, self.config.arena_size),
        );

        let mut iterations = 0;
        loop {
            iterations += 1;
            if iterations >= 20 {
                return position;
            }

            let nearby = self.spatial_hash_grid.query_radius(
                (self.entities.len() + 1) as u32,
                position,
                BASE_TANK_RADIUS * 2.0,
            );

            if nearby.is_empty() {
                return position;
            } else {
                position = Vec2::new(
                    randf!(0.0, self.config.arena_size),
                    randf!(0.0, self.config.arena_size)
                );
                continue;
            }
        }
    }

    /// Spawns a random shape.
    pub fn spawn_random_shape(&mut self)
    {
        let position = self.find_spawn_position();

        let center = Vec2::new(self.config.arena_size / 2.0, self.config.arena_size / 2.0);
        let center_radius = self.config.arena_size / 10.0;
        let top_left = center - Vec2::new(center_radius, -center_radius);
        let bottom_right = center - Vec2::new(-center_radius, center_radius);

        if (position.x > top_left.x && position.x < bottom_right.x)
            && (position.y < top_left.y && position.y > bottom_right.y)
        {
            let selective_radius = self.config.arena_size / 15.0;
            let selective_top_left = center - Vec2::new(selective_radius, -selective_radius);
            let selective_bottom_right = center - Vec2::new(-selective_radius, selective_radius);

            if (position.x > selective_top_left.x && position.x < selective_bottom_right.x)
                && (position.y < selective_top_left.y && position.y > selective_bottom_right.y)
            {
                // Pentagons
                let rf = randf!(0.0, 1.0);
                let shape_type = if rf < 0.05 {
                    ShapeType::AlphaPentagon
                } else {
                    ShapeType::Pentagon
                };

                ShapeEntity::new(self, shape_type, Some(position));
            } else {
                // Crashers
                let rf = randf!(0.0, 1.0);
                let shape_type = if rf < 0.2 {
                    ShapeType::LargeCrasher
                } else {
                    ShapeType::SmallCrasher
                };

                ShapeEntity::new(self, shape_type, Some(position));
            }
        } else {
            // Misc

            let rf = randf!(0.0, 1.0);
            let shape_type = if rf < 0.04 {
                ShapeType::Pentagon
            } else if rf < 0.2 {
                ShapeType::Triangle
            } else {
                ShapeType::Square
            };

            ShapeEntity::new(self, shape_type, Some(position));
        }
    }

    /// Fake bot count.
    pub fn fake_bot_count(&self) -> u8
    {
        let now = chrono::Local::now();
        let hour = now.hour();
        let mut rng = rand::thread_rng();


        // return STUPIDS as u8;

        // let v = match hour {
        //     0..=3 => rng.gen_range(3..=6),     // Midnight
        //     4..=5 => rng.gen_range(6..=7),     // Early morning
        //     6..=9 => rng.gen_range(7..=10),    // Morning
        //     10..=13 => rng.gen_range(10..=13), // Late morning
        //     14..=17 => rng.gen_range(13..=18), // Afternoon (PEAK TIME)
        //     18..=21 => rng.gen_range(13..=15), // Evening
        //     22..=24 => rng.gen_range(3..=6),   // Night
        //     _ => 0,
        // };

        return 0;

        let v = match hour {
            0..=3 => rng.gen_range(0..=0),     // Midnight
            4..=5 => rng.gen_range(0..=0),     // Early morning
            6..=9 => rng.gen_range(0..=2),     // Morning
            10..=13 => rng.gen_range(5..=8),   // Late morning
            14..=17 => rng.gen_range(8..=10),  // Afternoon (PEAK TIME)
            18..=21 => rng.gen_range(5..=8),   // Evening
            22..=24 => rng.gen_range(3..=6),   // Night
            _ => 0,
        };

        v + STUPIDS as u8
    }

    /// Moves one frame forward in time.
    pub fn tick(&mut self, ws_server: &mut WebSocketServer)
    {
        if self.ticks % seconds_to_ticks!(60 * 5) == 0 {
            let bots = self.fake_bot_count();
            self.config.bot_count = bots;
            println!("Bot count: {} ({} bots, {} stupids)", bots, bots - STUPIDS as u8, STUPIDS);
        }

        self.ticks += 1;

        match self.arena_state {
            ArenaState::Closing(tick) => {
                if tick == self.ticks {
                    if let GameMode::Ranked(map) = &mut self.config.game_mode {
                        for request in map.values() {
                            let _ = ws_server.db.create_user(request.user_data.clone());
                        }
                    }

                    self.arena_state = ArenaState::Closed;
                    return;
                }
            }
            ArenaState::Closed => return,
            _ => (),
        };

        if (self.ticks - self.lms_last_init) >= seconds_to_ticks!(30)
            && self.config.game_mode == GameMode::LastManStanding
            && self.arena_state == ArenaState::Open
        {
            self.arena_state = ArenaState::NotAccepting;
            self.broadcast((
                "You will not be able to respawn until one person remains.".to_string(),
                [255, 0, 0],
            ));
        }

        let time = std::time::Instant::now();
        let delta_time = time.duration_since(self.last_tick).as_millis_f32();
        let dt = (delta_time / config::MSPT as f32).min(1.5);
        self.last_tick = time;

        let mut num_shapes = 0;

        let mut tank_mspt = 0.0;
        let mut shape_mspt = 0.0;
        let mut projectile_mspt = 0.0;

        // UPDATE
        let mut projectile_creations: Vec<(ProjectileConstructionInfo, u32, Option<u8>)> =
            Vec::new();
        let (mut tank_count, mut tank_id, mut tank_name) = (0, 0, String::new());

        let mut arena_closed = false;

        // self.deletions.clear();
        self.player_count = 0;

        let mut bot_count = 0;
        let ((mut win_uid, mut win_category_idx), (mut loss_uid, mut loss_category_idx)) =
            ((String::new(), 0), (String::new(), 0));

        for (id, entity) in self.entities.iter() {
            match &mut *entity.borrow_mut() {
                GenericEntity::Tank(t) => {
                    self.player_count += 1;

                    if t.base_entity.alive {
                        tank_count += 1;
                        tank_id = t.base_entity.id;
                        tank_name.clone_from(&t.name);

                        if matches!(t.privilege, PrivilegeLevel::Bot { .. }) {
                            bot_count += 1;
                        }
                    }

                    let (exists, deletions, creations, close, ((wu, wci), (lu, lci))) = t.tick(
                        &self.entities,
                        &mut self.spatial_hash_grid,
                        &mut self.clans,
                        &self.config,
                        self.mspt,
                        ws_server,
                        dt,
                    );

                    if !exists {
                        self.deletions.insert(*id);

                        if let PrivilegeLevel::Bot {
                            target_angle,
                            roam_pos,
                            randomness,
                            aim,
                            old_respawn,
                            respawn,
                            identities,
                            ai,
                            name,
                            dead,
                            idx,
                            id,
                            stupid,
                            chatbot
                        } = &t.privilege
                        {
                            let mut indices = Vec::new();
                            for (idx, bot) in self.bots.iter().enumerate() {
                                if let PrivilegeLevel::Bot { idx, .. } = bot {
                                    indices.push(*idx);
                                }
                            }

                            self.bots[*idx] = PrivilegeLevel::Bot {
                                target_angle: *target_angle,
                                roam_pos: *roam_pos,
                                randomness: *randomness,
                                aim: *aim,
                                old_respawn: *old_respawn,
                                respawn: seconds_to_ticks!(randi!(5, 20)) as u32,
                                identities: identities.clone(),
                                ai: ai.clone(),
                                name: name.clone(),
                                dead: DeadType::WantsRespawn,
                                idx: *idx,
                                id: *id,
                                stupid: *stupid,
                                chatbot: chatbot.clone()
                            };
                        }
                    }

                    for deletion in deletions.into_iter() {
                        self.deletions.insert(deletion);
                    }

                    for creation in creations.into_iter() {
                        projectile_creations.push((creation, t.base_entity.id, t.base_entity.clan));
                    }

                    if !arena_closed {
                        arena_closed = close;
                    }

                    if !(wu.is_empty() && lu.is_empty()) {
                        win_uid.clone_from(&wu);
                        win_category_idx = wci;

                        loss_uid.clone_from(&lu);
                        loss_category_idx = lci;
                    }
                }
                GenericEntity::Projectile(p) => {
                    let (exists, projectiles) = p.tick(
                        &self.entities,
                        &mut self.spatial_hash_grid,
                        &self.config,
                        dt,
                    );
                    if !exists {
                        self.deletions.insert(*id);
                    }

                    let mut owner: Option<u32> = None;
                    let mut clan: Option<u8> = None;
                    for o in p.base_entity.owned_by.iter() {
                        if let Some(tank) = self.entities.get(o)
                            && let GenericEntity::Tank(tank) = &*tank.borrow()
                        {
                            owner = Some(tank.base_entity.id);
                            clan = tank.base_entity.clan;
                        }
                    }

                    if let Some(owner) = owner {
                        for projectile in projectiles.into_iter() {
                            projectile_creations.push((projectile, owner, clan));
                        }
                    }
                }
                GenericEntity::Shape(s) => {
                    num_shapes += 1;

                    let (exists, projectile_construction) = s.tick(
                        &self.entities,
                        &mut self.spatial_hash_grid,
                        &self.config,
                        dt,
                    );

                    if !exists {
                        self.deletions.insert(*id);
                    }

                    if let Some((projectile_construction, owner, clan)) = projectile_construction {
                        projectile_creations.push((projectile_construction, owner, clan));
                    }
                }
                _ => (),
            }
        }

        if self.arena_state == ArenaState::Open && arena_closed {
            self.arena_state = ArenaState::Closing(self.ticks + seconds_to_ticks!(5) as u32);
            self.broadcast((
                "Arena closed: No players may join.".to_string(),
                [255, 0, 0],
            ));
        }

        if let GameMode::Ranked(map) = &mut self.config.game_mode
            && self.player_count == 1
            && let Some(tank) = self.entities.get(&tank_id)
            && let GenericEntity::Tank(t) = &mut *tank.borrow_mut()
        {
            if self.arena_state == ArenaState::Open {
                if t.is_in_1v1 {
                    t.notifications.push((
                        "You have won the round, as your opponent has disconnected.".to_string(),
                        [0, 255, 0],
                    ));

                    t.score_1v1 += 1;

                    t.base_entity.health = 0.0;
                    t.base_entity.alive = false;
                    t.killer = Some(t.base_entity.id);

                    let win_uid = t.uid.clone();
                    let loss_uid = map
                        .iter()
                        .find(|(uid, _)| **uid != win_uid)
                        .unwrap()
                        .0
                        .clone();

                    let player_one = map.get_mut(&win_uid).unwrap().user_data.elo[win_category_idx];
                    let player_two =
                        map.get_mut(&loss_uid).unwrap().user_data.elo[loss_category_idx];
                    let config = Glicko2Config::new();

                    let old_player_one = player_one.rating;
                    let old_player_two = player_two.rating;

                    let (new_player_one, new_player_two) = glicko2(
                        &player_one,
                        &player_two,
                        &skillratings::Outcomes::WIN,
                        &config,
                    );

                    map.get_mut(&win_uid).unwrap().user_data.elo[win_category_idx] = new_player_one;
                    map.get_mut(&win_uid).unwrap().score_1v1 = t.score_1v1 as i32;
                    map.get_mut(&loss_uid).unwrap().user_data.elo[loss_category_idx] =
                        new_player_two;
                    map.get_mut(&loss_uid).unwrap().identity_idx += 1;

                    let mut cipher = 0;
                    if let Some(client) = ws_server.ws_clients.get_mut(&t.ws_id) {
                        cipher = client.cipher;
                    }

                    t.packets.push(form_elo_change_packet(
                        cipher,
                        old_player_one as f32,
                        new_player_one.rating as f32,
                        old_player_two as f32,
                        new_player_two.rating as f32,
                    ));
                }

                if t.score_1v1 == 6 {
                    t.notifications
                        .push(("You won the game!".to_string(), [0, 255, 0]));

                    self.arena_state =
                        ArenaState::Closing(self.ticks + seconds_to_ticks!(5) as u32);
                    t.notifications.push((
                        "Arena closed: No players may join.".to_string(),
                        [255, 0, 0],
                    ));
                } else {
                    self.arena_state =
                        ArenaState::TimeoutClosing(self.ticks + seconds_to_ticks!(65) as u32);
                    t.notifications.push(("The opponent disconnected and has 60 seconds to reconnect before you automatically win the game.".to_string(), [255, 0, 0]));
                }
            } else if let ArenaState::TimeoutClosing(tick) = self.arena_state
                && self.ticks == tick + seconds_to_ticks!(5) as u32
            {
                self.arena_state = ArenaState::Closing(self.ticks + seconds_to_ticks!(5) as u32);
                t.notifications.push((
                    "Arena closed: No players may join.".to_string(),
                    [255, 0, 0],
                ));

                let win_uid = t.uid.clone();
                let loss_uid = map
                    .iter()
                    .find(|(uid, _)| **uid != win_uid)
                    .unwrap()
                    .0
                    .clone();

                let mut old_identity_idx = map.get(&loss_uid).unwrap().identity_idx as usize;

                let ((mut rop1, mut rnp1), (mut rop2, mut rnp2)) = (
                    (
                        map.get_mut(&win_uid).unwrap().user_data.elo
                            [t.base_entity.identity.category.clone() as usize]
                            .rating,
                        0.0,
                    ),
                    (0.0, 0.0),
                );

                for i in 0..(6 - t.score_1v1) {
                    let identity = map.get(&loss_uid).unwrap().tanks[old_identity_idx].identity;
                    let real_loss_identity: EntityIdentity = identity.try_into().unwrap();

                    let player_one = map.get_mut(&win_uid).unwrap().user_data.elo
                        [t.base_entity.identity.category.clone() as usize];
                    let player_two = map.get_mut(&loss_uid).unwrap().user_data.elo
                        [real_loss_identity.category.clone() as usize];

                    let (np1, np2) = glicko2(
                        &player_one,
                        &player_two,
                        &skillratings::Outcomes::WIN,
                        &Glicko2Config::new(),
                    );
                    map.get_mut(&win_uid).unwrap().user_data.elo
                        [t.base_entity.identity.category.clone() as usize] = np1;
                    map.get_mut(&loss_uid).unwrap().user_data.elo
                        [real_loss_identity.category.clone() as usize] = np2;

                    rnp1 = np1.rating;

                    old_identity_idx += 1;
                }

                t.score_1v1 = 6;

                let mut cipher = 0;
                if let Some(client) = ws_server.ws_clients.get_mut(&t.ws_id) {
                    cipher = client.cipher;
                }

                t.packets.push(form_elo_change_packet(
                    cipher,
                    rop1 as f32,
                    rnp1 as f32,
                    rop2 as f32,
                    rnp2 as f32,
                ));
                t.notifications
                    .push(("You won the game!".to_string(), [0, 255, 0]));

                t.base_entity.health = 0.0;
                t.base_entity.alive = false;
                t.killer = Some(t.base_entity.id);
            }
        }

        if let GameMode::Ranked(_) = self.config.game_mode
            && self.player_count == 2
            && let ArenaState::TimeoutClosing(_) = self.arena_state
        {
            self.arena_state = ArenaState::Open;
            self.broadcast((
                "The opponent has reconnected. The game will continue.".to_string(),
                [0, 255, 0],
            ));
        }

        if !(win_uid.is_empty() && loss_uid.is_empty())
            && let GameMode::Ranked(map) = &mut self.config.game_mode
        {
            let player_one = map.get_mut(&win_uid).unwrap().user_data.elo[win_category_idx];
            let player_two = map.get_mut(&loss_uid).unwrap().user_data.elo[loss_category_idx];
            let config = Glicko2Config::new();

            let old_player_one = player_one.rating;
            let old_player_two = player_two.rating;

            let (new_player_one, new_player_two) = glicko2(
                &player_one,
                &player_two,
                &skillratings::Outcomes::WIN,
                &config,
            );

            map.get_mut(&win_uid).unwrap().user_data.elo[win_category_idx] = new_player_one;
            map.get_mut(&loss_uid).unwrap().user_data.elo[loss_category_idx] = new_player_two;

            for (id, tank) in self.entities.iter() {
                if let GenericEntity::Tank(t) = &mut *tank.borrow_mut() {
                    // Send ELO change packet.
                    let mut cipher = 0;
                    if let Some(client) = ws_server.ws_clients.get_mut(&t.ws_id) {
                        cipher = client.cipher;
                    }

                    let winner = t.uid == win_uid;
                    let (you_old, you_new) = if winner {
                        (old_player_one, new_player_one.rating)
                    } else {
                        (old_player_two, new_player_two.rating)
                    };
                    let (opp_old, opp_new) = if winner {
                        (old_player_two, new_player_two.rating)
                    } else {
                        (old_player_one, new_player_one.rating)
                    };

                    t.packets.push(form_elo_change_packet(
                        cipher,
                        you_old as f32,
                        you_new as f32,
                        opp_old as f32,
                        opp_new as f32,
                    ));

                    // Update scores and identity indices.
                    if winner {
                        map.get_mut(&win_uid).unwrap().score_1v1 = t.score_1v1 as i32;
                        map.get_mut(&win_uid).unwrap().identity_idx = t.identity_idx as i32;
                    } else {
                        map.get_mut(&loss_uid).unwrap().score_1v1 = t.score_1v1 as i32;
                        map.get_mut(&loss_uid).unwrap().identity_idx = t.identity_idx as i32;
                    }
                }
            }
        }

        if self.config.game_mode == GameMode::LastManStanding
            && self.arena_state == ArenaState::NotAccepting
        {
            if tank_count == 1 {
                self.broadcast((
                    format!("{} is the last man standing!", tank_name),
                    [0, 255, 0],
                ));
                self.broadcast((
                    "Respawn within 30 seconds to play again.".to_string(),
                    [0, 255, 0],
                ));
                if let GenericEntity::Tank(t) = &mut *self.entities[&tank_id].borrow_mut() {
                    t.base_entity.health = 0.0;
                }

                self.lms_last_init = self.ticks;
                self.arena_state = ArenaState::Open;
            } else if tank_count == 0 {
                self.broadcast(("No one was present in the arena when the game started. Restarting 30 second timer...".to_string(), [255, 0, 0]));
                self.lms_last_init = self.ticks;
                self.arena_state = ArenaState::Open;
            }
        }

        // PROJECTILE CREATION
        for (construction, id, clan) in projectile_creations.into_iter() {
            let new_id = ProjectileEntity::new(self, construction);

            {
                let projectile = &mut *self.entities.get_mut(&new_id).unwrap().borrow_mut();

                projectile.get_mut_base_entity().owned_by.push(id);
                projectile.get_mut_base_entity().clan = clan;
            }

            if let Some(tank) = self.entities.get(&id) {
                let tank = &mut *tank.borrow_mut();
                tank.get_mut_base_entity().owned_entities.push(new_id);
            }
        }

        // DELETIONS
        while let Some(deletion) = self.deletions.iter().next().cloned() {
            self.delete_entity(deletion);
        }

        // CLAN UPDATES
        // let start = Instant::now();
        for clan in self.clans.iter_mut() {
            if clan.is_none() {
                continue;
            }

            let true_clan = clan.as_mut().unwrap();

            if true_clan.members.is_empty() {
                *clan = None;
                continue;
            }

            true_clan
                .members
                .retain(|member| self.entities.contains_key(member));

            let mut kicked = Vec::new();

            for member in true_clan.members.iter() {
                let tank = &mut *self.entities.get(member).unwrap().borrow_mut();
                if let GenericEntity::Tank(tank) = tank {
                    tank.distressed = false;
                    if tank.leaving
                        && (Instant::now() - tank.leave_timestamp)
                            > std::time::Duration::from_secs(5)
                    {
                        tank.leaving = false;
                        tank.base_entity.clan = None;
                        kicked.push(tank.base_entity.id);
                    }
                }
            }

            for i in kicked.into_iter() {
                true_clan.members.retain(|&id| id != i);
                true_clan.pending_members.retain(|&id| id != i);

                if true_clan.owner == i && !true_clan.members.is_empty() {
                    true_clan.owner = true_clan.members[0];

                    let mut clan_owner_name = String::new();
                    if let Some(entity) = self.entities.get(&true_clan.owner) {
                        if let GenericEntity::Tank(tank) = &*entity.borrow() {
                            clan_owner_name.clone_from(&tank.name);
                        }
                    }

                    for member in true_clan.members.iter() {
                        if let Some(entity) = self.entities.get(member) {
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

        // let clan_mspt = start.elapsed().as_micros();

        // COLLISION
        // let start = Instant::now();
        // WHAT THE FUCK???? DO NOT CLONE!!!! FIX THIS IMMEDIATELY
        for (id, mut entity) in self.entities.iter() {
            let entity = &mut *entity.borrow_mut();
            let base_entity = entity.get_mut_base_entity();
            let collisions = self.spatial_hash_grid.query_radius(
                base_entity.id,
                base_entity.position,
                base_entity.radius,
            );

            for collision in collisions {
                if let Some(entity2) = self.entities.get(&collision) {
                    let entity2 = &mut *entity2.borrow_mut();

                    let base_entity_1 = entity.get_mut_base_entity();
                    let base_entity_2 = entity2.get_mut_base_entity();

                    let resolve_collide = base_entity_1.should_collide(base_entity_2);

                    if resolve_collide {
                        if collision::detect_collision(base_entity_1, base_entity_2) {
                            collision::resolve_collision(entity, entity2);

                            GenericEntity::handle_collision(entity2, entity);
                            GenericEntity::handle_collision(entity, entity2);
                        }
                    } else if let GenericEntity::Projectile(drone1) = entity {
                        if let GenericEntity::Projectile(drone2) = entity2 {
                            let drones = (drone1.projectile_type == ProjectileType::Drone
                                && drone2.projectile_type == ProjectileType::Drone)
                                || (drone1.projectile_type == ProjectileType::NecromancerDrone
                                    && drone2.projectile_type == ProjectileType::NecromancerDrone)
                                || (drone1.projectile_type == ProjectileType::Minion
                                    && drone2.projectile_type == ProjectileType::Minion);

                            if drones
                                && collision::detect_collision(
                                    drone1.get_mut_base_entity(),
                                    drone2.get_mut_base_entity(),
                                )
                            {
                                let angle = drone1
                                    .base_entity
                                    .position
                                    .angle(Some(drone2.base_entity.position));
                                let is_idle = drone1.ai.as_ref().unwrap().state == AIState::Idle;

                                if drone1.projectile_type == ProjectileType::Minion || is_idle {
                                    drone1.base_entity.position += Vec2::from_polar(6.0, angle);
                                    drone2.base_entity.position -= Vec2::from_polar(6.0, angle);
                                } else {
                                    drone1.base_entity.velocity += Vec2::from_polar(1.5, angle);
                                    drone2.base_entity.velocity -= Vec2::from_polar(1.5, angle);
                                }
                            }
                        }
                    }
                }

                // self.entities.insert(collision, entity2);
            }
        }

        // let collision_mspt = start.elapsed().as_micros() as f32;

        // // SCOREBOARD
        // top_tanks.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap());
        // top_tanks.truncate(10);

        // let mut stream = SwiftStream::with_capacity(1 + top_tanks.len() * 4);
        // stream.write_u8(ClientBound::Scoreboard as u8);

        // stream.write_u8(top_tanks.len() as u8);
        // for (score, name, id, identity) in top_tanks.iter()
        // {
        //     stream.write_f32(*score);
        //     stream.write_string(name);
        //     stream.write_u32(*id);
        //     stream.write_u8(*identity);
        // }

        // if !top_tanks.is_empty()
        // {
        //     let leader = self.entities[top_tanks[0].2 as usize].as_ref().unwrap();

        //     for entity in self.entities.iter().flatten()
        //     {
        //         if let GenericEntity::Tank(t) = entity
        //         {
        //             let mut new_stream = stream.clone();

        //             let dist =
        // t.base_entity.position.distance(leader.get_base_entity().position);
        // if t.base_entity.id != top_tanks[0].2 && dist > LEADER_ARROW_VIEW             {
        //                 let angle =
        // t.base_entity.position.angle(Some(leader.get_base_entity().position));
        //                 new_stream.write_f32(angle);
        //             }

        //             let bytes = new_stream.move_data().freeze();

        //             let mut ws_server = ws_server.lock_with_timeout().await;
        //             let client = ws_server.ws_clients[t.ws_id].as_mut().unwrap();

        //             let sender_unwrap = client.sender.as_mut().unwrap();
        //             let mut sender = sender_unwrap.lock_with_timeout().await;
        //             let _ = sender.send(Message::Binary(bytes.into())).await;
        //         }
        //     }
        // }

        // SHAPE RESPAWN
        // let start = Instant::now();

        self.config.wanted_shape_count = self
            .config
            .wanted_shape_count
            .min(self.config.arena_size as u32 / 10);

        if (self.config.game_mode == GameMode::Sandbox
            || self.config.game_mode == GameMode::LastManStanding)
            && num_shapes > self.config.wanted_shape_count as i64
        {
            let mut displacement = num_shapes - self.config.wanted_shape_count as i64;
            // find displacement number of shapes
            let mut to_delete = Vec::new();
            for (id, entity) in self.entities.iter() {
                if let GenericEntity::Shape(s) = &*entity.borrow() {
                    if displacement <= 0 {
                        break;
                    }

                    to_delete.push(*id);
                    displacement -= 1;
                }
            }

            for id in to_delete.into_iter() {
                self.delete_entity(id);
            }
        }

        let displacement: i64 = self.config.wanted_shape_count as i64 - num_shapes;
        for _ in 0..displacement {
            self.spawn_random_shape();
        }

        if self.config.game_mode == GameMode::Sandbox {
            self.config.bot_count = self
                .config
                .bot_count
                .min((self.config.arena_size as u32 / 1000) as u8);
        }

        if bot_count > self.config.bot_count {
            let mut tank_displacement = bot_count - self.config.bot_count;
            let mut to_delete: HashMap<usize, (u32, String)> = HashMap::new();
            for (id, entity) in self.entities.iter() {
                if tank_displacement == 0 {
                    break;
                }

                if let GenericEntity::Tank(t) = &*entity.borrow() {
                    if let PrivilegeLevel::Bot { name, idx, .. } = &t.privilege {
                        to_delete.insert(*idx, (*id, name.clone()));
                        tank_displacement -= 1;
                    }
                }
            }

            for (idx, (id, name)) in to_delete.into_iter() {
                let stupid = name.starts_with("[BOT]");

                self.delete_entity(id);
                self.bots[idx] = PrivilegeLevel::Bot {
                    target_angle: 0.0,
                    roam_pos: Vec2::new(randf!(200.0, self.config.arena_size - 200.0), randf!(200.0, self.config.arena_size - 200.0)),
                    randomness: 0.0,
                    aim: 0.0,
                    old_respawn: 0,
                    respawn: seconds_to_ticks!(randi!(5, 20)) as u32,
                    identities: array::from_fn(|_| get_projectile_identity(2)),
                    ai: AI::new(0, false, false, if stupid { TankBot::Stupid } else { TankBot::Smart }, |_, _, _, _| true),
                    name,
                    dead: DeadType::Inactive,
                    idx,
                    id: 0,
                    stupid,
                    chatbot: Box::new(Chatbot::default())
                };
            }
        }

        if self.config.bot_count > bot_count {
            let tank_displacement = self.config.bot_count - bot_count;
            let mut found_all_wanted = false;
            let mut counter = 0;

            while counter < tank_displacement {
                counter += 1;

                let mut dead_player: Option<PrivilegeLevel> = None;
                let mut should_set_found_all_wanted = true;

                for (idx, bot) in self.bots.iter_mut().enumerate() {
                    if let PrivilegeLevel::Bot { respawn, dead, stupid, .. } = bot {
                        let desired_type = if found_all_wanted { DeadType::Inactive } else { DeadType::WantsRespawn };

                        if *stupid && *dead == desired_type {
                            *respawn = 0;
                            dead_player = Some(bot.clone());
                            break;
                        }

                        if *respawn != 0 {
                            *respawn -= 1;
                            should_set_found_all_wanted = false;
                            continue;
                        }

                        if *dead == desired_type {
                            dead_player = Some(bot.clone());
                            break;
                        }
                    }
                }

                if let Some(PrivilegeLevel::Bot {
                    target_angle,
                    roam_pos,
                    randomness,
                    aim,
                    old_respawn,
                    respawn,
                    identities,
                    name,
                    ai,
                    dead,
                    idx,
                    id,
                    stupid,
                    chatbot
                }) = dead_player
                {
                    let is_new_spawn = !stupid && randf!(0.0, 1.0) < 0.05;

                    let name = if is_new_spawn && self.config.game_mode == GameMode::FFA {
                        let max_name_len = config::MAX_NICKNAME_LENGTH;
                        BOT_NAMES[randi!(0, BOT_NAMES.len() - 1)]
                            .chars()
                            .take(max_name_len as usize)
                            .collect()
                    } else {
                        name.clone()
                    };
                    let chatbot = if is_new_spawn { Box::new(Chatbot::default()) } else { chatbot };

                    let id = TankEntity::new(
                        self,
                        -1,
                        name.to_string(),
                        "".to_string(),
                        "".to_string(),
                        config::BASE_TANK_RADIUS,
                        false,
                    );

                    if let GenericEntity::Tank(tank) = &mut *self.entities[&id].borrow_mut() {
                        let mut lvl_15_idents = Vec::new();

                        for identity in EntityIdentityIds::iter() {
                            if identity == EntityIdentityIds::Projectile {
                                continue;
                            }
                            let identity: EntityIdentity = identity.try_into().unwrap();
                            if identity.level_requirement == 15
                                && !matches!(
                                    identity.category,
                                    TankCategories::Destroyer
                                        | TankCategories::Drone
                                        | TankCategories::Factory
                                        | TankCategories::Illegal
                                        | TankCategories::Fighter
                                )
                            {
                                lvl_15_idents.push(identity);
                            }
                        }

                        let mut first_identity =
                            lvl_15_idents.remove(randi!(0, lvl_15_idents.len() as i32 - 1) as usize);

                        let mut lvl_30_idents: Vec<EntityIdentity> = Vec::new();
                        for identity in first_identity.upgrades.iter() {
                            let identity: EntityIdentity = (*identity).try_into().unwrap();
                            if identity.level_requirement == 30
                                && !matches!(
                                    identity.category,
                                    TankCategories::Destroyer
                                        | TankCategories::Drone
                                        | TankCategories::Factory
                                        | TankCategories::Illegal
                                        | TankCategories::Fighter
                                )
                            {
                                lvl_30_idents.push(identity);
                            }
                        }

                        let second_identity =
                            lvl_30_idents.remove(randi!(0, lvl_30_idents.len() as i32 - 1) as usize);

                        let mut lvl_45_idents: Vec<EntityIdentity> = Vec::new();
                        for identity in second_identity.upgrades.iter() {
                            if identity == &EntityIdentityIds::OverTrapper {
                                continue;
                            }

                            let identity: EntityIdentity = (*identity).try_into().unwrap();
                            if identity.level_requirement == 45
                                && !matches!(
                                    identity.category,
                                    TankCategories::Destroyer
                                        | TankCategories::Drone
                                        | TankCategories::Factory
                                        | TankCategories::Illegal
                                        | TankCategories::Fighter
                                )
                            {
                                lvl_45_idents.push(identity);
                            }
                        }

                        let third_identity =
                            lvl_45_idents.remove(randi!(0, lvl_45_idents.len() as i32 - 1) as usize);

                        if stupid {
                            tank.base_entity.identity = third_identity.clone();
                        }

                        tank.privilege = PrivilegeLevel::Bot {
                            // tank.base_entity.angle, randf!(0.5, 1.5), 1.0, randi!(30, 60)
                            target_angle: tank.base_entity.angle,
                            roam_pos: Vec2::new(randf!(200.0, self.config.arena_size - 200.0), randf!(200.0, self.config.arena_size - 200.0)),
                            randomness: randf!(0.75, 1.25),
                            aim: 1.0,
                            old_respawn: seconds_to_ticks!(randi!(2, 5)) as u32,
                            respawn: if stupid { 0 } else { seconds_to_ticks!(randi!(5, 7)) as u32 },
                            identities: [first_identity, second_identity, third_identity],
                            name,
                            ai: AI::new(id, false, false, if stupid { TankBot::Stupid } else { TankBot::Smart }, |_, _, _, _| true),
                            dead: DeadType::NotDead,
                            idx,
                            id,
                            stupid,
                            chatbot,
                        };

                        // todo randomise tank/build/score/level

                        // tank.base_entity.identity =
                        // player_info.tanks[identity_idx].identity.try_into().expect("Something went
                        // terribly wrong [invalid identity when spawning].");
                        let potential_investments = [
                            [0, 1, 1, 5, 7, 7, 7, 7, 0],
                            [0, 2, 3, 2, 7, 7, 7, 7, 0],
                            [0, 2, 3, 7, 7, 7, 6, 6, 0],
                            [0, 1, 1, 5, 7, 7, 7, 7, 0],
                            [0, 2, 3, 2, 7, 7, 7, 7, 0],
                            [0, 2, 3, 7, 7, 7, 6, 6, 0],
                            [0, 1, 1, 5, 7, 7, 7, 7, 0],
                            [0, 2, 3, 2, 7, 7, 7, 7, 0],
                            [0, 2, 3, 7, 7, 7, 6, 6, 0],
                            [0, 1, 1, 5, 7, 7, 7, 7, 0],
                            [0, 2, 3, 2, 7, 7, 7, 7, 0],
                            [0, 2, 3, 7, 7, 7, 6, 6, 0],
                            [0, 1, 1, 5, 7, 7, 7, 7, 0],
                            [0, 2, 3, 2, 7, 7, 7, 7, 0],
                            [0, 2, 3, 7, 7, 7, 6, 6, 0],
                            [0, 1, 1, 5, 7, 7, 7, 7, 0],
                            [0, 2, 3, 2, 7, 7, 7, 7, 0],
                            [0, 2, 3, 7, 7, 7, 6, 6, 0],
                            [0, 1, 1, 5, 7, 7, 7, 7, 0],
                            [0, 2, 3, 2, 7, 7, 7, 7, 0],
                            [0, 2, 3, 7, 7, 7, 6, 6, 0],
                            [0, 1, 1, 5, 7, 7, 7, 7, 0],
                            [0, 2, 3, 2, 7, 7, 7, 7, 0],
                            [0, 2, 3, 7, 7, 7, 6, 6, 0],
                            [0, 1, 1, 5, 7, 7, 7, 7, 0],
                            [0, 2, 3, 2, 7, 7, 7, 7, 0],
                            [0, 2, 3, 7, 7, 7, 6, 6, 0],
                            [0, 1, 1, 5, 7, 7, 7, 7, 0],
                            [0, 2, 3, 2, 7, 7, 7, 7, 0],
                            [0, 2, 3, 7, 7, 7, 6, 6, 0],
                        ];

                        tank.stats.stat_investments =
                            potential_investments[randi!(0, potential_investments.len() - 1)];
                        // tank.identity_idx = identity_idx;

                        tank.score = get_score_from_level(22);
                        tank.update_level(22);

                        self.bots[idx] = tank.privilege.clone();

                        bot_count += 1;
                    }
                } else if !found_all_wanted && should_set_found_all_wanted && self.config.bot_count != bot_count { 
                    found_all_wanted = true;
                    counter -= 1;
                }
            }
        }
        // let shape_respawn_mspt = start.elapsed().as_micros();

        // LOG ALL MSPTS
        self.mspt = time.elapsed().as_millis_f32();
        // println!("\n\n\nTank MSPT: {}\nShape MSPT: {}\nProjectile MSPT: {}\nClan MSPT:
        // {}\nCollision MSPT {}\nShape Respawn MSPT {}\n\nTOTAL MSPT: {}\n\n\n", tank_mspt,
        // shape_mspt, projectile_mspt, clan_mspt, collision_mspt, shape_respawn_mspt, self.mspt);

        // println!("Time elapsed: {:?}", time.elapsed());
    }
}
