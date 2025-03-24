use rand::Rng;
use std::borrow::Borrow;

use super::{
    ai::{
        AIState,
        AI,
    },
    base_entity::{
        BaseEntity,
        GenericEntity,
        GenericEntityHelpers,
    },
    components::{
        entity_identity::{
            get_projectile_identity,
            get_score_from_level,
            get_square_identity,
            EntityIdentityIds,
            LEVEL_TO_SCORE_TABLE,
        },
        turret::Turret,
    },
};
use crate::{
    connection::packets::{
        form_notification_packet, CensusProperties, Inputs, UpgradeStats
    }, constrain, game::server::{
        EntityDataStructure,
        GameServer,
        GameServerConfig,
    }, lerp, lerp_angle, physics::{
        shg::SpatialHashGrid,
        vec2::Vec2,
    }, randf, seconds_to_ticks, utils::{
        config::{
            self,
            AI_VIEW,
            BASE_TANK_RADIUS,
            MAX_CLANS,
        },
        stream::SwiftStream,
    }
};
use strum::IntoEnumIterator;

/// An enum representing projectile types.
#[derive(Debug, Clone, Copy, PartialEq, PartialOrd)]
pub enum ProjectileType
{
    Bullet,
    AutoBullet,
    Drone,
    Trap,
    NecromancerDrone,
    Minion,
    Railgun {
        num_charges: u8,
        max_num_charges: u8,
        radius_increase: f32,
        has_shot: bool
    }
}

impl From<ProjectileType> for u8
{
    fn from(projectile_type: ProjectileType) -> u8
    {
        match projectile_type {
            ProjectileType::Bullet => 0,
            ProjectileType::AutoBullet => 1,
            ProjectileType::Drone => 2,
            ProjectileType::Trap => 3,
            ProjectileType::NecromancerDrone => 4,
            ProjectileType::Minion => 5,
            ProjectileType::Railgun { .. } => 6
        }
    }
}

#[derive(Debug)]
pub struct ProjectileEntity
{
    pub base_entity: BaseEntity,
    pub projectile_type: ProjectileType,
    /// The AI which may control the entity.
    pub ai: Option<AI>,

    pub damage: f32,
    pub penetration: f32,
    pub elasticity: f32,
    pub friction: f32,
    pub speed: f32,
    pub lifetime: f32,
    /// `true` if the projectile is a former shape.
    pub resurrected: bool,

    pub pass_through_walls: bool,
    pub prevent_ai: bool,

    /// The amount of score the projectile has gained.
    pub score_gained: f32,
    /// Whether or not the projectile killed a player.
    pub killed_player_name: Option<String>,
    /// The turret the projectile spawned from (turret_idx, sublevels).
    pub turret: (u8, u8),
    /// The turret which spawned it (only Factory).
    pub minion_turret: Option<Turret>,
}

impl GenericEntityHelpers for ProjectileEntity
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
        let mut penetration = 0.0;
        let mut elasticity = 0.0;
        let mut friction = 0.0;
        let mut damage_scale = 1.0;

        if let GenericEntity::Projectile(projectile) = entity1 {
            penetration = projectile.penetration;
            elasticity = projectile.elasticity;
            friction = projectile.friction;

            if projectile.projectile_type == ProjectileType::Drone
                && let GenericEntity::Projectile(p) = entity2
                && p.projectile_type != ProjectileType::NecromancerDrone
            {
                damage_scale = 4.0;
            }
        }

        let mut self_died = false;
        let mut other_died = false;

        {
            let base_entity = entity1.get_mut_base_entity();
            let other_base_entity = entity2.get_mut_base_entity();

            if !base_entity.alive || !other_base_entity.alive {
                return;
            }

            base_entity.velocity *= 0.998;
            base_entity.position -= Vec2::from_polar(
                1.005_f32.powf(penetration) * elasticity,
                other_base_entity.position.angle(Some(base_entity.position)),
            );

            base_entity.health -= other_base_entity.damage_exertion * damage_scale;
            other_base_entity.health -= base_entity.damage_exertion * damage_scale;

            base_entity.last_damage_tick = base_entity.ticks;
            other_base_entity.last_damage_tick = other_base_entity.ticks;

            if base_entity.health <= 0.0 {
                self_died = true;
            }

            if other_base_entity.health <= 0.0 {
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
        stream.write_u8(12); // REPLACE WHEN NEEDED.
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
                CensusProperties::IdentityId => stream.write_u8(self.base_entity.identity.id),
                CensusProperties::Ticks => stream.write_u32(self.base_entity.ticks),
                CensusProperties::Owner => {
                    stream.write_u32(self.base_entity.owned_by.len() as u32);
                    for owner in self.base_entity.owned_by.iter() {
                        stream.write_u32(*owner);
                    }
                }
                CensusProperties::Turret => {
                    stream.write_u32(self.base_entity.owned_by[0]);
                    stream.write_u8(self.turret.0);
                    stream.write_u8(self.turret.1);
                }
                CensusProperties::ProjectileType => {
                    stream.write_u8(self.projectile_type.into());
                }
                CensusProperties::Clan => {
                    if let Some(clan) = self.base_entity.clan {
                        stream.write_u8(clan);
                    } else {
                        stream.write_u8(MAX_CLANS + 1);
                    }
                }
                _ => stream.backspace(1),
            }
        }
    }

    fn kill(&mut self, killer: &mut GenericEntity)
    {
        self.base_entity.alive = false;
    }
}

#[derive(Debug, Clone)]
pub struct ProjectileConstructionInfo
{
    pub projectile_type: ProjectileType,
    pub ai: Option<AI>,
    pub damage: f32,
    pub penetration: f32,
    pub elasticity: f32,
    pub friction: f32,
    pub speed: f32,
    pub lifetime: f32,
    pub pass_through_walls: bool,
    pub prevent_ai: bool,
    pub resurrected: bool,
    pub radius: f32,
    pub position: Vec2,
    pub velocity: Vec2,
    pub turret: (u8, u8),
    pub minion_turret: Option<Turret>,
}

impl ProjectileEntity
{
    pub fn new(game_server: &mut GameServer, construction: ProjectileConstructionInfo) -> u32
    {
        let identity = get_projectile_identity(0); // todo make property
        let mut base_entity = BaseEntity::new(game_server, construction.radius, identity);
        base_entity.position = construction.position;
        base_entity.velocity = construction.velocity;

        base_entity.health = construction.penetration;
        base_entity.max_health = construction.penetration;

        base_entity.damage_exertion = construction.damage;

        let id = base_entity.id;

        let wrapped_generic_entity = GenericEntity::Projectile(ProjectileEntity {
            base_entity,
            projectile_type: construction.projectile_type,
            ai: construction.ai,
            damage: construction.damage,
            penetration: construction.penetration,
            elasticity: construction.elasticity,
            friction: construction.friction,
            speed: construction.speed,
            lifetime: construction.lifetime,
            pass_through_walls: construction.pass_through_walls,
            prevent_ai: construction.prevent_ai,
            resurrected: construction.resurrected,
            score_gained: 0.0,
            killed_player_name: None,
            turret: construction.turret,
            minion_turret: construction.minion_turret
        });

        BaseEntity::add_to_game_server(
            game_server,
            wrapped_generic_entity,
            construction.position,
            construction.radius,
        );
        id
    }

    /// Checks if the entity should be influenced by AI.
    fn influenced_by_ai(&self, game_server: &GameServer) -> (bool, isize)
    {
        let ai = self.ai.as_ref().unwrap();

        if !ai.mouse_influence {
            return (true, -1);
        }

        for idx in (0..=self.base_entity.owned_by.len()) {
            let owner = self.base_entity.owned_by[idx];

            let entity = game_server.entities.get(&owner);
            if let Some(entity) = entity
                && let GenericEntity::Tank(t) = &*entity.borrow()
                && (t.inputs.is_set(Inputs::Repel) || t.inputs.is_set(Inputs::Shoot))
            {
                return (false, idx.try_into().unwrap());
            }
        }

        (true, -1)
    }

    pub fn apply_friction(&mut self)
    {
        let base_speed = self.speed;
    }

    pub fn tick(
        &mut self,
        entities: &EntityDataStructure,
        shg: &mut SpatialHashGrid,
        config: &GameServerConfig,
        dt: f32,
    ) -> (bool, Vec<ProjectileConstructionInfo>)
    {
        let mut projectiles: Vec<ProjectileConstructionInfo> = Vec::new();

        // TODO: Find owner without iterating over self.owned_by multiple times.
        self.base_entity.ticks += 1;

        // Set the projectile's clan to its owner's clan.
        for self_owner in self.base_entity.owned_by.iter() {
            let entity = entities.get(self_owner);
            if let Some(entity) = entity {
                let entity = &*entity.borrow();
                self.base_entity.clan = entity.get_base_entity().clan;
            }
        }

        let (mut is_shooting, mut is_repelling) = (false, false);
        let (mut owner_pos, mut owner_radius, mut owner_angle) = (Vec2::new(0.0, 0.0), 0.0, 0.0);
        let (mut owner_dmg, mut owner_pen) = (0, 0);

        for owner in self.base_entity.owned_by.iter() {
            if let Some(tank) = entities.get(owner)
                && let GenericEntity::Tank(tank) = &*tank.borrow()
            {
                is_shooting = tank.inputs.is_set(Inputs::Shoot);
                is_repelling = tank.inputs.is_set(Inputs::Repel);
                owner_pos.clone_from(&tank.base_entity.position);
                owner_radius = tank.base_entity.radius;
                owner_angle = tank.base_entity.angle;
                owner_dmg = tank.stats.stat_investments[UpgradeStats::ProjectileDamage as usize];
                owner_pen = tank.stats.stat_investments[UpgradeStats::ProjectilePenetration as usize];
            }
        }

        if let ProjectileType::Railgun {
            num_charges,
            max_num_charges,
            radius_increase,
            has_shot,
        } = &mut self.projectile_type
        {
            let mut do_changes = false;

            if !*has_shot {
                self.base_entity.ticks = 0;

                let damage_stat = self.base_entity.radius / 11.875;
                let pen_stat = self.base_entity.radius / 7.91;

                self.damage = damage_stat + ((1.0_f32 + owner_dmg as f32) * 1.25);
                self.penetration = pen_stat + ((6.0_f32 * owner_pen as f32) + 4.0);
                self.base_entity.damage_exertion = self.damage;
                self.base_entity.health = self.penetration;
                self.base_entity.max_health = self.penetration;

                if *num_charges != *max_num_charges {
                    *num_charges += 1;
                    self.base_entity.radius += *radius_increase;
    
                    if !is_shooting {
                        *has_shot = true;
                        do_changes = true;
                    }
                }
                
                if *num_charges >= *max_num_charges {
                    *has_shot = true;
                    do_changes = true;
                }

                self.base_entity.angle = owner_angle;
                self.base_entity.position = owner_pos + Vec2::from_polar(self.base_entity.radius + owner_radius - 10.0, owner_angle);
            }

            if do_changes {
                self.base_entity.velocity = Vec2::from_polar(self.speed, self.base_entity.angle);

                let recoil = self.base_entity.radius / 20.0;
                for owner in self.base_entity.owned_by.iter() {
                    if let Some(tank) = entities.get(owner)
                        && let GenericEntity::Tank(tank) = &mut *tank.borrow_mut()
                    {
                        tank.base_entity.velocity -= Vec2::from_polar(recoil, self.base_entity.angle);
                    }
                }
            }
        }

        if self.score_gained != 0.0 {
            for self_owner in self.base_entity.owned_by.iter() {
                let entity = entities.get(self_owner);
                if let Some(entity) = entity
                    && let GenericEntity::Tank(entity) = &mut *entity.borrow_mut()
                {
                    entity.score += self.score_gained;

                    if let Some(name) = &self.killed_player_name {
                        entity
                            .notifications
                            .push((format!("You've killed {}!", name), [0, 0, 0]));
                        self.killed_player_name = None;
                    }
                }
            }

            self.score_gained = 0.0;
        }

        if let Some(ref mut ai) = self.ai {
            ai.speed = self.speed;

            for owner in self.base_entity.owned_by.iter() {
                if let Some(tank) = entities.get(owner)
                    && let GenericEntity::Tank(tank) = &*tank.borrow()
                {
                    let use_ai = if self.prevent_ai {
                        false
                    } else {
                        !((is_repelling || is_shooting) && ai.mouse_influence)
                    };

                    let repelling = is_repelling;
                    let tank_position = tank.base_entity.position;
                    let tank_radius = tank.base_entity.radius;
                    let tank_mouse = tank.base_entity.mouse;

                    if use_ai {
                        if let AIState::Possessed(_) = ai.state {
                            ai.state = AIState::Idle;
                        }

                        let surroundings: Vec<u32> = tank
                            .surroundings
                            .clone()
                            .into_iter()
                            .filter(|entity| {
                                if *entity == self.base_entity.id {
                                    return false;
                                }

                                if let Some(entity) = entities.get(entity) {
                                    let entity = &*entity.borrow();

                                    if entity.as_int() == -1 {
                                        return false;
                                    }

                                    let base_entity = entity.get_base_entity();
                                    let mut opacity = 1.0;
                                    if let GenericEntity::Tank(t) = entity {
                                        opacity = t.opacity
                                    };

                                    let mut should_target = (base_entity.alive && opacity >= 1.0);

                                    if should_target {
                                        for self_owner in tank.base_entity.owned_by.iter() {
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
                                            if tank.base_entity.owned_by.contains(self_owner)
                                                || tank.base_entity.id == *self_owner
                                            // If the other entity is the owner or also owned by the
                                            // same entity.
                                            {
                                                should_target = false;
                                                break;
                                            }
                                        }
                                    }

                                    if !should_target {
                                        return false;
                                    }

                                    let screen_width = (1000.0) * tank.fov;
                                    let screen_height = (1000.0) * tank.fov;
                                    let position = base_entity.position;

                                    let screen_top_left = position
                                        - Vec2::new(screen_width / 2.0, screen_height / 2.0);
                                    let screen_bottom_right = position
                                        + Vec2::new(screen_width / 2.0, screen_height / 2.0);

                                    let pos = tank.base_entity.position;

                                    pos.x >= screen_top_left.x
                                        && pos.x <= screen_bottom_right.x
                                        && pos.y >= screen_top_left.y
                                        && pos.y <= screen_bottom_right.y
                                } else {
                                    false
                                }
                            })
                            .collect();

                        ai.tick(
                            tank_radius,
                            self.base_entity.position,
                            self.base_entity.clan,
                            entities,
                            Some(surroundings),
                        );

                        if ai.state != AIState::Idle {
                            self.base_entity.angle = ai.movement.angle(None);
                            let mut push_vec = ai.movement * ai.speed;

                            push_vec *= 0.9 * dt;

                            if self.projectile_type == ProjectileType::Minion {
                                self.base_entity.velocity.x =
                                    lerp!(self.base_entity.velocity.x, 0.3 * dt, push_vec.x);
                                self.base_entity.velocity.y =
                                    lerp!(self.base_entity.velocity.y, 0.3 * dt, push_vec.y);
                            } else {
                                self.base_entity.velocity.x =
                                    lerp!(self.base_entity.velocity.x, 0.15 * dt, push_vec.x);
                                self.base_entity.velocity.y =
                                    lerp!(self.base_entity.velocity.y, 0.15 * dt, push_vec.y);
                            }
                        } else {
                            let mut delta = self.base_entity.position - tank_position;
                            let delta_magnitude = delta.magnitude();

                            let unit_dist = delta_magnitude / 400.0;
                            let resting = delta_magnitude <= (4.0 * tank_radius);

                            if resting {
                                self.base_entity.angle += 0.01 * unit_dist * dt;
                                self.base_entity.velocity =
                                    Vec2::from_polar(ai.speed / 3.0, self.base_entity.angle);
                            } else {
                                let offset = delta.angle(None) + std::f32::consts::FRAC_PI_2;
                                delta.x = tank_position.x + offset.cos() * tank_radius * 2.0
                                    - self.base_entity.position.x;
                                delta.y = tank_position.y + offset.sin() * tank_radius * 2.0
                                    - self.base_entity.position.y;

                                self.base_entity.angle = delta.angle(None);

                                // let speed = if unit_dist < 0.5 { ai.speed / 1.1 } else { ai.speed
                                // };
                                let speed = ai.speed;

                                self.base_entity.velocity =
                                    Vec2::from_polar(speed, self.base_entity.angle);
                            }
                        }
                    } else {
                        ai.state = AIState::Possessed(tank_mouse);
                        ai.tick(
                            tank_radius,
                            self.base_entity.position,
                            self.base_entity.clan,
                            entities,
                            None,
                        );

                        self.base_entity.angle = ai.movement.angle(None);
                        let mut push_vec =
                            ai.movement * ai.speed * (if repelling { -1.0 } else { 1.0 }) * 0.9;

                        push_vec *= 0.9 * dt;

                        if self.projectile_type == ProjectileType::Minion {
                            self.base_entity.velocity = push_vec;
                        } else {
                            self.base_entity.velocity.x =
                                lerp!(self.base_entity.velocity.x, 0.15 * dt, push_vec.x);
                            self.base_entity.velocity.y =
                                lerp!(self.base_entity.velocity.y, 0.15 * dt, push_vec.y);
                        }

                        if repelling {
                            self.base_entity.angle += std::f32::consts::PI;
                        }
                    }

                    if self.projectile_type == ProjectileType::Minion {
                        let factory_mouse = if use_ai { ai.movement } else { tank_mouse };
                        if use_ai && ai.state == AIState::Idle {
                            // self.base_entity.velocity.rotate(self.base_entity.angle);
                        } else {
                            let distance =
                                factory_mouse.distance_squared(self.base_entity.position);
                            if distance < ((450.0_f32.powf(2.0)) / 2.0) {
                                self.base_entity
                                    .velocity
                                    .rotate(self.base_entity.angle + std::f32::consts::PI);
                            } else if distance < (250.0_f32.powf(2.0) * 2.0) {
                                self.base_entity
                                    .velocity
                                    .rotate(self.base_entity.angle + std::f32::consts::PI / 2.0);
                            } else {
                                self.base_entity.velocity.rotate(self.base_entity.angle);
                            }
                        }

                        self.base_entity.velocity *= self.friction * dt;
                    }

                    self.base_entity.position += self.base_entity.velocity * dt;

                    break;
                }
            }
        } else {
            if match self.projectile_type {
                ProjectileType::Railgun { has_shot, .. } => has_shot,
                _ => true,
            } {
                self.base_entity.position += self.base_entity.velocity * dt;
            }

            if self.projectile_type == ProjectileType::Trap {
                self.base_entity.velocity *= self.friction * dt;
            } else if self.base_entity.velocity.magnitude() > self.speed * 0.65 {
                self.base_entity.velocity *= 0.975;
            }
        }

        if !self.pass_through_walls
            && (self.base_entity.position.x < 0.0
                || self.base_entity.position.x > config.arena_size
                || self.base_entity.position.y < 0.0
                || self.base_entity.position.y > config.arena_size)
        {
            self.base_entity.position.x =
                constrain!(0.0, self.base_entity.position.x, config.arena_size);
            self.base_entity.position.y =
                constrain!(0.0, self.base_entity.position.y, config.arena_size);
        }

        if !self.base_entity.velocity.is_zero(1e-3) {
            shg.reinsert(
                self.base_entity.id,
                self.base_entity.position,
                self.base_entity.radius,
            );
        }

        if self.projectile_type == ProjectileType::Minion {
            for owner in self.base_entity.owned_by.iter() {
                let owner = entities.get(owner);

                if let Some(tank) = owner
                    && let GenericEntity::Tank(tank) = &mut *tank.borrow_mut()
                {
                    let turret = self.minion_turret.as_mut().unwrap();
                    if turret.reload_time == 0.0 && turret.cycle_position == 0.0 {
                        turret.reload_time = tank.reload_time * turret.reload;
                        turret.cycle_position = turret.reload_time;
                    }

                    let reload_time = tank.reload_time * turret.reload;
                    if turret.reload_time != reload_time {
                        turret.cycle_position *= reload_time / turret.reload_time;
                        turret.reload_time = reload_time;
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

                    turret.projectile_count += 1;

                    let speed = (turret.projectile_speed + 5.0 + (tank.stats.stat_investments[UpgradeStats::ProjectileSpeed as usize] as f32) * 2.0) - randf!(0.0, 1.0) * turret.scatter_rate;

                    let projectile_damage = turret.projectile_damage
                        * ((1.0_f32
                            + tank.stats.stat_investments[UpgradeStats::ProjectileDamage as usize]
                                as f32)
                            * 1.25);
                    let projectile_pentration = turret.projectile_penetration
                        * ((6.0_f32
                            * tank.stats.stat_investments
                                [UpgradeStats::ProjectilePenetration as usize]
                                as f32)
                            + 4.0);
                    let radius = (turret.width / 2) as f32
                        * (tank.base_entity.radius / BASE_TANK_RADIUS)
                        * turret.size_factor;

                    let scatter_angle = (std::f32::consts::PI / 180.0)
                        * turret.scatter_rate
                        * (randf!(0.0, 1.0) - 0.5)
                        * 10.0;
                    let projectile_angle = self.base_entity.angle + turret.angle + scatter_angle;

                    let mut position = self.base_entity.position
                        + Vec2::from_polar(self.base_entity.radius + (0.0) - 5.0, projectile_angle);
                    position.x -= (turret.x_offset * (tank.base_entity.radius / BASE_TANK_RADIUS))
                        * (projectile_angle).sin();
                    position.y += (turret.x_offset * (tank.base_entity.radius / BASE_TANK_RADIUS))
                        * (projectile_angle).cos();

                    let velocity = Vec2::from_polar(speed, projectile_angle);

                    projectiles.push(ProjectileConstructionInfo {
                        projectile_type: ProjectileType::Bullet,
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
                        turret: (0, 1),
                        minion_turret: None,
                        radius,
                        position,
                        velocity,
                    });

                    // proj.get_mut_base_entity().owned_by.push(tank.base_entity.id);
                    // proj.get_mut_base_entity().clan = tank.base_entity.clan;
                    // tank.base_entity.owned_entities.push(projectile_id);
                    self.base_entity.velocity -= Vec2::from_polar(turret.recoil, projectile_angle);

                    turret.cycle_position = reload_time * turret.delay + 1.0;
                }
            }
        }

        if (self.lifetime > 0.0 && self.base_entity.ticks > self.lifetime as u32)
            || self.base_entity.health < 0.0
            || !self.base_entity.alive
        {
            for owner in self.base_entity.owned_by.iter() {
                let owner = entities.get(owner);
                if let Some(o) = owner {
                    let o = &mut *o.borrow_mut();

                    let base_entity = o.get_mut_base_entity();
                    base_entity
                        .owned_entities
                        .retain(|&x| x != self.base_entity.id);

                    if let GenericEntity::Tank(tank) = o {
                        // WARNING: Won't work if there are multiple subturrets!
                        let mut turret: &mut Turret =
                            &mut tank.base_entity.identity.turrets[self.turret.0 as usize];
                        let sublevels = self.turret.1;

                        for i in (0..sublevels) {
                            turret = &mut turret.turrets[self.turret.0 as usize];
                        }

                        turret.projectile_count -= 1;
                    }
                }
            }

            (false, projectiles)
        } else {
            (true, projectiles)
        }
    }
}
