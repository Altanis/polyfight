use rand::Rng;
use std::{
    cell::RefCell,
    collections::HashSet,
    sync::Arc,
};
use tokio::sync::Mutex;

use strum::{
    EnumCount,
    IntoEnumIterator,
};

use crate::{
    connection::packets::CensusProperties,
    constrain,
    debug,
    error,
    game::server::{
        GameServer,
        GameServerConfig,
    },
    physics::{
        collision,
        shg::SpatialHashGrid,
        vec2::Vec2,
    },
    randf,
    seconds_to_ticks,
    utils::{
        self,
        config::{
            self,
            BASE_TANK_RADIUS,
        },
        stream::SwiftStream,
        timed_mutex::AsyncTimedLock,
    },
};

use super::{
    components::entity_identity::EntityIdentity,
    projectile_entity::ProjectileEntity,
    shape_entity::ShapeEntity,
    tank_entity::TankEntity,
};

/// An enum representing any type of entity.
#[derive(Debug)]
pub enum GenericEntity
{
    Tank(TankEntity),
    Shape(ShapeEntity),
    Projectile(ProjectileEntity),
    Placeholder,
}

impl GenericEntity
{
    pub fn as_int(&self) -> i8
    {
        match self {
            GenericEntity::Placeholder => -1,
            GenericEntity::Tank(_) => 0,
            GenericEntity::Shape(_) => 1,
            GenericEntity::Projectile(_) => 2,
        }
    }
}

/// A trait implementable across every generic entity.
pub trait GenericEntityHelpers
{
    fn get_base_entity(&self) -> &BaseEntity;
    fn get_mut_base_entity(&mut self) -> &mut BaseEntity;
    fn handle_collision(entity1: &mut GenericEntity, entity2: &mut GenericEntity);
    fn take_census(&self, stream: &mut SwiftStream);
    fn kill(&mut self, killer: &mut GenericEntity);
}

/// A class representing a generic entity.
#[derive(Debug, Clone)]
pub struct BaseEntity
{
    pub id: u32,

    pub ticks: u32,
    pub last_damage_tick: u32,
    pub regen_per_tick: f32,

    /// The damage the entity exerts upon collision.
    pub damage_exertion: f32,

    pub position: Vec2,
    pub velocity: Vec2,
    pub mouse: Vec2,
    pub angle: f32,
    pub radius: f32,
    pub speed: f32,
    pub invincible: bool,
    pub force_invincible: bool,
    pub perform_collisions: bool,

    /// A vector of IDs which the entity owns.
    pub owned_entities: Vec<u32>,
    /// A vector of owner IDs.
    pub owned_by: Vec<u32>,

    pub health: f32,
    pub max_health: f32,
    pub alive: bool,
    /// The clan the entity is a part of.
    pub clan: Option<u8>,

    pub identity: EntityIdentity,

    /// Whether or not the entity is new.
    pub new: bool,
}

impl GenericEntityHelpers for GenericEntity
{
    fn get_base_entity(&self) -> &BaseEntity
    {
        match self {
            GenericEntity::Tank(t) => t.get_base_entity(),
            GenericEntity::Shape(s) => s.get_base_entity(),
            GenericEntity::Projectile(p) => p.get_base_entity(),
            GenericEntity::Placeholder => panic!("get_base_entity() called on placeholder entity?"),
        }
    }

    fn get_mut_base_entity(&mut self) -> &mut BaseEntity
    {
        match self {
            GenericEntity::Tank(t) => t.get_mut_base_entity(),
            GenericEntity::Shape(s) => s.get_mut_base_entity(),
            GenericEntity::Projectile(p) => p.get_mut_base_entity(),
            GenericEntity::Placeholder => {
                panic!("get_mut_base_entity() called on placeholder entity?")
            }
        }
    }

    fn handle_collision(entity1: &mut GenericEntity, entity2: &mut GenericEntity)
    {
        match entity1 {
            GenericEntity::Tank(_) => TankEntity::handle_collision(entity1, entity2),
            GenericEntity::Shape(_) => ShapeEntity::handle_collision(entity1, entity2),
            GenericEntity::Projectile(_) => ProjectileEntity::handle_collision(entity1, entity2),
            GenericEntity::Placeholder => {
                panic!("handle_collision() called on placeholder entity?")
            }
        }
    }

    fn take_census(&self, stream: &mut SwiftStream)
    {
        match self {
            GenericEntity::Tank(t) => t.take_census(stream),
            GenericEntity::Shape(s) => s.take_census(stream),
            GenericEntity::Projectile(p) => p.take_census(stream),
            GenericEntity::Placeholder => panic!("take_census() called on placeholder entity?"),
        }
    }

    fn kill(&mut self, killer: &mut GenericEntity)
    {
        match self {
            GenericEntity::Tank(t) => t.kill(killer),
            GenericEntity::Shape(s) => s.kill(killer),
            GenericEntity::Projectile(p) => p.kill(killer),
            GenericEntity::Placeholder => panic!("kill() called on placeholder entity?"),
        }
    }
}

impl BaseEntity
{
    pub fn new(game_server: &mut GameServer, radius: f32, identity: EntityIdentity) -> Self
    {
        BaseEntity {
            id: game_server.find_entity_id(),
            ticks: 0,
            regen_per_tick: 0.0,
            last_damage_tick: 0,
            damage_exertion: identity.damage_exertion,
            position: game_server.find_spawn_position(),
            velocity: Vec2::default(),
            mouse: Vec2::default(),
            angle: randf!(-3.13, 3.13),
            radius,
            speed: identity.base_speed,
            invincible: false,
            force_invincible: false,
            perform_collisions: true,
            owned_entities: Vec::new(),
            owned_by: Vec::new(),
            health: identity.max_health,
            max_health: identity.max_health,
            alive: true,
            clan: None,
            identity,
            new: true,
        }
    }

    /// Checks if the entity should collide with another.
    pub fn should_collide(&self, other: &BaseEntity) -> bool
    {
        if !self.perform_collisions || !other.perform_collisions {
            return false;
        }

        for self_owner in self.owned_by.iter() {
            if other.owned_by.contains(self_owner)
                || other.id == *self_owner
                || (self.clan.is_some() && self.clan == other.clan)
            // If the other entity is the owner or also owned by the same entity.
            {
                return false;
            }
        }

        for self_owner in other.owned_by.iter() {
            if self.owned_by.contains(self_owner)
                || self.id == *self_owner
                || (self.clan.is_some() && self.clan == other.clan)
            // If the other entity is the owner or also owned by the same entity.
            {
                return false;
            }
        }

        if (self.clan.is_some() && self.clan == other.clan) {
            return false;
        }

        true
    }

    /// Adds the entity to the server.
    pub fn add_to_game_server(
        game_server: &mut GameServer,
        generic_entity: GenericEntity,
        position: Vec2,
        radius: f32,
    )
    {
        let id = generic_entity.get_base_entity().id;

        if id > (u32::MAX - 10000) {
            error!("Dangerously close to u32::MAX. Restart server soon.");
        }

        // debug!("Entity with ID ", id, "has joined. The size of the EntityDataStructure is ",
        // game_server.entities.len());

        game_server
            .entities
            .insert(id, RefCell::new(generic_entity));
        game_server.spatial_hash_grid.insert(id, position, radius);
    }

    /// Moves the entity forward one frame in time.
    pub fn tick(
        &mut self,
        shg: &mut SpatialHashGrid,
        config: &GameServerConfig,
        bounce: bool,
        dt: f32,
    )
    {
        self.ticks += 1;

        if self.health <= 0.0 {
            self.alive = false;
        } else if self.health < self.max_health {
            self.health += self.regen_per_tick * dt;
            if (self.ticks - self.last_damage_tick) >= seconds_to_ticks!(30) as u32 {
                self.health += (self.max_health / 250.0) * dt;
            }
        }

        if self.invincible || self.force_invincible {
            self.health = self.max_health;
        }

        if !self.velocity.is_zero(1e-3) {
            self.position += self.velocity * dt;
            self.velocity *= config::FRICTION * dt;

            if self.position.x < 0.0
                || self.position.x > config.arena_size
                || self.position.y < 0.0
                || self.position.y > config.arena_size
            {
                if bounce {
                    self.velocity *= -1.0;
                }

                self.position.x = constrain!(0.0, self.position.x, config.arena_size);
                self.position.y = constrain!(0.0, self.position.y, config.arena_size);
            }

            // self.position.x = constrain!(0.0, self.position.x, config::ARENA_SIZE);
            // self.position.y = constrain!(0.0, self.position.y, config::ARENA_SIZE);

            shg.reinsert(self.id, self.position, self.radius);
        }
    }
}
