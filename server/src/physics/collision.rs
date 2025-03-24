use std::sync::{
    Arc,
    Mutex,
};

use crate::{
    connection::packets::CensusProperties,
    debug,
    game::entity::base_entity::{
        BaseEntity,
        GenericEntity,
        GenericEntityHelpers,
    },
    utils::{
        self,
        config,
    },
};

use super::vec2::Vec2;

pub fn detect_collision(entity1: &mut BaseEntity, entity2: &mut BaseEntity) -> bool
{
    if !entity1.alive || !entity2.alive {
        return false;
    }

    let distance = entity1.position.distance(entity2.position);
    let overlap = (entity1.radius + entity2.radius) - distance;

    if (overlap <= 0.0) {
        return false;
    }

    true
}

pub fn resolve_collision(entity1: &mut GenericEntity, entity2: &mut GenericEntity)
{
    let ELASTICITY_FORCE = 5.0;

    let entity1_elasticity = {
        if let GenericEntity::Projectile(p) = entity1 {
            -ELASTICITY_FORCE + 0.5
        } else {
            entity1.get_base_entity().identity.elasticity
        }
    };

    let entity2_elasticity = {
        if let GenericEntity::Projectile(p) = entity2 {
            -ELASTICITY_FORCE
        } else {
            entity1.get_base_entity().identity.elasticity
        }
    };

    let entity1 = entity1.get_mut_base_entity();
    let entity2 = entity2.get_mut_base_entity();

    let angle = entity1.position.angle(Some(entity2.position));
    let total_radius = entity1.radius + entity2.radius;

    entity1.velocity += Vec2::from_polar(
        (entity1_elasticity + ELASTICITY_FORCE) * (entity2.radius / total_radius),
        angle,
    );
    entity2.velocity -= Vec2::from_polar(
        (entity2_elasticity + ELASTICITY_FORCE) * (entity1.radius / total_radius),
        angle,
    );

    // let common_elasticity = (entity1.identity.elasticity + entity2.identity.elasticity) / 2.0;
    // let entity1_adjusted_elasticity = common_elasticity * (entity1.radius / total_radius);
    // let entity2_adjusted_elasticity = common_elasticity * (entity2.radius / total_radius);

    // entity1.velocity += Vec2::from_polar(entity1_adjusted_elasticity, angle);
    // entity2.velocity -= Vec2::from_polar(entity2_adjusted_elasticity, angle);
}

// pub fn resolve_collision(entity1: &mut BaseEntity, entity2: &mut BaseEntity, overlap: f32, mut
// axis: Vec2) {
//     if (entity1.position.dot(axis) < entity2.position.dot(axis)) { axis *= -1.0; }

//     let mut correction = axis * overlap;
//     let angle = correction.angle(None);

//     entity1.velocity += correction;
//     entity2.velocity -= correction;

//     // let angle = entity1.position.angle(Some(entity2.position));

//     // if entity1.id > entity2.id
//     // {
//     //     entity1.velocity -= Vec2::from_polar(1.0, angle);
//     //     entity2.velocity += Vec2::from_polar(1.0, angle);
//     // }
//     // else
//     // {
//     //     entity1.velocity += Vec2::from_polar(1.0, angle);
//     //     entity2.velocity -= Vec2::from_polar(1.0, angle);
//     // }

//     // entity1.velocity += Vec2::from_polar(30.0,  angle);
//     // entity2.velocity -= Vec2::from_polar(30.0, angle);
// }

// pub fn resolve_collision(entity1: &mut BaseEntity, entity2: &mut BaseEntity, overlap: f32, mut
// axis: Vec2) {
//     if (entity1.position.dot(axis) < entity2.position.dot(axis)) { axis *= -1.0; }

//     let correction = axis * overlap;
//     let angle = correction.angle(None);

//     // entity1.position += correction;
//     entity1.velocity += Vec2::from_polar(30.0, angle);

//     // entity2.position -= correction;
//     entity2.velocity -= Vec2::from_polar(30.0, angle);
// }
