use bytes::Bytes;
use rand::Rng;
use std::{
    borrow::Borrow,
    cell::RefCell,
    sync::Arc,
};
use strum::EnumCount;
use tokio::sync::Mutex;

use crate::{
    connection::wss::{
        self,
        on_close,
    },
    constrain,
    debug,
    error,
    game::{
        entity::{
            self,
            base_entity::{
                GenericEntity,
                GenericEntityHelpers,
            },
            components::entity_identity::get_score_from_level,
            tank_entity::{
                PrivilegeLevel,
                TankEntity,
            },
        },
        server::{
            ClanInfo,
            EntityDataStructure,
            GameMode,
            GameServer,
            GameServerConfig,
        },
    },
    physics::vec2::Vec2,
    randi,
    utils::{
        self, config::{
            self,
            BASE_TANK_RADIUS,
            BUILD_ID,
            LEADER_ARROW_VIEW,
        }, inputs::InputFlags, stream::SwiftStream, timed_mutex::AsyncTimedLock
    },
};

use super::wss::WebSocketClient;

/// An enum representing the clientbound packets.
#[derive(Clone, Copy)]
pub enum ClientBound
{
    Update,
    Stat,
    Upgrades,
    Notification,
    ServerInfo,
    Cipher,
    EloChange,
    Pong,
}

/// An enum representing the serverbound packets.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ServerBound
{
    Spawn,
    Input,
    Stat,
    Upgrades,
    Chat,
    Ping,
    Clan,
    ArenaUpdate,
    Ready,
}

/// The type of command being executed.
#[derive(Debug, PartialEq)]
pub enum CommandExecution
{
    Nil,
    Login(PrivilegeLevel),
    Invisible,
    GodMode,
    Remove(u32, bool),
    SetScore(u32, f32),
    Broadcast(String)
}

/// The opcode for the Clan packet.
#[derive(PartialEq)]
pub enum ClanIncomingPacketType
{
    Create(String),
    Join(usize),
    Leave(),
    AcceptDecline(u32, bool),
    Kick(u32),
    Distress(),
}

impl TryInto<ServerBound> for u8
{
    type Error = ();

    fn try_into(self) -> Result<ServerBound, Self::Error>
    {
        match self {
            0x0 => Ok(ServerBound::Spawn),
            0x1 => Ok(ServerBound::Input),
            0x2 => Ok(ServerBound::Stat),
            0x3 => Ok(ServerBound::Upgrades),
            0x4 => Ok(ServerBound::Chat),
            0x5 => Ok(ServerBound::Ping),
            0x6 => Ok(ServerBound::Clan),
            0x7 => Ok(ServerBound::ArenaUpdate),
            0x8 => Ok(ServerBound::Ready),
            _ => Err(()),
        }
    }
}

/// An enum representing tank upgrade stats.
#[derive(strum::EnumCount, Debug, Clone, Copy, Eq, PartialEq, Hash)]
pub enum UpgradeStats
{
    HealthRegen,
    MaxHealth,
    BodyDamage,
    ProjectileSpeed,
    ProjectilePenetration,
    ProjectileDamage,
    ProjectileReload,
    MovementSpeed,
    Fov,
}

impl TryInto<UpgradeStats> for u8
{
    type Error = ();

    fn try_into(self) -> Result<UpgradeStats, Self::Error>
    {
        match self {
            0x0 => Ok(UpgradeStats::HealthRegen),
            0x1 => Ok(UpgradeStats::MaxHealth),
            0x2 => Ok(UpgradeStats::BodyDamage),
            0x3 => Ok(UpgradeStats::ProjectileSpeed),
            0x4 => Ok(UpgradeStats::ProjectilePenetration),
            0x5 => Ok(UpgradeStats::ProjectileDamage),
            0x6 => Ok(UpgradeStats::ProjectileReload),
            0x7 => Ok(UpgradeStats::MovementSpeed),
            0x8 => Ok(UpgradeStats::Fov),
            _ => Err(()),
        }
    }
}

/// An enum representing census properties.
#[derive(strum::EnumCount, strum::EnumIter, Clone, Copy, Eq, PartialEq, Hash)]
pub enum CensusProperties
{
    Position,
    Velocity,
    Angle,
    Radius,
    Health,
    MaxHealth,
    Alive,
    IdentityId,
    Ticks,
    Clan,

    // TANK ONLY
    Name,
    Fov,
    Score,
    Invincible,
    Invisible,
    Turrets,
    Message,
    Ready,

    // SHAPE ONLY
    ShapeType,
    Shiny,

    // PROJECTILE ONLY
    Owner,
    Turret,
    ProjectileType,
}

/// An enum representing input values.
#[derive(Debug, PartialEq, Clone, Copy)]
pub enum Inputs
{
    Shoot = 0b1,
    Up = 0b10,
    Down = 0b100,
    Left = 0b1000,
    Right = 0b10000,
    Repel = 0b100000,
    LevelUp = 0b1000000,
    SwitchTank = 0b10000000,
    GodMode = 0b100000000,
    Suicide = 0b1000000000,
}

pub fn parse_spawn_packet(stream: &mut SwiftStream) -> Result<(String, String, u32), bool>
{
    let build_version = match stream.read_varuint() {
        Ok(v) => {
            if v != config::BUILD_ID {
                return Err(false);
            } else {
                v
            }
        }
        Err(_) => return Err(true),
    };

    let name = stream.read_string_safe(config::MAX_NICKNAME_LENGTH, false, true)?;
    let fingerprint = stream.read_string_safe(config::MAX_FINGERPRINT_LENGTH, true, true)?;

    let left_garbage = BUILD_ID / 2;
    for _ in 0..left_garbage {
        if stream.read_u8().is_err() {
            return Err(true);
        }
    }

    let cipher = match stream.read_u32() {
        Ok(v) => {
            if v == 0 {
                return Err(true);
            }

            v
        }
        Err(_) => return Err(true),
    };

    Ok((name, fingerprint, cipher))
}

pub fn parse_input_packet(
    stream: &mut SwiftStream,
) -> Result<(InputFlags, Vec2), bool>
{
    let flags = match stream.read_varuint() {
        Ok(v) => v,
        Err(_) => return Err(true),
    };

    let mouse_x = match stream.read_f32() {
        Ok(v) => v,
        Err(_) => return Err(true),
    };

    let mouse_y = match stream.read_f32() {
        Ok(v) => v,
        Err(_) => return Err(true),
    };

    let inputs = InputFlags::new(flags);

    Ok((
        inputs,
        Vec2::new(mouse_x, mouse_y),
    ))
}

pub fn parse_stat_packet(stream: &mut SwiftStream) -> Result<UpgradeStats, bool>
{
    let stat = match stream.read_u8() {
        Ok(v) => v,
        Err(_) => return Err(true),
    };

    let upgrade: Result<UpgradeStats, ()> = stat.try_into();
    if let Ok(upgrade) = upgrade {
        Ok(upgrade)
    } else {
        Err(true)
    }
}

pub fn parse_upgrades_packet(stream: &mut SwiftStream) -> Result<usize, bool>
{
    let upgrade = match stream.read_u8() {
        Ok(v) => v,
        Err(_) => return Err(true),
    };

    Ok(upgrade as usize)
}

pub fn parse_chat_packet(stream: &mut SwiftStream) -> Result<String, bool>
{
    let message_length = match stream.read_varuint() {
        Ok(v) => {
            if v > config::MAX_MESSAGE_LENGTH {
                return Err(true);
            } else {
                v
            }
        }
        Err(_) => return Err(true),
    };

    if message_length == 0 {
        return Ok(String::new());
    }

    let message = match stream.read_string(message_length as usize) {
        Ok(v) => v,
        Err(_) => return Err(true),
    };

    Ok(message)
}

pub fn parse_command(message: &str) -> CommandExecution
{
    if !message.starts_with('/') {
        return CommandExecution::Nil;
    }

    let mut args = message.split_whitespace();
    let command = args.next().unwrap_or("");

    match command {
        "/login" => {
            let password = args.next().unwrap_or("");

            if config::TOKEN_HASHES[0] == password {
                return CommandExecution::Login(PrivilegeLevel::Moderator);
            } else if config::TOKEN_HASHES[1] == password {
                return CommandExecution::Login(PrivilegeLevel::Developer);
            }

            CommandExecution::Nil
        }
        "/logout" => CommandExecution::Login(PrivilegeLevel::Player),
        "/godmode" => CommandExecution::GodMode,
        "/invisible" => CommandExecution::Invisible,
        "/kick" => {
            let id = args.next().unwrap_or("").parse::<u32>();
            if let Ok(id) = id {
                CommandExecution::Remove(id, false)
            } else {
                CommandExecution::Nil
            }
        }
        "/ban" => {
            let id = args.next().unwrap_or("").parse::<u32>();
            if let Ok(id) = id {
                CommandExecution::Remove(id, true)
            } else {
                CommandExecution::Nil
            }
        },
        "/set_score" => {
            let id = args.next().unwrap_or("").parse::<u32>();
            let score = args.next().unwrap_or("").parse::<f32>();
            if let Ok(id) = id && let Ok(score) = score {
                CommandExecution::SetScore(id, score)
            } else {
                CommandExecution::Nil
            }
        },
        "/broadcast" => {
            if let Some(msg) = args.remainder() {
                CommandExecution::Broadcast(msg.to_string())
            } else {
                CommandExecution::Nil
            }
        },
        _ => CommandExecution::Nil,
    }
}

pub fn parse_clan_packet(stream: &mut SwiftStream) -> Result<ClanIncomingPacketType, bool>
{
    let clan_type: ClanIncomingPacketType = match stream.read_u8() {
        Ok(v) => {
            match v {
                0 => {
                    let name_length = match stream.read_varuint() {
                        Ok(v) => {
                            if v == 0 || v > config::MAX_CLAN_NAME_LENGTH {
                                return Err(true);
                            } else {
                                v
                            }
                        }
                        Err(_) => return Err(true),
                    };

                    let name = match stream.read_string(name_length as usize) {
                        Ok(v) => v,
                        Err(_) => return Err(true),
                    };

                    ClanIncomingPacketType::Create(name)
                }
                1 => {
                    let clan_id = match stream.read_u8() {
                        Ok(v) => v,
                        Err(_) => return Err(true),
                    };

                    ClanIncomingPacketType::Join(clan_id as usize)
                }
                2 => ClanIncomingPacketType::Leave(),
                3 => {
                    let member_id = match stream.read_u32() {
                        Ok(v) => v,
                        Err(_) => return Err(true),
                    };

                    let accept: bool = match stream.read_u8() {
                        Ok(v) => v != 0,
                        Err(_) => return Err(true),
                    };

                    ClanIncomingPacketType::AcceptDecline(member_id, accept)
                }
                4 => {
                    let member_id = match stream.read_u32() {
                        Ok(v) => v,
                        Err(_) => return Err(true),
                    };

                    ClanIncomingPacketType::Kick(member_id)
                }
                5 => ClanIncomingPacketType::Distress(),
                _ => return Err(true),
            }
            // if v == 0 { ClanOutgoingPacketType::Create }
            // else if v == 1 { ClanOutgoingPacketType::Join }
            // else if v == 2 { ClanOutgoingPacketType::Leave }
            // else if v == 3 { ClanOutgoingPacketType::AcceptDecline }
            // else if v == 4 { ClanOutgoingPacketType::Kick }
            // else { return Err(true) }
        }
        Err(_) => return Err(true),
    };

    Ok(clan_type)
}

pub fn parse_arena_update_packet(
    stream: &mut SwiftStream,
    old_config: &GameServerConfig,
) -> Result<GameServerConfig, bool>
{
    let arena_size = match stream.read_f32() {
        Ok(v) => v,
        Err(_) => return Err(true),
    };

    let wanted_shape_count = match stream.read_u32() {
        Ok(v) => v,
        Err(_) => return Err(true),
    };

    let number_of_bots = match stream.read_u8() {
        Ok(v) => v,
        Err(_) => return Err(true),
    };

    let disable_level_up: bool = match stream.read_u8() {
        Ok(v) => v == 0,
        Err(_) => return Err(true),
    };

    let disable_switch_tank: bool = match stream.read_u8() {
        Ok(v) => v == 0,
        Err(_) => return Err(true),
    };

    let disable_god_mode: bool = match stream.read_u8() {
        Ok(v) => v == 0,
        Err(_) => return Err(true),
    };

    let last_man_standing: bool = match stream.read_u8() {
        Ok(v) => v != 0,
        Err(_) => return Err(true),
    };

    let private: bool = match stream.read_u8() {
        Ok(v) => v != 0,
        Err(_) => return Err(true),
    };

    let mut disabled_flags = Vec::new();
    if disable_level_up {
        disabled_flags.push(Inputs::LevelUp);
    }
    if disable_switch_tank {
        disabled_flags.push(Inputs::SwitchTank);
    }
    if disable_god_mode {
        disabled_flags.push(Inputs::GodMode);
    }

    Ok(GameServerConfig {
        arena_size,
        wanted_shape_count,
        disabled_flags,
        private,
        game_mode: if last_man_standing {
            GameMode::LastManStanding
        } else {
            old_config.game_mode.clone()
        },
        max_players: old_config.max_players,
        allowed_uids: old_config.allowed_uids.clone(),
        // bot_count: number_of_bots
        bot_count: old_config.bot_count,
    })
}

pub fn form_update_packet(
    self_entity: &mut TankEntity,
    entities: &EntityDataStructure,
    clans: &mut [Option<ClanInfo>],
    config: &GameServerConfig,
    cipher: u32,
) -> Bytes
{
    let mut stream: SwiftStream = SwiftStream::with_capacity(2048, cipher);

    // Store the top 10 players in terms of score.
    let mut top_tanks: Vec<(f32, String, u32, u8)> = Vec::with_capacity(100);
    if self_entity.base_entity.alive {
        let score = if let GameMode::Ranked(_) = config.game_mode {
            self_entity.score_1v1 as f32
        } else {
            self_entity.score
        };
        top_tanks.push((
            score,
            self_entity.name.clone(),
            self_entity.base_entity.id,
            self_entity.base_entity.identity.id,
        ));
    }

    stream.write_u8(ClientBound::Update as u8); // Write header.

    // Write information for the game server.
    stream.write_f32(config.arena_size);
    stream.write_u32(config.wanted_shape_count);

    // Write updates for self.
    stream.write_u32(self_entity.base_entity.id);
    self_entity.take_self_census(&mut stream);

    stream.write_u32(self_entity.surroundings.len() as u32);
    for (id, entity) in entities.iter() {
        if *id == self_entity.base_entity.id {
            continue;
        }

        let entity: &GenericEntity = &*entity.borrow();

        if entity.as_int() == -1 {
            continue;
        }

        if entity.get_base_entity().alive {
            if let GenericEntity::Tank(tank) = entity {
                let score = if let GameMode::Ranked(_) = config.game_mode {
                    tank.score_1v1 as f32
                } else {
                    tank.score
                };
                top_tanks.push((
                    score,
                    tank.name.clone(),
                    tank.get_base_entity().id,
                    tank.get_base_entity().identity.id,
                ));
            }
        };

        if self_entity.surroundings.contains(id) {
            stream.write_u32(*id);
            stream.write_u8(GenericEntity::as_int(entity) as u8);

            entity.take_census(&mut stream);
        }
    }

    // Write scoreboard and leader information.
    top_tanks.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap());
    top_tanks.truncate(10);

    let normalised_view = LEADER_ARROW_VIEW * self_entity.fov;

    'block: {
        if !(matches!(config.game_mode, GameMode::Ranked(_))
            || top_tanks.is_empty()
            || self_entity.base_entity.id == top_tanks[0].2)
        {
            let leader = &*entities.get(&top_tanks[0].2).unwrap().borrow();
            if leader
                .get_base_entity()
                .position
                .distance(self_entity.base_entity.position)
                > normalised_view
            {
                stream.write_f32(
                    self_entity
                        .base_entity
                        .position
                        .angle(Some(leader.get_base_entity().position)),
                );
                break 'block;
            }
        }

        stream.write_f32(0xc8 as f32); // "random" number outside of bounds [-6.28, 6.28]
    }

    stream.write_u8(top_tanks.len() as u8);
    for (score, name, id, identity) in top_tanks.iter() {
        stream.write_f32(*score);
        stream.write_string(name);
        stream.write_u32(*id);
        stream.write_u8(*identity);
    }

    stream.write_u8(clans.iter().flatten().count() as u8);
    for clan in clans.iter_mut().flatten() {
        stream.write_u8(clan.id);
        stream.write_string(&clan.name);
        stream.write_u32(clan.owner);

        stream.write_u32(clan.members.len() as u32);
        for member in clan.members.iter() {
            stream.write_u32(*member);

            if *member == self_entity.base_entity.id {
                stream.write_string(&self_entity.name);
                stream.write_f32(self_entity.base_entity.position.x);
                stream.write_f32(self_entity.base_entity.position.y);
                stream.write_u8(if self_entity.distressed { 1 } else { 0 });
                stream.write_u8(if self_entity.leaving { 1 } else { 0 });
            } else if let Some(tank) = entities.get(member)
                && let GenericEntity::Tank(tank) = &*tank.borrow()
            {
                stream.write_string(&tank.name);
                stream.write_f32(tank.base_entity.position.x);
                stream.write_f32(tank.base_entity.position.y);
                stream.write_u8(if tank.distressed { 1 } else { 0 });
                stream.write_u8(if tank.leaving { 1 } else { 0 });
            } else {
                eprintln!("This should never happen...");
                stream.write_string("");
                stream.write_f32(0.0);
                stream.write_f32(0.0);
                stream.write_u8(0);
                stream.write_u8(0);
            }
        }

        stream.write_u32(clan.pending_members.len() as u32);
        for pending_member in clan.pending_members.iter() {
            stream.write_u32(*pending_member);

            if *pending_member == self_entity.base_entity.id {
                stream.write_string(&self_entity.name);
            } else if let Some(tank) = entities.get(pending_member)
                && let GenericEntity::Tank(tank) = &*tank.borrow()
            {
                stream.write_string(&tank.name);
            } else {
                stream.write_string("");
            }
        }
    }

    stream.transcode();
    stream.move_data().freeze()
}

pub fn form_stat_packet(entity: &mut TankEntity, cipher: u32) -> Bytes
{
    let mut stream: SwiftStream =
        SwiftStream::with_capacity(1 + 1 + 1 + (UpgradeStats::COUNT * 2), cipher); // header + available_stats

    stream.write_u8(ClientBound::Stat as u8); // Write header.

    // Write number of available stat points.
    stream.write_u8(entity.stats.available_stat_points);

    // Write current stat investments.
    stream.write_u8(UpgradeStats::COUNT as u8);

    for i in 0..UpgradeStats::COUNT {
        stream.write_u8(entity.stats.stat_investments[i]);
        stream.write_u8(entity.stats.max_stat_investments[i]);
    }

    stream.transcode();
    stream.move_data().freeze()
}

pub fn form_upgrade_packet(entity: &mut TankEntity, cipher: u32) -> Bytes
{
    let mut stream: SwiftStream = SwiftStream::with_capacity(1 + 1 + entity.upgrades.len(), cipher);

    stream.write_u8(ClientBound::Upgrades as u8); // Write header.

    // Write number of available upgrades.
    stream.write_u8(entity.upgrades.len() as u8);

    for upgrade in entity.upgrades.iter() {
        stream.write_u8(*upgrade);
    }

    stream.transcode();
    stream.move_data().freeze()
}

pub fn form_notification_packet(message: String, rgb: [u8; 3], cipher: u32) -> Bytes
{
    let mut stream: SwiftStream = SwiftStream::with_capacity(1 + message.len() + 3, cipher);

    stream.write_u8(ClientBound::Notification as u8); // Write header.
    stream.write_string(&message);
    stream.write_u8(rgb[0]);
    stream.write_u8(rgb[1]);
    stream.write_u8(rgb[2]);

    stream.transcode();
    stream.move_data().freeze()
}

pub fn form_server_info_packet(server_count: u32, total_count: u32, mspt: f32, cipher: u32)
    -> Bytes
{
    let mut stream: SwiftStream = SwiftStream::with_capacity(1 + 8, cipher);

    stream.write_u8(ClientBound::ServerInfo as u8); // Write header.
    stream.write_u32(server_count);
    stream.write_u32(total_count);
    stream.write_f32(mspt);

    stream.transcode();
    stream.move_data().freeze()
}

pub fn form_cipher_packet(cipher: u32) -> Bytes
{
    let mut stream: SwiftStream = SwiftStream::with_capacity(1 + BUILD_ID as usize + 1, cipher);

    stream.write_u8(ClientBound::Cipher as u8); // Write header.

    let left = BUILD_ID / 2;
    for _ in 0..left {
        stream.write_u8(randi!(1, 255));
    }

    stream.write_u32(cipher);

    let right = BUILD_ID - left;
    for _ in 0..right {
        stream.write_u8(randi!(1, 255));
    }

    stream.move_data().freeze()
}

pub fn form_elo_change_packet(
    cipher: u32,
    player_old: f32,
    player_new: f32,
    opponent_old: f32,
    opponent_new: f32,
) -> Bytes
{
    let mut stream: SwiftStream = SwiftStream::with_capacity(5, cipher);

    stream.write_u8(ClientBound::EloChange as u8); // Write header.
    stream.write_f32(player_old);
    stream.write_f32(player_new);
    stream.write_f32(opponent_old);
    stream.write_f32(opponent_new);

    stream.transcode();
    stream.move_data().freeze()
}

// pub async fn send_debug_packet(entity: &mut TankEntity, game_server: &GameServer)
// {
//     let mut stream: SwiftStream = SwiftStream::with_capacity(32);

//     stream.write_u8(0xFF); // Write header.

//     stream.write_u8(entity.surroundings.len() as u8);
//     for e in entity.surroundings.iter()
//     {
//         let e = &game_server.entities[*e as usize].as_ref().unwrap();
//         let entity = e.lock_with_timeout(None).await;

//         let base_entity = entity.get_base_entity();
//         stream.write_f32(base_entity.position.x);
//         stream.write_f32(base_entity.position.y);
//     }

//     // Send packet.
//     let mut ws = entity.ws_client.lock_with_timeout(None).await;
//     let mut session = ws.session.lock_with_timeout(None).await;

//     session.binary(stream.move_data()).await;
// }
