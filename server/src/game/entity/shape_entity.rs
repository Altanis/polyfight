use rand::Rng;
use std::{
    borrow::BorrowMut,
    f32::consts::E,
    sync::Arc,
};
use tokio::sync::Mutex;

use strum::IntoEnumIterator;

use crate::{
    connection::packets::{
        CensusProperties,
        UpgradeStats,
    },
    constrain,
    debug,
    error,
    game::{
        self,
        server::{
            EntityDataStructure,
            GameServer,
            GameServerConfig,
        },
    },
    normalise_angle,
    physics::{
        shg::SpatialHashGrid,
        vec2::Vec2,
    },
    randf,
    randi,
    utils::{
        self,
        config::{
            self,
            AI_VIEW,
            MAX_CLANS,
        },
        stream::SwiftStream,
        timed_mutex::AsyncTimedLock,
    },
};

use super::{
    ai::{
        AIState, TankBot, AI
    },
    base_entity::{
        BaseEntity,
        GenericEntity,
        GenericEntityHelpers,
    },
    components::{
        entity_identity::{
            self,
            get_projectile_identity,
            get_score_from_level,
            get_square_identity,
            EntityIdentity,
            EntityIdentityIds,
            LEVEL_TO_SCORE_TABLE,
        },
        turret::Turret,
    },
    projectile_entity::{
        ProjectileConstructionInfo,
        ProjectileEntity,
        ProjectileType,
    },
    tank_entity::TankEntity,
};

/// An enum representing the type of shape.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ShapeType
{
    Square,
    Triangle,
    SmallCrasher,
    LargeCrasher,
    Pentagon,
    AlphaPentagon,
}

/// An enum representing shiny types.
#[derive(Debug, PartialEq, Clone)]
pub enum ShinyType
{
    Normal,
    Shiny,
    Mythical,
}

impl ShapeType
{
    pub fn as_int(&self) -> u8
    {
        match self {
            ShapeType::Square => 0,
            ShapeType::Triangle => 1,
            ShapeType::SmallCrasher => 2,
            ShapeType::LargeCrasher => 3,
            ShapeType::Pentagon => 4,
            ShapeType::AlphaPentagon => 5,
        }
    }
}

impl TryInto<EntityIdentity> for ShapeType
{
    type Error = ();

    fn try_into(self) -> Result<EntityIdentity, Self::Error>
    {
        match self {
            ShapeType::Square => Ok(entity_identity::get_square_identity()),
            ShapeType::Triangle => Ok(entity_identity::get_triangle_identity()),
            ShapeType::SmallCrasher => Ok(entity_identity::get_small_crasher_identity()),
            ShapeType::LargeCrasher => Ok(entity_identity::get_large_crasher_identity()),
            ShapeType::Pentagon => Ok(entity_identity::get_pentagon_identity()),
            ShapeType::AlphaPentagon => Ok(entity_identity::get_alpha_pentagon_identity()),
            _ => Err(()),
        }
    }
}

impl ShinyType
{
    pub fn as_int(&self) -> u8
    {
        match self {
            ShinyType::Normal => 0,
            ShinyType::Shiny => 1,
            ShinyType::Mythical => 2,
        }
    }
}

/// Information representing a necromancer drone.
#[derive(Debug, Clone)]
pub struct NecromancerDrone
{
    pub ai: AI,
    pub damage: f32,
    pub penetration: f32,
    pub elasticity: f32,
    pub friction: f32,
    pub speed: f32,
    pub lifetime: f32,
    pub turret: u8,
    pub turret_owner: u32,
    pub turret_owner_clan: Option<u8>,
    pub shiny_scale: f32,
}

/// State for necromancy.
#[derive(Debug, Clone)]
pub enum Necromancy
{
    None,
    Tank(NecromancerDrone),
    Projectile(Vec<u32>),
}

/// An entity representing a shape.
#[derive(Debug)]
pub struct ShapeEntity
{
    pub base_entity: BaseEntity,
    pub shape: ShapeType,
    pub shiny: ShinyType,

    /// A potential AI associated with the shape.
    pub ai: Option<AI>,
    /// Potential information about necromancy.
    pub necromancer_drone: Necromancy,
}

impl GenericEntityHelpers for ShapeEntity
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
        if let GenericEntity::Shape(shape) = entity1 {
            if shape.base_entity.health <= 0.0 {
                shape.kill(entity2);
            }

            if shape.shape == ShapeType::AlphaPentagon {
                shape
                    .base_entity
                    .velocity
                    .set_magnitude(0.03 * shape.base_entity.identity.base_speed);
            }
        }
    }

    fn take_census(&self, stream: &mut SwiftStream)
    {
        if !self.base_entity.alive {
            stream.write_u8(0);
            return;
        }

        stream.write_u8(11); // REPLACE WHEN NEEDED.
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
                CensusProperties::Clan => {
                    if let Some(clan) = self.base_entity.clan {
                        stream.write_u8(clan);
                    } else {
                        stream.write_u8(MAX_CLANS + 1);
                    }
                }
                CensusProperties::ShapeType => stream.write_u8(self.shape.as_int()),
                CensusProperties::Shiny => stream.write_u8(self.shiny.as_int()),
                _ => stream.backspace(1),
            }
        }
    }

    fn kill(&mut self, killer: &mut GenericEntity)
    {
        self.base_entity.alive = false;
        let score = constrain!(
            0.0,
            self.base_entity.identity.score_yield,
            get_score_from_level(LEVEL_TO_SCORE_TABLE.len() as u8)
        );

        match killer {
            GenericEntity::Tank(t) => {
                t.score += score;

                // Check for necromancy.
                if self.shape == ShapeType::Square {
                    let id: Result<EntityIdentityIds, ()> = t.base_entity.identity.id.try_into();
                    if id == Ok(EntityIdentityIds::Necromancer) {
                        let max_drones = 11
                            + t.stats.stat_investments[UpgradeStats::ProjectileReload as usize]
                                as i32;
                        let mut turret_spawner: Option<&mut Turret> = None;
                        let mut turret_idx: Option<u8> = None;

                        for (i, turret) in t.base_entity.identity.turrets.iter_mut().enumerate() {
                            turret.max_projectile_count = max_drones;
                            if turret.projectile_count < max_drones {
                                turret_idx = Some(i as u8);
                                turret_spawner = Some(turret);
                                break;
                            }
                        }

                        if let Some(turret) = turret_spawner {
                            turret.projectile_count += 1;

                            let speed = (turret.projectile_speed + 5.0 + (t.stats.stat_investments[UpgradeStats::ProjectileSpeed as usize] as f32) * 2.0) - randf!(0.0, 1.0) * turret.scatter_rate;

                            let damage = turret.projectile_damage
                                * ((1.0_f32
                                    + t.stats.stat_investments
                                        [UpgradeStats::ProjectileDamage as usize]
                                        as f32)
                                    * 1.25);
                            let penetration = turret.projectile_penetration
                                * ((6.0_f32
                                    * t.stats.stat_investments
                                        [UpgradeStats::ProjectilePenetration as usize]
                                        as f32)
                                    + 4.0);
                            let radius = self.base_entity.radius;

                            let position = self.base_entity.position;
                            let velocity = Vec2::default();

                            let ai =
                                AI::new(t.base_entity.id, true, true, TankBot::Not, |_, _, _, _| true);

                            self.necromancer_drone = Necromancy::Tank(NecromancerDrone {
                                ai,
                                damage,
                                penetration,
                                elasticity: turret.elasticity,
                                friction: turret.friction,
                                speed,
                                lifetime: turret.bullet_lifetime,
                                turret: turret_idx.unwrap(),
                                turret_owner: t.base_entity.id,
                                turret_owner_clan: t.base_entity.clan,
                                shiny_scale: if self.shiny == ShinyType::Normal {
                                    1.0
                                } else if self.shiny == ShinyType::Shiny {
                                    10.0
                                } else {
                                    100.0
                                },
                            });

                            t.base_entity.owned_entities.push(self.base_entity.id);
                        }
                    }
                }
            }
            GenericEntity::Projectile(p) => {
                p.score_gained += score;

                if self.shape == ShapeType::Square && p.resurrected {
                    self.necromancer_drone = Necromancy::Projectile(p.base_entity.owned_by.clone());
                }
            }
            _ => (),
        }
    }
}

impl ShapeEntity
{
    pub fn new(game_server: &mut GameServer, mut shape_type: ShapeType, position: Option<Vec2>)
    {
        let mut identity: EntityIdentity = shape_type.try_into().unwrap();
        if (identity.radius <= 0.0) {
            error!("Identity radius less than zero for a shape.");
        }

        let mut ai: Option<AI> = None;

        let chance = randf!(0.0, 1.0) * ((shape_type.as_int() + 1) as f32);
        let mut shiny = if chance < 0.0001 {
            ShinyType::Mythical
        } else if chance < 0.001 {
            ShinyType::Shiny
        } else {
            ShinyType::Normal
        };
        if (shape_type == ShapeType::SmallCrasher) || (shape_type == ShapeType::LargeCrasher) {
            shiny = ShinyType::Normal;
        }

        match shiny {
            ShinyType::Normal => (),
            ShinyType::Shiny => {
                identity.score_yield *= 10.0;
                identity.max_health *= 10.0;
            }
            ShinyType::Mythical => {
                identity.score_yield *= 100.0;
                identity.max_health *= 100.0;
            }
        }

        let mut base_entity = BaseEntity::new(game_server, identity.radius, identity);
        if let Some(p) = position {
            base_entity.position = p;
        }
        let id = base_entity.id;
        let position = base_entity.position;
        let radius = base_entity.radius;

        if (shape_type == ShapeType::SmallCrasher) || (shape_type == ShapeType::LargeCrasher) {
            ai = Some(AI::new(id, false, false, TankBot::Not, |_, _, _, _| true));
        }

        let wrapped_generic_entity = GenericEntity::Shape(ShapeEntity {
            base_entity,
            shape: shape_type,
            shiny,
            ai,
            necromancer_drone: Necromancy::None,
        });

        BaseEntity::add_to_game_server(game_server, wrapped_generic_entity, position, radius);
    }

    /// Moves the shape forward one frame in time.
    pub fn tick(
        &mut self,
        entities: &EntityDataStructure,
        shg: &mut SpatialHashGrid,
        config: &GameServerConfig,
        dt: f32,
    ) -> (bool, Option<(ProjectileConstructionInfo, u32, Option<u8>)>)
    {
        if !self.base_entity.alive {
            match self.necromancer_drone.to_owned() {
                Necromancy::Tank(information) => {
                    // todo: projectile has shiny yield
                    let projectile: ProjectileConstructionInfo = ProjectileConstructionInfo {
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
                        radius: self.base_entity.radius,
                        position: self.base_entity.position,
                        velocity: Vec2::default(),
                        turret: (information.turret, 0),
                        minion_turret: None,
                    };

                    return (
                        false,
                        Some((
                            projectile,
                            information.turret_owner,
                            information.turret_owner_clan,
                        )),
                    );
                }
                Necromancy::Projectile(owners) => {
                    for owner in owners.into_iter() {
                        let entity = entities.get(&owner);
                        if let Some(t) = entity
                            && let GenericEntity::Tank(t) = &mut *t.borrow_mut()
                        {
                            let id: Result<EntityIdentityIds, ()> =
                                t.base_entity.identity.id.try_into();
                            if id == Ok(EntityIdentityIds::Necromancer) {
                                let max_drones = 11
                                    + t.stats.stat_investments
                                        [UpgradeStats::ProjectileReload as usize]
                                        as i32;
                                let mut turret_spawner: Option<&mut Turret> = None;
                                let mut turret_idx: Option<u8> = None;

                                for (i, turret) in
                                    t.base_entity.identity.turrets.iter_mut().enumerate()
                                {
                                    turret.max_projectile_count = max_drones;
                                    if turret.projectile_count < max_drones {
                                        turret_idx = Some(i as u8);
                                        turret_spawner = Some(turret);
                                        break;
                                    }
                                }

                                if let Some(turret) = turret_spawner {
                                    turret.projectile_count += 1;

                                    let speed = (turret.projectile_speed + 5.0 + (t.stats.stat_investments[UpgradeStats::ProjectileSpeed as usize] as f32) * 2.0) - randf!(0.0, 1.0) * turret.scatter_rate;

                                    let damage = turret.projectile_damage
                                        * ((1.0_f32
                                            + t.stats.stat_investments
                                                [UpgradeStats::ProjectileDamage as usize]
                                                as f32)
                                            * 1.25);
                                    let penetration = turret.projectile_penetration
                                        * ((6.0_f32
                                            * t.stats.stat_investments
                                                [UpgradeStats::ProjectilePenetration as usize]
                                                as f32)
                                            + 4.0);
                                    let radius = self.base_entity.radius;

                                    let ai = AI::new(
                                        t.base_entity.id,
                                        true,
                                        true,
                                        TankBot::Not,
                                        |_, _, _, _| true,
                                    );

                                    let projectile = ProjectileConstructionInfo {
                                        projectile_type: ProjectileType::NecromancerDrone,
                                        ai: Some(ai),
                                        damage,
                                        penetration,
                                        elasticity: turret.elasticity,
                                        friction: turret.friction,
                                        speed,
                                        lifetime: turret.bullet_lifetime,
                                        pass_through_walls: false,
                                        prevent_ai: false,
                                        resurrected: true,
                                        radius,
                                        position: self.base_entity.position,
                                        velocity: Vec2::default(),
                                        turret: (turret_idx.unwrap(), 0),
                                        minion_turret: None,
                                    };

                                    return (
                                        false,
                                        Some((projectile, t.base_entity.id, t.base_entity.clan)),
                                    );
                                }
                            }
                        }
                    }
                }
                _ => (),
            }

            return (false, None);
        }

        self.base_entity.tick(shg, config, true, dt);

        if self.shape != ShapeType::LargeCrasher && self.shape != ShapeType::SmallCrasher {
            let soft_border_left = (config.arena_size / 7.0/* 2 * ARENA_SIZE / 14 */);
            let soft_border_right = (6.0 * config.arena_size / 7.0/* 2 * ARENA_SIZE / 14 */);

            if self.base_entity.position.x < soft_border_left
                || self.base_entity.position.x > soft_border_right
            {
                self.base_entity.velocity.x *= -1.0;
            } else if self.base_entity.position.y < soft_border_left
                || self.base_entity.position.y > soft_border_right
            {
                self.base_entity.velocity.y *= -1.0;
            }
        }

        let mut idle = true;

        if let Some(ref mut ai) = self.ai {
            let radius = 1120.0 * self.base_entity.identity.base_fov;
            let surroundings: Vec<u32> = shg
                .query_radius(
                    self.base_entity.id,
                    self.base_entity.position - Vec2::new(radius, radius),
                    radius,
                )
                .into_iter()
                .filter(|entity| {
                    let entity = entities.get(entity);
                    if let Some(entity) = entity {
                        let entity = &*entity.borrow();
                        matches!(Some(entity), Some(GenericEntity::Tank(_)))
                    } else {
                        false
                    }
                })
                .collect();

            ai.tick(
                self.base_entity.radius,
                self.base_entity.position,
                None,
                entities,
                Some(surroundings),
            );
            idle = ai.state == AIState::Idle;

            if !idle {
                self.base_entity.angle = ai.movement.angle(None);
                self.base_entity.velocity +=
                    (ai.movement * self.base_entity.identity.base_speed) * dt;
            }
        }

        if idle {
            self.base_entity.angle = normalise_angle!(
                self.base_entity.angle + (0.01 * self.base_entity.identity.base_speed * dt)
            );
            self.base_entity.velocity += Vec2::from_polar(
                0.03 * self.base_entity.identity.base_speed,
                self.base_entity.angle,
            ) * dt;
        }

        self.base_entity.regen_per_tick = self.base_entity.max_health / 25000.0;

        (true, None)
    }
}
