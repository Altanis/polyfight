use axum::extract::ws::Message;
use bytes::Bytes;
use eliza::Eliza;
use futures_util::SinkExt;
use std::{
    borrow::Borrow,
    cell::RefCell,
    collections::HashMap,
    sync::{
        Arc,
        Weak,
    },
    time::Instant,
};
use strum::{
    EnumCount,
    IntoEnumIterator,
};
use tokio::{
    net::tcp::OwnedReadHalf,
    sync::Mutex as AsyncMutex,
};

use crate::{
    connection::{
        apis::UserData,
        packets::{
            self, form_notification_packet, CensusProperties, Inputs, UpgradeStats
        },
        wss::{
            self,
            on_close,
            WebSocketClient,
        },
    }, constrain, debug, error, game::server::{
        ClanInfo,
        EntityDataStructure,
        GameMode,
        GameServer,
        GameServerConfig,
    }, lerp, lerp_angle, normalise_angle, physics::{
        collision,
        shg::SpatialHashGrid,
        vec2::{
            Circle,
            Ray,
            Vec2,
        },
    }, randf, randi, seconds_to_ticks, server::{
        Server,
        WebSocketServer,
    }, utils::{
        self, config::{
            self,
            AI_VIEW,
            BASE_TANK_RADIUS,
            DISCONNECT_TIMEOUT,
            MAX_CLANS,
        }, inputs::InputFlags, stream::SwiftStream, timed_mutex::AsyncTimedLock
    }
};

use super::{
    ai::{
        AIState, TankBot, AI
    },
    base_entity::{
        self,
        BaseEntity,
        GenericEntity,
        GenericEntityHelpers,
    },
    components::{
        entity_identity::{
            self,
            get_score_from_level,
            get_square_identity,
            EntityIdentity,
            EntityIdentityIds,
            TankCategories,
            LEVEL_TO_SCORE_TABLE,
        },
        turret::Turret,
    },
    projectile_entity::{
        ProjectileConstructionInfo,
        ProjectileEntity,
        ProjectileType,
    },
    shape_entity::{NecromancerDrone, ShapeType},
};
use rand::Rng;

/// A struct representing the tank's stats.
#[derive(Debug, Clone)]
pub struct StatsInfo
{
    /// The stat points available to the tank.
    pub available_stat_points: u8,
    /// The stat investments of the tank.
    pub stat_investments: [u8; UpgradeStats::COUNT],
    /// The max stat investments of each stat.
    pub max_stat_investments: [u8; UpgradeStats::COUNT],
}

#[derive(Debug, Clone, PartialEq, PartialOrd, strum::Display)]
pub enum DeadType {
    NotDead,
    WantsRespawn,
    Inactive
}

#[derive(Debug, Clone, PartialEq)]
pub struct Chatbot {
    /// The underlying ELIZA instance.
    pub eliza: Eliza,
    /// The typing time.
    pub typing_time: u32,
    /// The generated response.
    pub response: String,
    /// The thing to reply to.
    pub reply_to: String,
    /// Whether or not the message has sent.
    pub sent: bool,
}

impl Default for Chatbot {
    fn default() -> Self {
        Chatbot {
            eliza: Eliza::from_file("script.json").unwrap(),
            typing_time: 0,
            response: String::new(),
            reply_to: String::new(),
            sent: false,
        }
    }
}


#[derive(Debug, Clone, PartialEq, strum::Display)]
pub enum PrivilegeLevel
{
    Bot
    {
        target_angle: f32,
        roam_pos: Vec2,
        randomness: f32,
        aim: f32,
        old_respawn: u32,
        respawn: u32,
        identities: [EntityIdentity; 3],
        name: String,
        ai: AI,
        dead: DeadType,
        idx: usize,
        id: u32,
        stupid: bool,
        chatbot: Box<Chatbot>
    },
    Player,
    Host,
    Moderator,
    Developer,
}

impl From<PrivilegeLevel> for u8
{
    fn from(privilege: PrivilegeLevel) -> u8
    {
        match privilege {
            PrivilegeLevel::Bot { .. } => 0,
            PrivilegeLevel::Player => 1,
            PrivilegeLevel::Host => 2,
            PrivilegeLevel::Moderator => 3,
            PrivilegeLevel::Developer => 4,
        }
    }
}

/// A class representing a generic entity.
#[derive(Debug)]
pub struct TankEntity
{
    pub base_entity: BaseEntity,
    pub name: String,

    pub score: f32,
    pub level: u8,

    pub stats: StatsInfo,
    pub send_stat_info: bool,

    /// The tanks the entity is able to upgrade into.
    pub upgrades: Vec<u8>,
    pub send_upgrades_info: bool,

    /// The reload time of the tank.
    pub reload_time: f32,

    pub fov: f32,
    pub surroundings: Vec<u32>,

    /// The tick at which the tank spawned.
    pub spawning_tick: u32,
    pub spawning: bool,
    pub moved: bool,

    /// The last time a ping was sent.
    pub last_ping: u32,

    /// The turret last used to shoot.
    pub last_shooting_cycle: u8,

    /// The entity the auto turrets are aiming at.
    pub target: Option<u32>,

    /// A vector of notification packets.
    pub notifications: Vec<(String, [u8; 3])>,
    /// A vector of raw-byte packets to send.
    pub packets: Vec<Bytes>,

    /// The messages the player is currently saying.
    pub messages: Vec<(String, u32)>,
    /// Whether or not the player is typing.
    pub typing: bool,

    /// Input flags
    pub inputs: InputFlags,
    /// The angle for zooming translation.
    pub zoom_translation: f32,
    /// The position the FoV is at (if locked).
    pub fov_pos: Vec2,

    /// The entity which killed the tank.
    pub killer: Option<u32>,

    /// The opacity of the tank.
    pub opacity: f32,

    pub ws_id: isize,

    /// Whether or not the the tank is sending a distress signal.
    pub distressed: bool,
    /// Whether or not the player is leaving the clan.
    pub leaving: bool,
    /// The timestamp at which the player tried to leave.
    pub leave_timestamp: Instant,

    /// The hardware fingerprint of the player.
    pub fingerprint: String,
    /// The Google ID of the player.
    pub uid: String,
    /// Whether or not the player is privileged.
    pub privilege: PrivilegeLevel,

    /// The opponent in 1v1 mode.
    pub opponent: Option<u32>,
    /// Whether the player is ready to 1v1.
    pub ready: bool,
    /// The score in 1v1 mode.
    pub score_1v1: u8,
    /// The index of identities the player has.
    pub identity_idx: usize,

    pub is_in_1v1: bool,
    pub start_1v1_time: u32,

    pub last_switch: u32,
    pub last_god_mode: u32,
}

impl GenericEntityHelpers for TankEntity
{
    fn get_base_entity(&self) -> &BaseEntity
    {
        &self.base_entity
    }

    fn get_mut_base_entity(&mut self) -> &mut BaseEntity
    {
        &mut self.base_entity
    }

    /// Handles a collision with another entity.
    fn handle_collision(entity1: &mut GenericEntity, entity2: &mut GenericEntity)
    {
        let base_entity = entity1.get_mut_base_entity();
        let entity = entity2.get_mut_base_entity();

        // if !base_entity.alive || !entity.alive
        // {
        //     return;
        // }

        let mut self_died = false;
        let mut other_died = false;

        // let mut reduction = 1.0;
        // {
        //     if let GenericEntity::Projectile(_) = entity2
        //     {
        //         reduction = 1.0;
        //     };
        // }

        {
            if base_entity.owned_entities.contains(&entity.id) {
                return;
            }

            base_entity.health -= entity.damage_exertion;
            entity.health -= base_entity.damage_exertion;

            base_entity.last_damage_tick = base_entity.ticks;
            entity.last_damage_tick = entity.ticks;

            if base_entity.health <= 0.0 {
                self_died = true;
            }

            if entity.health <= 0.0 {
                other_died = true;
            }
        }

        if self_died {
            entity1.kill(entity2);
        }

        if other_died {
            entity2.kill(entity1);
        }
    }

    fn take_census(&self, stream: &mut SwiftStream)
    {
        if !self.base_entity.alive || self.opacity <= 0.0 {
            stream.write_u8(0);
            return;
        }

        stream.write_u8(18); // REPLACE WHEN NEEDED.
        for property in CensusProperties::iter() {
            stream.write_u8(property as u8);

            match property {
                CensusProperties::Position => {
                    stream.write_f32(self.base_entity.position.x);
                    stream.write_f32(self.base_entity.position.y);
                }
                CensusProperties::Velocity => {
                    stream.write_f32(self.base_entity.velocity.x);
                    stream.write_f32(self.base_entity.velocity.y);
                }
                CensusProperties::Angle => stream.write_f32(self.base_entity.angle),
                CensusProperties::Radius => stream.write_f32(self.base_entity.radius),
                CensusProperties::Health => stream.write_f32(self.base_entity.health),
                CensusProperties::MaxHealth => stream.write_f32(self.base_entity.max_health),
                CensusProperties::Alive => {
                    if self.base_entity.alive {
                        stream.write_u8(1);
                    } else {
                        stream.write_u8(0);
                        stream.write_u32(self.killer.unwrap());
                    }
                }
                CensusProperties::IdentityId => stream.write_u8(self.base_entity.identity.id),
                CensusProperties::Ticks => stream.write_u32(self.base_entity.ticks),
                CensusProperties::Clan => {
                    if let Some(clan) = self.base_entity.clan {
                        stream.write_u8(clan);
                    } else {
                        stream.write_u8(MAX_CLANS + 1);
                    }
                }
                CensusProperties::Name => stream.write_string(&self.name),
                CensusProperties::Score => stream.write_f32(self.score),
                CensusProperties::Fov => stream.write_f32(self.fov),
                CensusProperties::Invincible => stream.write_u8(
                    (self.spawning
                        || self.base_entity.invincible
                        || self.base_entity.force_invincible) as u8,
                ),
                CensusProperties::Invisible => stream.write_f32(self.opacity),
                CensusProperties::Turrets => {
                    let filtered_turrets: Vec<&Turret> = self
                        .base_entity
                        .identity
                        .turrets
                        .iter()
                        .filter(|turret| turret.projectile_type == ProjectileType::AutoBullet)
                        .collect();

                    stream.write_u8(filtered_turrets.len() as u8);
                    for turret in filtered_turrets {
                        stream.write_f32(turret.angle);
                    }
                }
                CensusProperties::Message => {
                    stream.write_u8(self.typing as u8);
                    stream.write_u8(self.messages.len() as u8);
                    for (message, _) in &self.messages {
                        stream.write_string(message);
                    }
                },
                CensusProperties::Ready => stream.write_u8(self.ready as u8),
                _ => stream.backspace(1),
            }
        }
    }

    fn kill(&mut self, killer: &mut GenericEntity)
    {
        if !self.base_entity.alive {
            return;
        }

        self.base_entity.alive = false;
        self.killer = Some(killer.get_base_entity().id);

        let score = constrain!(
            0.0,
            self.score,
            get_score_from_level(LEVEL_TO_SCORE_TABLE.len() as u8)
        );

        match killer {
            GenericEntity::Tank(t) => {
                t.score += score;
                t.notifications
                    .push((format!("You've killed {}!", self.name), [0, 0, 0]));
            }
            // GenericEntity::Shape(s) => s.base_entity.identity.score_yield += score,
            GenericEntity::Projectile(p) => {
                p.score_gained += score;
                p.killed_player_name = Some(self.name.clone());
            }
            _ => (),
        }
    }
}

impl TankEntity
{
    pub fn new(
        game_server: &mut GameServer,
        ws_id: isize,
        name: String,
        fingerprint: String,
        uid: String,
        radius: f32,
        is_host: bool,
    ) -> u32
    {
        let mut base_entity = BaseEntity::new(
            game_server,
            radius,
            entity_identity::get_basic_tank_identity(),
        );
        let id = base_entity.id;
        let position = base_entity.position;
        let radius = base_entity.radius;
        let tick = base_entity.ticks;
        let base_fov = base_entity.identity.base_fov;

        let wrapped_generic_entity = GenericEntity::Tank(TankEntity {
            base_entity,
            name,
            score: 0.0,
            level: 1,
            stats: StatsInfo {
                available_stat_points: 0,
                stat_investments: [0; UpgradeStats::COUNT],
                max_stat_investments: [7; UpgradeStats::COUNT],
            },
            send_stat_info: true,
            upgrades: Vec::new(),
            send_upgrades_info: false,
            reload_time: 15.0,
            fov: base_fov,
            surroundings: Vec::new(),
            spawning_tick: tick,
            spawning: true,
            moved: false,
            last_ping: 0,
            last_shooting_cycle: 0,
            target: None,
            notifications: Vec::new(),
            packets: Vec::new(),
            messages: Vec::new(),
            typing: false,
            inputs: InputFlags::new(0),
            zoom_translation: 0.0,
            fov_pos: Vec2::default(),
            killer: None,
            opacity: 1.0,
            ws_id,
            distressed: false,
            leaving: false,
            leave_timestamp: Instant::now(),
            fingerprint,
            uid,
            privilege: if is_host {
                PrivilegeLevel::Host
            } else {
                PrivilegeLevel::Player
            },

            opponent: game_server
                .entities
                .iter()
                .find(|(i, entity)| {
                    **i != id || matches!(&*(**entity).borrow(), GenericEntity::Tank(_))
                })
                .map(|(id, _)| *id),
            ready: false,
            score_1v1: 0,
            identity_idx: 0,

            is_in_1v1: false,
            start_1v1_time: 0,

            last_switch: 0,
            last_god_mode: 0,
        });

        BaseEntity::add_to_game_server(game_server, wrapped_generic_entity, position, radius);

        id
    }

    /// Updates the level of the tank.
    pub fn update_level(&mut self, level: u8)
    {
        if (self.level == level || level > 45) {
            return;
        }
        self.level = level;

        let radius_scale_factor = 1.007_f32.powf((self.level - 1) as f32);

        self.base_entity.radius = BASE_TANK_RADIUS * radius_scale_factor;
        self.check_for_upgrades();
    }

    /// Checks for any available tank upgrades.
    pub fn check_for_upgrades(&mut self)
    {
        for upgrades in self.base_entity.identity.upgrades.clone() {
            let identity: EntityIdentity = upgrades.try_into().unwrap();
            if (self.level >= identity.level_requirement) && !self.upgrades.contains(&identity.id) {
                self.upgrades.push(identity.id);
                self.send_upgrades_info = true;
            }
        }
    }

    /// Takes a census from the perspective of the actual client.
    pub fn take_self_census(&self, stream: &mut SwiftStream)
    {
        stream.write_u8(18); // REPLACE WHEN NEEDED.
        for property in CensusProperties::iter() {
            stream.write_u8(property as u8);

            match property {
                CensusProperties::Position => {
                    stream.write_f32(self.base_entity.position.x);
                    stream.write_f32(self.base_entity.position.y);
                }
                CensusProperties::Velocity => {
                    stream.write_f32(self.base_entity.velocity.x);
                    stream.write_f32(self.base_entity.velocity.y);
                }
                CensusProperties::Angle => stream.write_f32(self.base_entity.angle),
                CensusProperties::Radius => stream.write_f32(self.base_entity.radius),
                CensusProperties::Health => stream.write_f32(self.base_entity.health),
                CensusProperties::MaxHealth => stream.write_f32(self.base_entity.max_health),
                CensusProperties::Alive => {
                    if self.base_entity.alive {
                        stream.write_u8(1);
                    } else {
                        stream.write_u8(0);
                        if let Some(k) = self.killer {
                            stream.write_u32(k);
                        } else {
                            stream.write_u32(0);
                        }
                    }
                }
                CensusProperties::IdentityId => stream.write_u8(self.base_entity.identity.id),
                CensusProperties::Ticks => stream.write_u32(self.base_entity.ticks),
                CensusProperties::Clan => {
                    if let Some(clan) = self.base_entity.clan {
                        stream.write_u8(clan);
                    } else {
                        stream.write_u8(MAX_CLANS + 1);
                    }
                }
                CensusProperties::Name => stream.write_string(&self.name),
                CensusProperties::Score => stream.write_f32(self.score),
                CensusProperties::Fov => stream.write_f32(self.fov),
                CensusProperties::Invincible => stream.write_u8(
                    (self.spawning
                        || self.base_entity.invincible
                        || self.base_entity.force_invincible) as u8,
                ),
                CensusProperties::Invisible => stream.write_f32(self.opacity),
                CensusProperties::Turrets => {
                    let filtered_turrets: Vec<&Turret> = self
                        .base_entity
                        .identity
                        .turrets
                        .iter()
                        .filter(|turret| turret.projectile_type == ProjectileType::AutoBullet)
                        .collect();

                    stream.write_u8(filtered_turrets.len() as u8);
                    for turret in filtered_turrets {
                        stream.write_f32(turret.angle);
                    }
                }
                CensusProperties::Message => {
                    stream.write_u8(self.typing as u8);
                    stream.write_u8(self.messages.len() as u8);
                    for (message, _) in &self.messages {
                        stream.write_string(message);
                    }
                },
                CensusProperties::Ready => stream.write_u8(self.ready as u8),
                _ => stream.backspace(1),
            }
        }
    }

    /// Moves the tank forward one frame in time.
    pub fn tick(
        &mut self,
        entities: &EntityDataStructure,
        shg: &mut SpatialHashGrid,
        clans: &mut Vec<Option<ClanInfo>>,
        config: &GameServerConfig,
        mspt: f32,
        ws_server: &mut WebSocketServer,
        dt: f32,
    ) -> (
        bool,
        Vec<u32>,
        Vec<ProjectileConstructionInfo>,
        bool,
        ((String, usize), (String, usize)),
    )
    {
        let mut close: bool = false;
        let ((mut win_uid, mut win_category_idx), (mut loss_uid, mut loss_category_idx)) =
            ((String::new(), 0), (String::new(), 0));
        let mut entity_deletions: Vec<u32> = Vec::new();
        let mut projectile_creations: Vec<ProjectileConstructionInfo> = Vec::new();

        let entity_identity_id: Result<EntityIdentityIds, ()> =
            self.base_entity.identity.id.try_into();
        self.base_entity.perform_collisions =
            entity_identity_id != Ok(EntityIdentityIds::Spectator);
        let is_battleship = entity_identity_id == Ok(EntityIdentityIds::Battleship);

        if self.base_entity.force_invincible
            && config.disabled_flags.contains(&packets::Inputs::GodMode)
            && !matches!(self.privilege, PrivilegeLevel::Developer)
        {
            self.base_entity.force_invincible = false;
        }

        let mut opponent_is_alive = false;

        if let Some(opponent) = self.opponent
            && let Some(opp) = entities.get(&opponent)
            && let GenericEntity::Tank(tank) = &mut *opp.borrow_mut()
        {
            opponent_is_alive = tank.base_entity.alive;
        }

        if let GameMode::Ranked(map) = &config.game_mode {
            let self_name = &map[&self.uid].user_data.name;
            if self.name != *self_name {
                self.name.clone_from(self_name);
            }

            if !self.is_in_1v1 {
                self.inputs.clear_flag(Inputs::Shoot);
                self.inputs.clear_flag(Inputs::Repel);
            }

            if self.spawning_tick + seconds_to_ticks!(30) as u32 == self.base_entity.ticks
                && !self.ready
            {
                self.notifications.push((
                    "You have 30 seconds to spawn and press the Ready checkbox.".to_string(),
                    [255, 0, 0],
                ));
            } else if self.spawning_tick + seconds_to_ticks!(120) as u32 == self.base_entity.ticks
                && !self.ready
            {
                self.notifications.push((
                    "You have automatically become ready.".to_string(),
                    [255, 0, 0],
                ));
                self.ready = true;
                self.start_1v1_time = self.base_entity.ticks;

                if let Some(opponent) = self.opponent
                    && let Some(opp) = entities.get(&opponent)
                    && let GenericEntity::Tank(tank) = &mut *opp.borrow_mut()
                {
                    tank.ready = true;
                    tank.start_1v1_time = tank.base_entity.ticks;
                }
            }

            if self.start_1v1_time == self.base_entity.ticks && self.start_1v1_time != 0 {
                self.notifications
                    .push(("The 1v1 has started!".to_string(), [255, 0, 0]));

                if self.base_entity.id > self.opponent.unwrap() {
                    self.base_entity.position = Vec2::new(0.0, 0.0);
                } else {
                    self.base_entity.position = Vec2::new(config.arena_size, config.arena_size);
                }

                self.is_in_1v1 = true;
                self.base_entity.clan = None;

                for (i, turret) in self.base_entity.identity.turrets.iter_mut().enumerate() {
                    if turret.max_projectile_count == -1 {
                        continue;
                    }

                    while turret.projectile_count < turret.max_projectile_count
                        && turret.max_projectile_count != -1
                    {
                        let reload_time = self.reload_time * turret.reload;

                        let speed = (turret.projectile_speed + 5.0 + (self.stats.stat_investments[UpgradeStats::ProjectileSpeed as usize] as f32) * 2.0) - randf!(0.0, 1.0) * turret.scatter_rate;

                        if turret.projectile_type == ProjectileType::Drone
                            || turret.projectile_type == ProjectileType::Minion
                        {
                            turret.projectile_count += 1;

                            let projectile_damage = turret.projectile_damage
                                * ((1.0_f32
                                    + self.stats.stat_investments
                                        [UpgradeStats::ProjectileDamage as usize]
                                        as f32)
                                    * 1.5);
                            let projectile_pentration = turret.projectile_penetration
                                * ((6.0_f32
                                    * self.stats.stat_investments
                                        [UpgradeStats::ProjectilePenetration as usize]
                                        as f32)
                                    + 4.0);
                            let radius = (turret.width / 2) as f32
                                * (self.base_entity.radius / BASE_TANK_RADIUS)
                                * turret.size_factor;

                            let scatter_angle = (std::f32::consts::PI / 180.0)
                                * turret.scatter_rate
                                * (randf!(0.0, 1.0) - 0.5)
                                * 10.0;
                            let projectile_angle =
                                self.base_entity.angle + turret.angle + scatter_angle;

                            let mut position = self.base_entity.position
                                + Vec2::from_polar(
                                    self.base_entity.radius + radius - 10.0,
                                    projectile_angle,
                                );
                            position.x -= (turret.x_offset
                                * (self.base_entity.radius / BASE_TANK_RADIUS))
                                * (projectile_angle).sin();
                            position.y += (turret.x_offset
                                * (self.base_entity.radius / BASE_TANK_RADIUS))
                                * (projectile_angle).cos();

                            let velocity = Vec2::from_polar(10.0, projectile_angle);

                            let prevented_drone_tank =
                                entity_identity_id == Ok(EntityIdentityIds::Hybrid);

                            let ai = AI::new(
                                self.base_entity.id,
                                !(is_battleship && (i % 2 == 0) || prevented_drone_tank),
                                true,
                                TankBot::Not,
                                |_, _, _, _| true,
                            );

                            projectile_creations.push(ProjectileConstructionInfo {
                                projectile_type: turret.projectile_type,
                                ai: Some(ai),
                                damage: projectile_damage,
                                penetration: projectile_pentration,
                                elasticity: turret.elasticity,
                                friction: turret.friction,
                                speed,
                                lifetime: turret.bullet_lifetime * 88.0,
                                pass_through_walls: false,
                                prevent_ai: false,
                                resurrected: false,
                                radius,
                                position,
                                velocity,
                                turret: (i as u8, 0),
                                minion_turret: if turret.projectile_type == ProjectileType::Minion {
                                    Some(turret.turrets[0].clone())
                                } else {
                                    None
                                },
                            });

                            // let id = ProjectileEntity::new(game_server, turret.projectile_type,
                            // Some(ai),     projectile_damage,
                            // projectile_pentration, turret.elasticity, turret.friction, speed,
                            // turret.bullet_lifetime * 88.0,
                            //      false, false, false,
                            //      radius, position, velocity, i as u8, if turret.projectile_type
                            // == ProjectileType::Minion { Some(turret.turrets[0].clone()) } else {
                            // None } ).await;

                            // projectile.get_mut_base_entity().owned_by.push(self.base_entity.id);
                            // projectile.get_mut_base_entity().clan = self.base_entity.clan;
                            // self.base_entity.owned_entities.push(id);
                            self.base_entity.velocity -=
                                Vec2::from_polar(turret.recoil, projectile_angle);
                        } else if turret.projectile_type == ProjectileType::NecromancerDrone {
                            turret.projectile_count += 1;

                            let speed = (turret.projectile_speed + 5.0 + (self.stats.stat_investments[UpgradeStats::ProjectileSpeed as usize] as f32) * 2.0) - randf!(0.0, 1.0) * turret.scatter_rate;

                            let damage = turret.projectile_damage
                                * ((1.0_f32
                                    + self.stats.stat_investments
                                        [UpgradeStats::ProjectileDamage as usize]
                                        as f32)
                                    * 1.25);
                            let penetration = turret.projectile_penetration
                                * ((6.0_f32
                                    * self.stats.stat_investments
                                        [UpgradeStats::ProjectilePenetration as usize]
                                        as f32)
                                    + 4.0);
                            let radius = self.base_entity.radius;

                            let position = self.base_entity.position;
                            let velocity = Vec2::default();

                            let ai =
                                AI::new(self.base_entity.id, true, true, TankBot::Not, |_, _, _, _| true);

                            let information = NecromancerDrone {
                                ai,
                                damage,
                                penetration,
                                elasticity: turret.elasticity,
                                friction: turret.friction,
                                speed,
                                lifetime: turret.bullet_lifetime,
                                turret: i as u8,
                                turret_owner: self.base_entity.id,
                                turret_owner_clan: self.base_entity.clan,
                                shiny_scale: 1.0,
                            };

                            let projectile: ProjectileConstructionInfo =
                                ProjectileConstructionInfo {
                                    projectile_type: ProjectileType::NecromancerDrone,
                                    ai: Some(information.ai),
                                    damage: information.damage,
                                    penetration: information.penetration,
                                    elasticity: information.elasticity,
                                    friction: information.friction,
                                    speed: information.speed,
                                    lifetime: information.lifetime,
                                    pass_through_walls: false,
                                    prevent_ai: false,
                                    resurrected: true,
                                    radius: get_square_identity().radius,
                                    position: self.base_entity.position,
                                    velocity: Vec2::default(),
                                    turret: (information.turret, 0),
                                    minion_turret: None,
                                };

                            projectile_creations.push(projectile);
                        } else {
                            println!("...");
                        }
                    }
                }
            } else if !self.is_in_1v1 {
                self.base_entity.clan = Some(0);
            }

            if !self.base_entity.alive && opponent_is_alive && self.is_in_1v1 {
                let mut opponent_name = String::new();

                if let Some(opponent) = self.opponent
                    && let Some(opp) = entities.get(&opponent)
                    && let GenericEntity::Tank(tank) = &mut *opp.borrow_mut()
                {
                    opponent_name.clone_from(&tank.name);

                    tank.score_1v1 += 1;
                    tank.is_in_1v1 = false;
                    tank.ready = false;

                    tank.base_entity.alive = false;
                    tank.base_entity.health = 0.0;
                    tank.killer = Some(tank.base_entity.id);

                    win_uid.clone_from(&tank.uid);
                    win_category_idx = tank.base_entity.identity.category.clone() as usize;
                }

                self.is_in_1v1 = false;
                self.ready = false;
                self.identity_idx += 1;

                loss_uid.clone_from(&self.uid);
                loss_category_idx = self.base_entity.identity.category.clone() as usize;

                if self.identity_idx == 6 {
                    close = true;
                }

                for (i, entity) in entities.iter() {
                    if *i == self.base_entity.id {
                        if self.base_entity.identity.category == TankCategories::Illegal {
                            self.notifications.push((
                                "The game will end with no ELO changes.".to_string(),
                                [255, 0, 0],
                            ));
                            close = true;
                            win_uid.clear();
                            loss_uid.clear();
                        } else {
                            self.notifications.push((
                                format!("{} has won the round!", opponent_name),
                                [0, 255, 0],
                            ));

                            if self.identity_idx == 6 {
                                self.notifications.push((
                                    format!(
                                        "{} has won the game 6-{}!",
                                        opponent_name, self.score_1v1
                                    ),
                                    [0, 255, 0],
                                ));
                            }
                        }
                    } else if let GenericEntity::Tank(entity) = &mut *entity.borrow_mut() {
                        if self.base_entity.identity.category == TankCategories::Illegal {
                            entity.notifications.push((
                                "The game will end with no ELO changes.".to_string(),
                                [255, 0, 0],
                            ));
                            close = true;
                            win_uid.clear();
                            loss_uid.clear();
                        } else {
                            entity.notifications.push((
                                format!("{} has won the round!", opponent_name),
                                [0, 255, 0],
                            ));

                            if self.identity_idx == 6 {
                                entity.notifications.push((
                                    format!(
                                        "{} has won the game 6-{}!",
                                        opponent_name, self.score_1v1
                                    ),
                                    [0, 255, 0],
                                ));
                            }
                        }
                    }
                }
            }
        }

        self.base_entity.identity.score_yield = self.score;
        self.base_entity.tick(shg, config, false, dt);

        let dist_to_top = self.base_entity.position.x;
        let dist_to_bottom = (config.arena_size - self.base_entity.position.y);
        let dist_to_left = self.base_entity.position.x;
        let dist_to_right = (config.arena_size - self.base_entity.position.x);

        let min_dist_to_border = dist_to_top
            .min(dist_to_bottom)
            .min(dist_to_left)
            .min(dist_to_right);
        let max_dist_to_border = dist_to_top
            .max(dist_to_bottom)
            .max(dist_to_left)
            .max(dist_to_right);

        while !self.messages.is_empty() {
            let (message, tick) = &self.messages[0];
            if self.base_entity.ticks - tick >= config::MESSAGE_EXPIRY {
                self.messages.remove(0);
            } else {
                break;
            }
        }

        // if self.base_entity.ticks - self.message_tick >= config::MESSAGE_EXPIRY {
        //     self.message = String::default();
        // }

        if self.base_entity.alive {
            if self.inputs.is_set(Inputs::LevelUp)
                && !config
                    .disabled_flags
                    .contains(&packets::Inputs::LevelUp)
            {
                self.score = get_score_from_level(self.level + 1).max(self.score);
            }

            // Handle surroundings.
            let screen_width = (1920.0 + 300.0) * self.fov;
            let screen_height = (1080.0 + 300.0) * self.fov;

            let is_predator = entity_identity_id == Ok(EntityIdentityIds::Predator);
            let is_battleship = entity_identity_id == Ok(EntityIdentityIds::Battleship);
            let is_zoom = self.inputs.is_set(Inputs::Repel) && is_predator;

            if is_zoom && self.fov_pos.is_zero(1e-1) {
                self.fov_pos =
                    self.base_entity.position + Vec2::from_polar(1000.0, self.base_entity.angle);
            }

            if !is_zoom {
                self.fov_pos = Vec2::default();
            }

            let position = if is_zoom {
                self.fov_pos
            } else {
                self.base_entity.position
            };

            let screen_top_left = position - Vec2::new(screen_width / 2.0, screen_height / 2.0);
            let screen_bottom_right = position + Vec2::new(screen_width / 2.0, screen_height / 2.0);

            let surroundings = shg.query_rect(
                self.base_entity.id,
                screen_top_left,
                screen_width,
                screen_height,
            );

            self.surroundings = surroundings
                .into_iter()
                .filter(|entity| {
                    let entity = entities.get(entity);
                    if let Some(entity) = entity {
                        let entity: &GenericEntity = &entity.borrow();

                        let pos = entity.get_base_entity().position;

                        pos.x >= screen_top_left.x
                            && pos.x <= screen_bottom_right.x
                            && pos.y >= screen_top_left.y
                            && pos.y <= screen_bottom_right.y
                    } else {
                        false
                    }
                })
                .collect();

            let mut movement = Vec2::default();

            if self.inputs.is_set(Inputs::Up) {
                movement.y -= 1.0;
            }
            
            if self.inputs.is_set(Inputs::Down) {
                movement.y += 1.0;
            }
            
            if self.inputs.is_set(Inputs::Left) {
                movement.x -= 1.0;
            }
            
            if self.inputs.is_set(Inputs::Right) {
                movement.x += 1.0;
            }

            movement.normalise();
            movement *= self.base_entity.speed;

            if !movement.is_zero(1e-1) || self.inputs.is_set(Inputs::Shoot) {
                self.moved = true;
            }

            self.base_entity.velocity += movement;

            if let PrivilegeLevel::Bot { .. } = self.privilege
                && self.level != 45
            {
                self.score = get_score_from_level(self.level + 1);
                self.update_level(self.level + 1);
            }

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
                chatbot,
            } = &mut self.privilege
            {
                *id = self.base_entity.id;

                if *respawn != 0 {
                    if (*old_respawn as f32 * (2.0 / 4.0)) as u32 > *respawn {
                        self.base_entity.identity = identities[2].clone();
                    } else if (*old_respawn as f32 * (3.0 / 4.0)) as u32 > *respawn {
                        self.base_entity.identity = identities[1].clone();
                    } else if (*old_respawn as f32 * (3.5 / 4.0)) as u32 > *respawn {
                        self.base_entity.identity = identities[0].clone();
                    }
    
                    if (*old_respawn / 2) > *respawn {
                        *target_angle = -0.15;
                        self.base_entity.angle = {
                            lerp_angle!(self.base_entity.angle, 0.15 * dt, *target_angle)
                        };
                    } else {
                        *target_angle = normalise_angle!(randf!(0.4, 0.5));
                        self.base_entity.angle = {
                            lerp_angle!(self.base_entity.angle, 0.15 * dt, *target_angle)
                        };
                    }
    
                    *respawn -= 1;
                } else {
                    self.inputs.set_flag(Inputs::Shoot);
    
                    if !*stupid && self.base_entity.identity.category == TankCategories::Spammer {
                        *aim = randf!(0.01, 0.25) * *randomness;
                    } else {
                        *aim = 0.0;
                    }
    
                    let mut velocity = Vec2::default();
    
                    if !*stupid {
                        ai.state = AIState::Idle;
                    }

                    ai.tick(
                        self.base_entity.radius,
                        self.base_entity.position,
                        self.base_entity.clan,
                        entities,
                        Some(self.surroundings.clone()),
                    );
                    if let AIState::Active(target) = ai.state {
                        let mut is_dangerous = false;
                        let mut needs_distancing = true;
                        let mut targetting_shape = false;
                        let mut lerp_value = 0.15;
                        let mut recent_msg = String::new();

                        if let Some(t) = entities.get(&target) {
                            match &*t.borrow() {
                                GenericEntity::Tank(t) => {
                                    if !*stupid {
                                        is_dangerous = matches!(t.base_entity.identity.category, TankCategories::Destroyer | TankCategories::Factory | TankCategories::Drone);

                                        if t.stats.stat_investments[UpgradeStats::MaxHealth as usize] >= 5 || t.stats.stat_investments[UpgradeStats::BodyDamage as usize] >= 5 {
                                            is_dangerous = true;
                                        }
        
                                        if t.opacity <= 0.0 {
                                            ai.state = AIState::Idle;
                                        }

                                        recent_msg = t.messages.last().unwrap_or(&("".to_string(), 0)).0.clone();
                                    }
                                },
                                GenericEntity::Shape(s) => {
                                    if s.shape != ShapeType::AlphaPentagon {
                                        needs_distancing = false;
                                    }
    
                                    if s.shape == ShapeType::SmallCrasher || s.shape == ShapeType::LargeCrasher {
                                        lerp_value = 0.35;
                                    }
    
                                    targetting_shape = true;
                                },
                                GenericEntity::Projectile(p) => {
                                    for entity in p.base_entity.owned_by.iter() {
                                        if let Some(entity) = entities.get(entity) && let GenericEntity::Tank(t) = &*entity.borrow() {
                                            recent_msg = t.messages.last().unwrap_or(&("".to_string(), 0)).0.clone();
                                            break;
                                        }
                                    }
                                },
                                _ => ()
                            }
                        } else {
                            ai.state = AIState::Idle;
                        }
                        
                        if targetting_shape {
                            *aim = 0.0;
                        }

                        *target_angle = ai.movement.angle(None);
                        
                        if *stupid { 
                            self.base_entity.angle = *target_angle;
                        } else {
                            self.base_entity.angle = {
                                lerp_angle!(self.base_entity.angle, lerp_value * dt, *target_angle)
                            } + randf!(-(*aim), *aim);
                        }
    
                        let health_percent = self.base_entity.health / self.base_entity.max_health;
                        let max_dist = if is_dangerous { 1200.0 } else { 600.0 };
                        let min_dist = if !*stupid { if is_dangerous { max_dist } else { (max_dist * (1.0 - health_percent) * *randomness).max(max_dist / 2.0) } } else { 100.0 };
    
                        let (mut closest_projectile_position, mut closest_projectile_radius): (Option<Vec2>, f32) = (None, 0.0);

                        if !*stupid {
                            for entity in self.surroundings.iter() {
                                let entity = entities.get(entity);
                                if let Some(entity) = entity {
                                    let entity = &*entity.borrow();
        
                                    if let GenericEntity::Projectile(p) = entity {
                                        if p.base_entity.owned_by.contains(&self.base_entity.id) {
                                            continue;
                                        }
        
                                        if closest_projectile_position.is_none()
                                            || p.base_entity.position.distance(self.base_entity.position)
                                                < closest_projectile_position
                                                    .unwrap()
                                                    .distance(self.base_entity.position)
                                        {
                                            closest_projectile_position = Some(p.base_entity.position);
                                            closest_projectile_radius = p.base_entity.radius;
                                        }
                                    }
                                }
                            }
                        }

                        *roam_pos = ai.aim;
    
                        if !*stupid && (ai.aim.distance(self.base_entity.position) < min_dist || is_dangerous) {
                            let angle = (ai.aim - self.base_entity.position).angle(None);
                            velocity += Vec2::from_polar(self.base_entity.speed, angle + std::f32::consts::PI) * dt;
                        }

                        if !needs_distancing && !is_dangerous {
                            velocity += (ai.movement * self.base_entity.speed) * dt;
                        }
    
                        if let Some(closest_projectile_position) = closest_projectile_position && (self
                                .base_entity
                                .position
                                .distance(closest_projectile_position)
                                < min_dist || closest_projectile_radius > 20.0)
                        {
                            let angle =
                                (closest_projectile_position - self.base_entity.position).angle(None);

                            let min_randomness = 0.75;
                            let max_randomness = 1.25;
                            let min_offset = std::f32::consts::PI / 2.0;
                            let max_offset = 3.0 * std::f32::consts::PI / 2.0;
                            
                            let normalized_randomness = (*randomness - min_randomness) / (max_randomness - min_randomness);
                            let offset = min_offset + normalized_randomness * (max_offset - min_offset);

                            velocity +=
                                Vec2::from_polar(self.base_entity.speed, angle + offset)
                                    * dt;
                        } else if !is_dangerous {
                            velocity += (ai.movement * self.base_entity.speed) * dt;
                        }

                        // if !*stupid {
                        //     match chatbot.typing_time {
                        //         time if time > 0 => {
                        //             chatbot.typing_time -= 1;
                        //             self.inputs.clear_flag(Inputs::Shoot);
                        //             velocity *= 0.0;
                        //         },
                        //         0 => {
                        //             if !recent_msg.is_empty() && recent_msg != chatbot.reply_to {
                        //                 println!("new msg received {}", recent_msg);
                        //                 chatbot.reply_to = recent_msg.clone();
                        //                 chatbot.response = chatbot.eliza.respond(chatbot.reply_to.as_str());

                        //                 let base_speed = 5.0;

                        //                 let default_complexity = 1.0;
                        //                 let special_complexity = 1.2;
                                    
                        //                 let mut total_time = 4.0;
                        //                 let mut rng = rand::thread_rng();
                                    
                        //                 for char in chatbot.response.chars() {
                        //                     let category = if char.is_alphanumeric() { default_complexity } else { special_complexity };
                        //                     let char_time = 1.0 / (base_speed * category);
                                    
                        //                     let random_factor: f64 = rng.gen_range(0.9..1.1);
                        //                     let adjusted_char_time = char_time * random_factor;
                                    
                        //                     total_time += adjusted_char_time;
                        //                 }                                    

                        //                 chatbot.typing_time = seconds_to_ticks!(total_time);
                        //                 chatbot.sent = false;
                        //             } else if self.messages.len() < 3 && !chatbot.sent {
                        //                 self.messages.push((chatbot.response.clone(), self.base_entity.ticks));
                        //                 chatbot.sent = true;
                        //             }
                        //         },
                        //         _ => ()
                        //     }
                        // }
                    } else {
                        let angle = (self.base_entity.position - *roam_pos).angle(None);
                        *target_angle = angle;
                        self.base_entity.angle = lerp_angle!(self.base_entity.angle, 0.15 * dt, *target_angle);
    
                        velocity += Vec2::from_polar(self.base_entity.speed, angle + std::f32::consts::PI) * dt;
    
                        if self.base_entity.position.distance(*roam_pos) < 300.0 {
                            *roam_pos = Vec2::new(randf!(200.0, config.arena_size - 200.0), randf!(200.0, config.arena_size - 200.0));
                        }
                    }
    
                    velocity.set_magnitude(self.base_entity.speed);
                    self.base_entity.velocity += velocity;
                }
            }

            'turret_loop: for (i, turret) in self.base_entity.identity.turrets.iter_mut().enumerate() {
                if turret.reload_time == 0.0 && turret.cycle_position == 0.0 {
                    turret.reload_time = self.reload_time * turret.reload;
                    turret.cycle_position = turret.reload_time;
                }

                let reload_time = self.reload_time * turret.reload;
                if turret.reload_time != reload_time {
                    turret.cycle_position *= reload_time / turret.reload_time;
                    turret.reload_time = reload_time;
                }

                let always_shoot = turret.projectile_type == ProjectileType::AutoBullet
                    || (turret.projectile_type == ProjectileType::Drone && !is_battleship)
                    || turret.projectile_type == ProjectileType::Minion; // not until its auto turret, minion, or drone

                if (turret.cycle_position >= reload_time) && (!self.inputs.is_set(Inputs::Shoot) && !always_shoot) {
                    turret.cycle_position = reload_time;
                    continue;
                }

                if turret.cycle_position < reload_time * (1.0 + turret.delay) {
                    turret.cycle_position += 1.0;
                    continue;
                }

                if turret.max_projectile_count != -1
                    && turret.projectile_count >= turret.max_projectile_count
                {
                    continue;
                }

                let speed = (turret.projectile_speed + 5.0 + (self.stats.stat_investments[UpgradeStats::ProjectileSpeed as usize] as f32) * 2.0) - randf!(0.0, 1.0) * turret.scatter_rate;

                if turret.projectile_type == ProjectileType::AutoBullet {
                    let ai = turret.ai.as_mut().unwrap();

                    let mut use_ai = !((self.inputs.is_set(Inputs::Repel) || self.inputs.is_set(Inputs::Shoot)) && ai.mouse_influence);
                    let mut idle = true;

                    let max_projectile_distance = turret.bullet_lifetime * 36.0 * speed * 0.96;

                    if use_ai {
                        let surroundings: Vec<u32> = self
                            .surroundings
                            .clone()
                            .into_iter()
                            .filter(|entity| {
                                let entity = entities.get(entity);
                                if let Some(entity) = entity {
                                    let entity = &*entity.borrow();

                                    let base_entity = entity.get_base_entity();
                                    let mut opacity = 1.0;
                                    if let GenericEntity::Tank(t) = entity {
                                        opacity = t.opacity
                                    };

                                    let mut should_target = (base_entity.alive && opacity >= 1.0)
                                        && (base_entity
                                            .position
                                            .distance(self.base_entity.position)
                                            < max_projectile_distance);

                                    if should_target {
                                        for self_owner in self.base_entity.owned_by.iter() {
                                            if base_entity.owned_by.contains(self_owner)
                                                || base_entity.id == *self_owner
                                            // If the other entity is the owner or also owned by the
                                            // same entity.
                                            {
                                                should_target = false;
                                                break;
                                            }
                                        }
                                    }

                                    if should_target {
                                        for self_owner in base_entity.owned_by.iter() {
                                            if self.base_entity.owned_by.contains(self_owner)
                                                || self.base_entity.id == *self_owner
                                            // If the other entity is the owner or also owned by the
                                            // same entity.
                                            {
                                                should_target = false;
                                                break;
                                            }
                                        }
                                    }

                                    should_target
                                } else {
                                    false
                                }
                            })
                            .collect();

                        ai.speed = speed;
                        ai.tick(
                            self.base_entity.radius,
                            self.base_entity.position,
                            self.base_entity.clan,
                            entities,
                            Some(surroundings),
                        );

                        if ai.state != AIState::Idle {
                            // turret.angle = ai.aim.angle(None);
                            turret.angle = ai.aim.angle(Some(self.base_entity.position));
                            idle = false;
                        }
                    }

                    if idle {
                        turret.angle = normalise_angle!(turret.angle + 0.01);
                    } else {
                        turret.projectile_count += 1;

                        let projectile_damage = turret.projectile_damage
                            * ((1.0_f32
                                + self.stats.stat_investments
                                    [UpgradeStats::ProjectileDamage as usize]
                                    as f32)
                                * 1.25);
                        let projectile_pentration = turret.projectile_penetration
                            * ((6.0_f32
                                * self.stats.stat_investments
                                    [UpgradeStats::ProjectilePenetration as usize]
                                    as f32)
                                + 4.0);
                        let radius = (turret.width / 2) as f32
                            * (self.base_entity.radius / BASE_TANK_RADIUS)
                            * turret.size_factor;

                        let scatter_angle = (std::f32::consts::PI / 180.0)
                            * turret.scatter_rate
                            * (randf!(0.0, 1.0) - 0.5)
                            * 10.0;
                        let projectile_angle = turret.angle + scatter_angle;

                        let mut position = self.base_entity.position
                            + Vec2::from_polar(
                                self.base_entity.radius + radius - 10.0,
                                projectile_angle,
                            );
                        position.x -= (turret.x_offset
                            * (self.base_entity.radius / BASE_TANK_RADIUS))
                            * (projectile_angle).sin();
                        position.y += (turret.x_offset
                            * (self.base_entity.radius / BASE_TANK_RADIUS))
                            * (projectile_angle).cos();

                        let velocity = Vec2::from_polar(speed, projectile_angle);

                        projectile_creations.push(ProjectileConstructionInfo {
                            projectile_type: turret.projectile_type,
                            ai: None,
                            damage: projectile_damage,
                            penetration: projectile_pentration,
                            elasticity: turret.elasticity,
                            friction: turret.friction,
                            speed,
                            lifetime: turret.bullet_lifetime * 72.0,
                            pass_through_walls: true,
                            prevent_ai: false,
                            resurrected: false,
                            radius,
                            position,
                            velocity,
                            turret: (i as u8, 0),
                            minion_turret: None,
                        });

                        // let id = ProjectileEntity::new(game_server, turret.projectile_type, None,
                        //     projectile_damage, projectile_pentration, turret.elasticity,
                        // turret.friction, speed, turret.bullet_lifetime * 36.0,
                        //     true, false, false,
                        //     radius, position, velocity, i as u8, None
                        // ).await;
                        // let projectile = &mut *entities.get(&id).unwrap().borrow_mut();

                        // projectile.get_mut_base_entity().owned_by.push(self.base_entity.id);
                        // projectile.get_mut_base_entity().clan = self.base_entity.clan;
                        // self.base_entity.owned_entities.push(id);
                        turret.cycle_position = self.reload_time * turret.reload * turret.delay;
                        self.base_entity.velocity -=
                            Vec2::from_polar(turret.recoil, projectile_angle);
                    }
                } else if turret.projectile_type == ProjectileType::Drone
                    || turret.projectile_type == ProjectileType::Minion
                {
                    turret.projectile_count += 1;

                    let projectile_damage = turret.projectile_damage
                        * ((1.0_f32
                            + self.stats.stat_investments[UpgradeStats::ProjectileDamage as usize]
                                as f32)
                            * 1.5);
                    let projectile_pentration = turret.projectile_penetration
                        * ((6.0_f32
                            * self.stats.stat_investments
                                [UpgradeStats::ProjectilePenetration as usize]
                                as f32)
                            + 4.0);
                    let radius = (turret.width / 2) as f32
                        * (self.base_entity.radius / BASE_TANK_RADIUS)
                        * turret.size_factor;

                    let scatter_angle = (std::f32::consts::PI / 180.0)
                        * turret.scatter_rate
                        * (randf!(0.0, 1.0) - 0.5)
                        * 10.0;
                    let projectile_angle = self.base_entity.angle + turret.angle + scatter_angle;

                    let mut position = self.base_entity.position
                        + Vec2::from_polar(
                            self.base_entity.radius + radius - 10.0,
                            projectile_angle,
                        );
                    position.x -= (turret.x_offset * (self.base_entity.radius / BASE_TANK_RADIUS))
                        * (projectile_angle).sin();
                    position.y += (turret.x_offset * (self.base_entity.radius / BASE_TANK_RADIUS))
                        * (projectile_angle).cos();

                    let velocity = Vec2::from_polar(10.0, projectile_angle);

                    let prevented_drone_tank = entity_identity_id == Ok(EntityIdentityIds::Hybrid);
                    let is_battleship = entity_identity_id == Ok(EntityIdentityIds::Battleship);

                    let ai = AI::new(
                        self.base_entity.id,
                        !(is_battleship && (i % 2 == 0) || prevented_drone_tank),
                        true,
                        TankBot::Not,
                        |_, _, _, _| true,
                    );

                    projectile_creations.push(ProjectileConstructionInfo {
                        projectile_type: turret.projectile_type,
                        ai: Some(ai),
                        damage: projectile_damage,
                        penetration: projectile_pentration,
                        elasticity: turret.elasticity,
                        friction: turret.friction,
                        speed,
                        lifetime: turret.bullet_lifetime * 88.0,
                        pass_through_walls: false,
                        prevent_ai: false,
                        resurrected: false,
                        radius,
                        position,
                        velocity,
                        turret: (i as u8, 0),
                        minion_turret: if turret.projectile_type == ProjectileType::Minion {
                            Some(turret.turrets[0].clone())
                        } else {
                            None
                        },
                    });

                    // let id = ProjectileEntity::new(game_server, turret.projectile_type, Some(ai),
                    //     projectile_damage, projectile_pentration, turret.elasticity,
                    // turret.friction, speed, turret.bullet_lifetime * 88.0,
                    //      false, false, false,
                    //      radius, position, velocity, i as u8, if turret.projectile_type ==
                    // ProjectileType::Minion { Some(turret.turrets[0].clone()) } else { None }
                    // ).await;

                    // projectile.get_mut_base_entity().owned_by.push(self.base_entity.id);
                    // projectile.get_mut_base_entity().clan = self.base_entity.clan;
                    // self.base_entity.owned_entities.push(id);
                    turret.cycle_position = reload_time * turret.delay;
                    self.base_entity.velocity -= Vec2::from_polar(turret.recoil, projectile_angle);
                } else if turret.projectile_type != ProjectileType::NecromancerDrone {
                    turret.projectile_count += 1;

                    let projectile_damage = turret.projectile_damage
                        * ((1.0_f32
                            + self.stats.stat_investments[UpgradeStats::ProjectileDamage as usize]
                                as f32)
                            * 1.25);
                    let projectile_pentration = turret.projectile_penetration
                        * ((6.0_f32
                            * self.stats.stat_investments
                                [UpgradeStats::ProjectilePenetration as usize]
                                as f32)
                            + 4.0);
                    let radius = (turret.width / 2) as f32
                        * (self.base_entity.radius / BASE_TANK_RADIUS)
                        * turret.size_factor;

                    let scatter_angle = (std::f32::consts::PI / 180.0)
                        * turret.scatter_rate
                        * (randf!(0.0, 1.0) - 0.5)
                        * 10.0;
                    let projectile_angle = self.base_entity.angle + turret.angle + scatter_angle;

                    let mut position = self.base_entity.position
                        + Vec2::from_polar(
                            self.base_entity.radius + radius - 10.0,
                            projectile_angle,
                        );
                    position.x -= (turret.x_offset * (self.base_entity.radius / BASE_TANK_RADIUS))
                        * (projectile_angle).sin();
                    position.y += (turret.x_offset * (self.base_entity.radius / BASE_TANK_RADIUS))
                        * (projectile_angle).cos();

                    let velocity = Vec2::from_polar(speed, projectile_angle);

                    let mut lifetime = turret.bullet_lifetime;
                    if turret.projectile_type == ProjectileType::Trap {
                        lifetime *= 600.0;
                        let mut lifetime_u32 = lifetime as u32;
                        lifetime_u32 >>= 3;
                        lifetime = lifetime_u32 as f32;
                    } else {
                        lifetime *= 72.0;
                    }

                    if let ProjectileType::Railgun { .. } = turret.projectile_type {
                        for entity in self.base_entity.owned_entities.iter() {
                            if let Some(entity) = entities.get(entity) {
                                if let GenericEntity::Projectile(p) = &*entity.borrow() {
                                    if let ProjectileType::Railgun { has_shot, .. } = p.projectile_type {
                                        if !has_shot {
                                            continue 'turret_loop;
                                        }
                                    }
                                }
                            }
                        }
                    }

                    projectile_creations.push(ProjectileConstructionInfo {
                        projectile_type: turret.projectile_type,
                        ai: None,
                        damage: projectile_damage,
                        penetration: projectile_pentration,
                        elasticity: turret.elasticity,
                        friction: turret.friction,
                        speed,
                        lifetime,
                        pass_through_walls: true,
                        prevent_ai: false,
                        resurrected: false,
                        radius,
                        position,
                        velocity,
                        turret: (i as u8, 0),
                        minion_turret: None,
                    });

                    // let id = ProjectileEntity::new(
                    //     game_server, turret.projectile_type, None,
                    //     projectile_damage, projectile_pentration, turret.elasticity,
                    // turret.friction, speed, lifetime,     true, false, false,
                    //     radius, position, velocity, i as u8, None
                    // ).await;
                    // let projectile = &mut *entities.get(&id).unwrap().borrow_mut();

                    // projectile.get_mut_base_entity().owned_by.push(self.base_entity.id);
                    // projectile.get_mut_base_entity().clan = self.base_entity.clan;
                    // self.base_entity.owned_entities.push(id);

                    turret.cycle_position = reload_time * turret.delay;
                    self.base_entity.velocity -= Vec2::from_polar(turret.recoil, projectile_angle);
                }

                turret.cycle_position += 1.0;
            }

            // Invisibility
            let mut true_shooting =
                self.inputs.is_set(Inputs::Shoot) && !(self.base_entity.identity.category == TankCategories::Drone);

            if self.base_entity.velocity.is_zero(3.0) && !true_shooting {
                if self.base_entity.identity.opacity_decrement != -1.0 && self.opacity > 0.0 {
                    self.opacity -= self.base_entity.identity.opacity_decrement * dt;
                    self.opacity = constrain!(0.0, self.opacity, 1.0);
                }
            } else if self.base_entity.identity.opacity_decrement != -1.0
                && self.opacity < 1.0
                && self.opacity != -1.0
            {
                self.opacity += self.base_entity.identity.opacity_decrement * dt;
                self.opacity = constrain!(0.0, self.opacity, 1.0);
            }

            let mut new_level = self.level;
            while (new_level as usize) < LEVEL_TO_SCORE_TABLE.len()
                && get_score_from_level(new_level + 1) <= self.score
            {
                new_level += 1;

                if new_level < 29 || new_level % 3 == 0 {
                    self.stats.available_stat_points += 1;
                    self.send_stat_info = true;
                }
            }
            self.update_level(new_level);

            self.spawning = (self.base_entity.ticks - self.spawning_tick)
                <= (config::PLAYER_INVINCIBILITY_TICKS)
                && !self.moved;
            self.base_entity.invincible = self.spawning;

            // Health Regen
            self.base_entity.regen_per_tick = (self.base_entity.max_health
                * 4.0
                * (self.stats.stat_investments[UpgradeStats::HealthRegen as usize] as f32)
                + self.base_entity.max_health)
                / 25000.0;

            // Max Health
            let prev_health_ratio = self.base_entity.health / self.base_entity.max_health;
            self.base_entity.max_health = self.base_entity.identity.max_health
                + 2.0 * ((self.level - 1) as f32)
                + (self.stats.stat_investments[UpgradeStats::MaxHealth as usize] as f32) * 60.0;
            self.base_entity.health = self.base_entity.max_health * prev_health_ratio;

            // Body Damage
            self.base_entity.damage_exertion = self.base_entity.identity.damage_exertion
                + (self.stats.stat_investments[UpgradeStats::BodyDamage as usize] as f32) * 3.0;

            // Reload
            self.reload_time = 15.0
                * (0.914_f32).powf(
                    self.stats.stat_investments[UpgradeStats::ProjectileReload as usize] as f32,
                );

            // Movement Speed
            self.base_entity.speed = self.base_entity.identity.base_speed
                * 1.6
                * (1.07_f32.powf(
                    self.stats.stat_investments[UpgradeStats::MovementSpeed as usize] as f32,
                ))
                / (1.015_f32.powf((self.level - 1) as f32));

            // FOV
            // replace with multiplication (no exponential)
            self.fov = self.base_entity.identity.base_fov
                + (1.02_f32.powf(self.stats.stat_investments[UpgradeStats::Fov as usize] as f32)
                    - 1.0)
                + (1.0045_f32.powf((self.level - 1) as f32) - 1.0);
        } else {
            while let Some(id) = self.base_entity.owned_entities.pop() {
                entity_deletions.push(id);
            }

            let mut fov = self.fov;

            if let Some(k) = self.killer {
                let mut killers: Vec<u32> = Vec::new();

                if k != self.base_entity.id {
                    {
                        let killer = entities.get(&k);

                        if let Some(killer) = killer {
                            if let GenericEntity::Projectile(p) = &*killer.borrow() {
                                for owned_by in p.base_entity.owned_by.iter() {
                                    killers.push(*owned_by);
                                }
                            }
                        }
                    }

                    for killer in killers.iter() {
                        if let Some(killer) = entities.get(killer)
                            && let GenericEntity::Tank(t) = &mut *killer.borrow_mut()
                        {
                            self.killer = Some(t.base_entity.id);
                            fov = t.fov;

                            break;
                        }
                    }
                }

                if let Some(killer) = self.killer {
                    if killer == self.base_entity.id {
                        let radius = 1120.0 * fov;
                        self.surroundings = shg.query_radius(
                            self.base_entity.id,
                            self.base_entity.position - Vec2::new(radius, radius),
                            radius,
                        );
                    } else if let Some(killer) = entities.get(&killer) {
                        let killer = &*killer.borrow();

                        let base_entity = killer.get_base_entity();
                        self.base_entity.position = base_entity.position;

                        let radius = 1120.0 * fov;
                        self.surroundings = shg.query_radius(
                            self.base_entity.id,
                            base_entity.position - Vec2::new(radius, radius),
                            radius,
                        );
                    }
                }
            } else {
                self.killer = None;
            }

            let screen_width = (1920.0 + 300.0) * fov;
            let screen_height = (1080.0 + 300.0) * fov;

            let screen_top_left =
                self.base_entity.position - Vec2::new(screen_width / 2.0, screen_height / 2.0);
            let screen_bottom_right =
                self.base_entity.position + Vec2::new(screen_width / 2.0, screen_height / 2.0);

            let surroundings = shg.query_rect(
                self.base_entity.id,
                screen_top_left,
                screen_width,
                screen_height,
            );

            self.surroundings = surroundings
                .into_iter()
                .filter(|entity| {
                    let entity = entities.get(entity);
                    if let Some(entity) = entity {
                        let entity = &mut *entity.borrow_mut();

                        let pos = entity.get_mut_base_entity().position;

                        pos.x >= screen_top_left.x
                            && pos.x <= screen_bottom_right.x
                            && pos.y >= screen_top_left.y
                            && pos.y <= screen_bottom_right.y
                    } else {
                        false
                    }
                })
                .collect();
        }

        // let mut bytes2 = SwiftStream::with_capacity(tank.surroundings.len() * 8 + 1);
        // bytes2.write_u8(0xFF);
        // for surrounding in tank.surroundings.iter()
        // {
        //     let tank_entity = entities[*surrounding as usize].as_ref().unwrap();

        //     if let Some()
        //     bytes2.write_f32(tank_entity.get_base_entity().position.x);
        //     bytes2.write_f32(tank_entity.get_base_entity().position.y);
        //     bytes2.write_u32(tank_entity.get_base_entity().id);
        // }

        if let GameMode::Ranked(_) = config.game_mode
            && !self.is_in_1v1
        {
            projectile_creations.clear();
            for (turret) in self.base_entity.identity.turrets.iter_mut() {
                turret.projectile_count = 0;
            }
        }

        let player_count: u32 = entities
            .iter()
            .filter(|(id, entity)| {
                **id == self.base_entity.id
                    || matches!(&*(**entity).borrow(), GenericEntity::Tank(_))
            })
            .count() as u32;

        let entity_id = self.base_entity.id;
        let ws_id = self.ws_id;
        let ticks = self.base_entity.ticks;
        let last_ping = self.last_ping;

        let mut cipher = 0;

        if !matches!(self.privilege, PrivilegeLevel::Bot { .. }) {
            if let Some(client) = ws_server.ws_clients.get_mut(&ws_id) {
                cipher = client.cipher;

                let addr = &client.addr.clone();
                if ticks - last_ping > DISCONNECT_TIMEOUT {
                    client.close = (true, false);

                    for clan in clans.iter_mut().flatten() {
                        clan.members.retain(|&id| id != entity_id);
                        clan.pending_members.retain(|&id| id != entity_id);

                        if clan.owner == entity_id && !clan.members.is_empty() {
                            clan.owner = clan.members[0];
                        }
                    }

                    return (
                        false,
                        entity_deletions,
                        projectile_creations,
                        close,
                        ((win_uid, win_category_idx), (loss_uid, loss_category_idx)),
                    );
                }
            } else {
                return (
                    false,
                    entity_deletions,
                    projectile_creations,
                    close,
                    ((win_uid, win_category_idx), (loss_uid, loss_category_idx)),
                );
            }

            let update_bytes = packets::form_update_packet(self, entities, clans, config, cipher);
            self.packets.push(update_bytes);

            if self.send_stat_info {
                let stat_bytes = packets::form_stat_packet(self, cipher);
                self.send_stat_info = false;

                self.packets.push(stat_bytes);
            }

            if self.send_upgrades_info && !matches!(config.game_mode, GameMode::Ranked(_)) {
                let upgrade_bytes = packets::form_upgrade_packet(self, cipher);
                self.send_upgrades_info = false;

                self.packets.push(upgrade_bytes);
            }

            let server_info_bytes =
                packets::form_server_info_packet(player_count, player_count, mspt, cipher);
            self.packets.push(server_info_bytes);

            while let Some(notification) = self.notifications.pop() {
                let notification_bytes =
                    packets::form_notification_packet(notification.0, notification.1, cipher);
                self.packets.push(notification_bytes);
            }
        }

        let exists =
            !matches!(self.privilege, PrivilegeLevel::Bot { .. }) || self.base_entity.alive;
        (
            exists,
            entity_deletions,
            projectile_creations,
            close,
            ((win_uid, win_category_idx), (loss_uid, loss_category_idx)),
        )
    }
}
