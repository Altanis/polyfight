use std::{
    borrow::Borrow,
    cell::RefCell,
    collections::HashMap,
};

use crate::{
    game::server::{
        EntityDataStructure,
        GameServer,
    },
    normalise_angle,
    physics::vec2::Vec2,
    warn,
};

use super::{
    base_entity::{
        GenericEntity,
        GenericEntityHelpers,
    }, projectile_entity::ProjectileType, shape_entity::{
        ShapeEntity,
        ShapeType,
    }
};

/// The state of an entity being controlled by AI.
#[derive(Debug, Clone, PartialEq, PartialOrd)]
pub enum AIState
{
    /// The AI has no target.
    Idle,
    /// The AI found a target.
    Active(u32),
    /// The AI is being possessed by an actor (a mouse).
    Possessed(Vec2),
}

#[derive(Debug, Clone, PartialEq, PartialOrd)]
pub enum TankBot {
    Not,
    Stupid,
    Smart
}

/// Influences an entity's movement.
#[derive(Debug, Clone, PartialEq, PartialOrd)]
pub struct AI
{
    /// The aim of the entity.
    pub aim: Vec2,
    /// How fast the entity should move.
    pub speed: f32,
    /// The final movement vector at each tick.
    pub movement: Vec2,
    /// Whether or not the aim is influenced by the mouse.
    pub mouse_influence: bool,
    /// The state of the AI.
    pub state: AIState,
    /// The entity which owns the AI.
    pub owner: u32,
    /// Whether or not the AI predicts.
    pub prediction: bool,
    /// Whether or not the AI should target projectiles.
    pub tank_bot: TankBot,
    /// Filters out which entities shouldn't be targetted.
    pub filter: fn(&mut AI, Vec2, f32, Vec2) -> bool,
}

impl AI
{
    pub fn new(
        owner: u32,
        mouse_influence: bool,
        prediction: bool,
        tank_bot: TankBot,
        filter: fn(&mut AI, Vec2, f32, Vec2) -> bool,
    ) -> AI
    {
        AI {
            aim: Vec2::default(),
            speed: 1.0,
            movement: Vec2::default(),
            mouse_influence,
            state: AIState::Idle,
            owner,
            prediction,
            tank_bot,
            filter,
        }
    }

    fn get_target(
        &mut self,
        owner_radius: f32,
        owner_position: Vec2,
        owner_clan: Option<u8>,
        entities: &EntityDataStructure,
        surroundings: Vec<u32>,
    ) -> Option<u32>
    {
        if let AIState::Active(id) = self.state {
            if !surroundings.contains(&id) {
                self.state = AIState::Idle;
            } else {
                return Some(id);
            }
        }

        if self.state == AIState::Idle {
            let mut valuation = 0.0;
            let mut s: Option<u32> = None;
            let mut tank_exists = false;

            for surrounding in surroundings {
                let e = entities.get(&surrounding);
                if let Some(e) = e {
                    let e = &*e.borrow();
                    if !e.get_base_entity().perform_collisions {
                        continue;
                    }

                    let mut score = 0.0;
                    match e {
                        GenericEntity::Tank(t) => {
                            if !t.base_entity.alive || t.spawning || t.opacity == 0.0 {
                                continue;
                            }

                            if !tank_exists {
                                tank_exists = true;
                                valuation = 0.0;
                            }

                            score = t.score;
                        }
                        GenericEntity::Shape(s) => {
                            if tank_exists {
                                continue;
                            }

                            if self.tank_bot == TankBot::Smart && (s.shape == ShapeType::Square || s.shape == ShapeType::Triangle)
                            {
                                continue;
                            }

                            score = s.base_entity.identity.score_yield;
                        }
                        GenericEntity::Projectile(p) => {
                            // if !self.is_tank_bot {
                                // continue;
                            // }

                            if !(self.tank_bot == TankBot::Smart && matches!(p.projectile_type, ProjectileType::Drone | ProjectileType::NecromancerDrone | ProjectileType::Minion)) {
                                continue;
                            }

                            // score = p.base_entity.identity.score_yield;
                        }
                        _ => continue,
                    };

                    let base_entity = e.get_base_entity();
                    let distance = base_entity.position.distance(owner_position);

                    if !(self.filter)(
                        self,
                        base_entity.position,
                        base_entity.angle,
                        owner_position,
                    ) || (owner_clan.is_some() && owner_clan == base_entity.clan)
                    {
                        continue;
                    };

                    // formula based on score and distance
                    // if self.is_tank_bot
                    // {
                    //     let target_distance = distance;
                    //     let target_score = score;
                    //     let target_valuation = target_score / target_distance;

                    //     if (target_valuation > valuation) || valuation == 0.0
                    //     {
                    //         valuation = target_valuation;
                    //         s = Some(surrounding);
                    //     }
                    // }
                    // else
                    // {
                    //     let target_distance = distance;
                    //     if (target_distance < valuation) || valuation == 0.0
                    //     {
                    //         valuation = target_distance;
                    //         s = Some(surrounding);
                    //     }
                    // }
                    // TODO: retest
                    // if distance < valuation || valuation == 0.0
                    // {
                    //     valuation = distance;
                    //     s = Some(surrounding);
                    // }

                    let target_distance = distance;
                    if (target_distance < valuation) || valuation == 0.0 {
                        valuation = target_distance;
                        s = Some(surrounding);
                    }
                }
            }

            if let Some(s) = s {
                self.state = AIState::Active(s);
                return Some(s);
            }

            return None;
        }

        None
    }

    pub fn tick(
        &mut self,
        owner_radius: f32,
        owner_position: Vec2,
        owner_clan: Option<u8>,
        entities: &EntityDataStructure,
        surroundings: Option<Vec<u32>>,
    )
    {
        // if let AIState::Active(_) = self.state && self.is_tank_bot {
            // return;
        // }

        if let AIState::Possessed(mouse) = self.state {
            self.aim = mouse;
            self.movement = Vec2::from_polar(1.0, self.aim.angle(Some(owner_position)));
        } else if let Some(surroundings) = surroundings {
            let target = self.get_target(
                owner_radius,
                owner_position,
                owner_clan,
                entities,
                surroundings,
            );
            if let Some(id) = target {
                let entity = entities.get(&id);
                if let Some(e) = entity {
                    let e = &*e.borrow();

                    let base_entity = e.get_base_entity();
                    if !base_entity.alive {
                        self.state = AIState::Idle;
                    }

                    if self.prediction {
                        let delta = base_entity.position - owner_position;
                        // let dist = (delta.x.powf(2.0) + delta.y.powf(2.0)).sqrt();
                        let dist = delta.magnitude();
                        let unit_dist_perp = Vec2::new(-delta.y, delta.x) * (1.0 / dist);

                        // let mut ent_perp_comp = unit_dist_perp.x * base_entity.velocity.x +
                        // unit_dist_perp.y * base_entity.velocity.y;
                        let mut ent_perp_comp = unit_dist_perp.dot(base_entity.velocity);
                        let movement_speed = self.speed * 1.6;

                        if ent_perp_comp > (movement_speed * 0.9) {
                            ent_perp_comp = movement_speed * 0.9
                        } else if ent_perp_comp < (movement_speed * -0.9) {
                            ent_perp_comp = movement_speed * -0.9
                        }

                        let direct_comp =
                            (movement_speed.powf(2.0) - ent_perp_comp.powf(2.0)).sqrt();
                        let offset = (ent_perp_comp / direct_comp * dist) / 2.0;

                        self.aim = base_entity.position + (unit_dist_perp * offset);

                        // let displacement = base_entity.position - owner_position;
                        // let mut distance = displacement.magnitude();
                        // if distance == 0.0 { distance = 1.0 };

                        // let orthogonal = displacement * (1.0 / distance);
                        // let mut component = orthogonal.dot(base_entity.velocity);
                        // let movement_speed = self.speed * 1.6;

                        // if component > movement_speed * 0.9 { component = movement_speed * 0.9 }
                        // if component < movement_speed * -0.9 { component = movement_speed * -0.9
                        // };

                        // let direct = (movement_speed.powf(2.0) - component.powf(2.0));
                        // let offset = (component / direct * distance) / 2.0;

                        // self.aim = Vec2::new(base_entity.position.x + offset * orthogonal.x,
                        // base_entity.position.y + offset * orthogonal.y);
                    } else {
                        self.aim = base_entity.position;
                    }

                    self.movement = Vec2::from_polar(1.0, self.aim.angle(Some(owner_position)));
                } else {
                    self.state = AIState::Idle;
                }
            } else {
                self.state = AIState::Idle;
            }
        } else {
            warn!("Called non-possessed AI's tick function with None for the surroundings.");
        }
    }
}
