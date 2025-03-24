use crate::game::entity::{
    ai::AI,
    tank_entity::TankEntity,
};

use super::super::projectile_entity::{
    ProjectileEntity,
    ProjectileType,
};

/// A struct representing a turret.
#[derive(Debug, Clone, PartialEq, PartialOrd)]
pub struct Turret
{
    /// The angle the turret is from the body.
    pub angle: f32,
    pub x_offset: f32,
    pub size_factor: f32,
    pub length: u8,
    pub width: u8,
    pub recoil: f32,
    pub scatter_rate: f32,
    pub friction: f32,

    pub projectile_type: ProjectileType,
    /// The number of projectiles (which still exist) the turret spawned.
    pub projectile_count: i32,
    /// The maximum number of projectiles the turret can spawn. -1 for no limit.
    pub max_projectile_count: i32,
    pub projectile_damage: f32,
    pub projectile_penetration: f32,
    pub projectile_speed: f32,
    pub bullet_lifetime: f32,

    /// The AI potentially controlling the turret.
    pub ai: Option<AI>,

    pub reload: f32,
    pub delay: f32,
    /// The cached reload time of the turret.
    pub reload_time: f32,
    /// The position the turret is in the shooting cycle.
    pub cycle_position: f32,

    /// The turrets this turret owns.
    pub turrets: Vec<Turret>,

    pub elasticity: f32,
}

impl Turret
{
    pub fn shoot(&mut self, tank: &mut TankEntity)
    {
        // let projectile_damage = turret.projectile_damage * ((1.0_f32 +
        // tank.stats.stat_investments[UpgradeStats::ProjectileDamage as usize] as f32) * 1.5);
        // let projectile_pentration = turret.projectile_penetration * ((6.0_f32 *
        // tank.stats.stat_investments[UpgradeStats::ProjectilePenetration as usize] as f32) + 4.0);
        // let radius = (turret.width / 2) as f32 * (tank.base_entity.radius / BASE_TANK_RADIUS) *
        // turret.size_factor;

        // let scatter_angle = (std::f32::consts::PI / 180.0) * turret.scatter_rate * (randf!(0.0,
        // 1.0) - 0.5) * 10.0; let projectile_angle = tank.base_entity.angle + turret.angle
        // + scatter_angle;

        // let mut position = tank.base_entity.position +
        //     Vec2::from_polar(tank.base_entity.radius + radius + (25.0) + 1.0, projectile_angle);
        // position.x -= (turret.x_offset * (tank.base_entity.radius / BASE_TANK_RADIUS)) *
        // (projectile_angle).sin(); position.y +=  (turret.x_offset *
        // (tank.base_entity.radius / BASE_TANK_RADIUS)) * (projectile_angle).cos();

        // let velocity =
        //     Vec2::from_polar(
        //         (turret.projectile_speed +
        // (tank.stats.stat_investments[UpgradeStats::ProjectileSpeed as usize] as f32) * 1.5) -
        // randf!(0.0, 1.0) * turret.scatter_rate,         projectile_angle
        //     );

        // let id = ProjectileEntity::new(game_server, turret.projectile_type, projectile_damage,
        // projectile_pentration, turret.elasticity, turret.friction, turret.projectile_speed,
        // turret.bullet_lifetime, radius, position, velocity, i as u8).await;
        // let projectile = game_server.entities[id as usize].as_mut().unwrap();

        // projectile.get_mut_base_entity().owned_by.push(tank.base_entity.id);
        // tank.base_entity.owned_entities.push(id);
        // tank.base_entity.velocity -= Vec2::from_polar(turret.recoil, projectile_angle);

        // tank.last_shoot = tank.base_entity.ticks as usize;

        // turret.cycle_position = reload_time * turret.delay;
    }
}
