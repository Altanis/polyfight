import { TAU } from "../utils/functions";
import { TankCategories } from "./enums";

export interface EntityIdentity
{
    name: string;
    turrets: Turret[];
    category: TankCategories;
    max_stats: number[];
    speed: number;
    rotators?: Rotator[];
    disable_mouse?: boolean;
    upgrade_notif?: string[];
    translation?: number;
    square?: boolean;
};

export interface Turret
{
    angle: number;
    target_angle?: number;
    x_offset: number;
    y_offset?: number;
    length: number;
    width: number;
    trapezoidal: boolean;
    trapezoid_reverse?: boolean;
    z_index?: number;
    auto?: boolean;
    dominant?: boolean;
    rotates?: boolean;
    turrets?: Turret[];
};

export interface Rotator
{
    rpt: number;
    size: number;
    sides: number;
    angle: number;
};

export const TANK_DEFS: Array<EntityIdentity> =
[
    {
        "name": "Projectile",
        "turrets": [],
        "max_stats": new Array(9).fill(0),
        "category": TankCategories.Illegal,
        "speed": 0
    },
    {
        "name": "Square",
        "turrets": [],
        "max_stats": new Array(9).fill(0),
        "category": TankCategories.Illegal,
        "speed": 1
    },
    {
        "name": "Triangle",
        "turrets": [],
        "max_stats": new Array(9).fill(0),
        "category": TankCategories.Illegal,
        "speed": 1
    },
    {
        "name": "Crasher",
        "turrets": [],
        "max_stats": new Array(9).fill(0),
        "category": TankCategories.Illegal,
        "speed": 1.5
    },
    {
        "name": "Large Crasher",
        "turrets": [],
        "max_stats": new Array(9).fill(0),
        "category": TankCategories.Illegal,
        "speed": 1.5
    },
    {
        "name": "Pentagon",
        "turrets": [],
        "max_stats": new Array(9).fill(0),
        "category": TankCategories.Illegal,
        "speed": 1
    },
    {
        "name": "Alpha Pentagon",
        "turrets": [],
        "max_stats": new Array(9).fill(0),
        "category": TankCategories.Illegal,
        "speed": 0.3
    },


    {
        "name": "Basic Tank",
        "speed": 1,
        "turrets": [
            {
                "angle": 0.0,
                "x_offset": 0.0,
                "length": 57,
                "width": 24,
                "trapezoidal": false
            }
        ],
        "max_stats": [7, 7, 7, 7, 7, 7, 7, 7, 7],
        "category": TankCategories.Spammer
    },
    {
        "name": "Twin",
        "speed": 1,
        "turrets": [
            {
                "angle": 0.0,
                "x_offset": -16.0,
                "length": 57,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": 0.0,
                "x_offset": 16.0,
                "length": 57,
                "width": 24,
                "trapezoidal": false
            }
        ],
        "max_stats": [7, 7, 7, 7, 7, 7, 7, 7, 7],
        "category": TankCategories.Spammer
    },
    {
        "name": "Flank Guard",
        "speed": 1,
        "turrets": [
            {
                "angle": 0.0,
                "x_offset": 0.0,
                "length": 57,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": Math.PI,
                "x_offset": 0.0,
                "length": 48,
                "width": 24,
                "trapezoidal": false
            }
        ],
        "max_stats": [7, 7, 7, 7, 7, 7, 7, 7, 7],
        "category": TankCategories.Spammer
    },
    {
        "name": "Sniper",
        "speed": 1,
        "turrets": [
            {
                "angle": 0.0,
                "x_offset": 0.0,
                "length": 66,
                "width": 24,
                "trapezoidal": false
            }
        ],
        "max_stats": [7, 7, 7, 7, 7, 7, 7, 7, 7],
        "category": TankCategories.Sniper
    },
    {
        "name": "Machine Gun",
        "speed": 1,
        "turrets": [
            {
                "angle": 0.0,
                "x_offset": 0.0,
                "length": 57,
                "width": 22,
                "trapezoidal": true
            }
        ],
        "max_stats": [7, 7, 7, 7, 7, 7, 7, 7, 7],
        "category": TankCategories.Spammer
    },
    {
        "name": "Triple Shot",
        "speed": 1,
        "turrets": [
            {
                "angle": -Math.PI / 4,
                "x_offset": 0,
                "length": 57,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": 0.0,
                "x_offset": 0.0,
                "length": 57,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": Math.PI / 4,
                "x_offset": 0.0,
                "length": 57,
                "width": 24,
                "trapezoidal": false
            }
        ],
        "max_stats": [7, 7, 7, 7, 7, 7, 7, 7, 7],
        "category": TankCategories.Spammer
    },
    {
        "name": "Quad Tank",
        "speed": 1,
        "turrets": [
            {
                "angle": 0.0,
                "x_offset": 0.0,
                "length": 57,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": Math.PI / 2,
                "x_offset": 0.0,
                "length": 57,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": Math.PI,
                "x_offset": 0.0,
                "length": 57,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": -Math.PI / 2,
                "x_offset": 0.0,
                "length": 57,
                "width": 24,
                "trapezoidal": false
            }
        ],
        "max_stats": [7, 7, 7, 7, 7, 7, 7, 7, 7],
        "category": TankCategories.Spammer
    },
    {
        "name": "Twin Flank",
        "speed": 1,
        "turrets": [
            {
                "angle": 0.0,
                "x_offset": -16.0,
                "length": 57,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": 0.0,
                "x_offset": 16.0,
                "length": 57,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": Math.PI,
                "x_offset": -16.0,
                "length": 57,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": Math.PI,
                "x_offset": 16.0,
                "length": 57,
                "width": 24,
                "trapezoidal": false
            }
        ],
        "max_stats": [7, 7, 7, 7, 7, 7, 7, 7, 7],
        "category": TankCategories.Spammer
    },
    {
        "name": "Assassin",
        "speed": 1,
        "turrets": [
            {
                "angle": 0.0,
                "x_offset": 0.0,
                "length": 72,
                "width": 24,
                "trapezoidal": false
            }
        ],
        "max_stats": [7, 7, 7, 7, 7, 7, 7, 7, 7],
        "category": TankCategories.Sniper
    },
    {
        "name": "Hunter",
        "speed": 1,
        "turrets": [
            {
                "angle": 0.0,
                "x_offset": 0.0,
                "length": 66,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": 0.0,
                "x_offset": 0.0,
                "length": 57,
                "width": 33,
                "trapezoidal": false
            }
        ],
        "max_stats": [7, 7, 7, 7, 7, 7, 7, 7, 7],
        "category": TankCategories.Sniper
    },
    {
        "name": "Destroyer",
        "speed": 1,
        "turrets": [
            {
                "angle": 0.0,
                "x_offset": 0.0,
                "length": 57,
                "width": 41,
                "trapezoidal": false
            }
        ],
        "max_stats": [7, 7, 7, 7, 7, 7, 7, 7, 7],
        "category": TankCategories.Destroyer
    },
    {
        "name": "Gunner",
        "speed": 1,
        "turrets": [
            {
                "angle": 0.0,
                "x_offset": -19.2,
                "length": 39,
                "width": 15,
                "trapezoidal": false
            },
            {
                "angle": 0.0,
                "x_offset": 19.2,
                "length": 39,
                "width": 15,
                "trapezoidal": false,
                "z_index": -1
            },
            {
                "angle": 0.0,
                "x_offset": -10.4,
                "length": 51,
                "width": 15,
                "trapezoidal": false
            },
            {
                "angle": 0.0,
                "x_offset": 10.4,
                "length": 51,
                "width": 15,
                "trapezoidal": false
            }
        ],
        "max_stats": [7, 7, 7, 7, 7, 7, 7, 7, 7],
        "category": TankCategories.Spammer
    },
    {
        "name": "Triplet",
        "speed": 1,
        "turrets": [
            {
                "angle": 0.0,
                "x_offset": -16,
                "length": 48,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": 0.0,
                "x_offset": 16,
                "length": 48,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": 0.0,
                "x_offset": 0,
                "length": 57,
                "width": 24,
                "trapezoidal": false
            }
        ],
        "max_stats": [7, 7, 7, 7, 7, 7, 7, 7, 7],
        "category": TankCategories.Spammer
    },
    {
        "name": "Penta Shot",
        "speed": 1,
        "turrets": [
            {
                "angle": -Math.PI / 4,
                "x_offset": 0,
                "length": 48,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": Math.PI / 4,
                "x_offset": 0,
                "length": 48,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": -Math.PI / 8,
                "x_offset": 0,
                "length": 57,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": Math.PI / 8,
                "x_offset": 0,
                "length": 57,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": 0,
                "x_offset": 0,
                "length": 66,
                "width": 24,
                "trapezoidal": false
            }
        ],
        "max_stats": [7, 7, 7, 7, 7, 7, 7, 7, 7],
        "category": TankCategories.Spammer
    },
    {
        "name": "Spread Shot",
        "speed": 1,
        "turrets": [
            {
                "angle": 1.3089969,
                "x_offset": 0.0,
                "length": 39,
                "width": 17,
                "trapezoidal": false
            },
            {
                "angle": -1.3089969,
                "x_offset": 0.0,
                "length": 39,
                "width": 17,
                "trapezoidal": false
            },
            {
                "angle": 1.0471976,
                "x_offset": 0.0,
                "length": 43,
                "width": 17,
                "trapezoidal": false
            },
            {
                "angle": -1.0471976,
                "x_offset": 0.0,
                "length": 43,
                "width": 17,
                "trapezoidal": false
            },
            {
                "angle": 0.7853982,
                "x_offset": 0.0,
                "length": 46,
                "width": 17,
                "trapezoidal": false
            },
            {
                "angle": -0.7853982,
                "x_offset": 0.0,
                "length": 46,
                "width": 17,
                "trapezoidal": false
            },
            {
                "angle": 0.5235988,
                "x_offset": 0.0,
                "length": 50,
                "width": 17,
                "trapezoidal": false
            },
            {
                "angle": -0.5235988,
                "x_offset": 0.0,
                "length": 50,
                "width": 17,
                "trapezoidal": false
            },
            {
                "angle": 0.26179938,
                "x_offset": 0.0,
                "length": 54,
                "width": 17,
                "trapezoidal": false
            },
            {
                "angle": -0.26179938,
                "x_offset": 0.0,
                "length": 54,
                "width": 17,
                "trapezoidal": false
            },
            {
                "angle": 0.0,
                "x_offset": 0.0,
                "length": 57,
                "width": 24,
                "trapezoidal": false
            }
        ],
        "max_stats": [7, 7, 7, 7, 7, 7, 7, 7, 7],
        "category": TankCategories.Spammer
    },
    {
        "name": "Octo Tank",
        "speed": 1,
        "turrets": [
            {
                "angle": -Math.PI / 4,
                "x_offset": 0,
                "length": 57,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": Math.PI / 4,
                "x_offset": 0,
                "length": 57,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": -2.3561944,
                "x_offset": 0,
                "length": 57,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": 2.3561944,
                "x_offset": 0,
                "length": 57,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": Math.PI,
                "x_offset": 0,
                "length": 57,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": -Math.PI / 2,
                "x_offset": 0,
                "length": 57,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": Math.PI / 2,
                "x_offset": 0,
                "length": 57,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": 0,
                "x_offset": 0,
                "length": 57,
                "width": 24,
                "trapezoidal": false
            }
        ],
        "max_stats": [7, 7, 7, 7, 7, 7, 7, 7, 7],
        "category": TankCategories.Spammer
    },
    {
        "name": "Triple Twin",
        // turrets: Vec::from(
        //     [
        //         Turret
        //         {
        //             angle: 0.0,
        //             x_offset: -16.0,
        //             size_factor: 1.0,
        //             length: 57,
        //             width: 24,
        //             recoil: 0.5,
        //             scatter_rate: 1.0,
        //             friction: 1.0,
        //             projectile_type: ProjectileType::Bullet,
        //             projectile_damage: 0.75,
        //             projectile_penetration: 1.0,
        //             projectile_speed: 15.0,
        //             bullet_lifetime: 1.5,
        //             reload: 1.0,
        //             delay: 0.0,
        //             reload_time: 0.0,
        //             cycle_position: 0.0,
        //             elasticity: 1.0
        //         },
        //         Turret
        //         {
        //             angle: 0.0,
        //             x_offset: 16.0,
        //             size_factor: 1.0,
        //             length: 57,
        //             width: 24,
        //             recoil: 0.5,
        //             scatter_rate: 1.0,
        //             friction: 1.0,
        //             projectile_type: ProjectileType::Bullet,
        //             projectile_damage: 0.75,
        //             projectile_penetration: 1.0,
        //             projectile_speed: 15.0,
        //             bullet_lifetime: 1.5,
        //             reload: 1.0,
        //             delay: 0.5,
        //             reload_time: 0.0,
        //             cycle_position: 0.0,
        //             elasticity: 1.0
        //         },
        //         Turret
        //         {
        //             angle: 2.0943951,
        //             x_offset: -26.0,
        //             size_factor: 1.0,
        //             length: 57,
        //             width: 24,
        //             recoil: 0.5,
        //             scatter_rate: 1.0,
        //             friction: 1.0,
        //             projectile_type: ProjectileType::Bullet,
        //             projectile_damage: 0.75,
        //             projectile_penetration: 1.0,
        //             projectile_speed: 15.0,
        //             bullet_lifetime: 1.5,
        //             reload: 1.0,
        //             delay: 0.0,
        //             reload_time: 0.0,
        //             cycle_position: 0.0,
        //             elasticity: 1.0
        //         },
        //         Turret
        //         {
        //             angle: 2.0943951,
        //             x_offset: 26.0,
        //             size_factor: 1.0,
        //             length: 57,
        //             width: 24,
        //             recoil: 0.5,
        //             scatter_rate: 1.0,
        //             friction: 1.0,
        //             projectile_type: ProjectileType::Bullet,
        //             projectile_damage: 0.75,
        //             projectile_penetration: 1.0,
        //             projectile_speed: 15.0,
        //             bullet_lifetime: 1.5,
        //             reload: 1.0,
        //             delay: 0.5,
        //             reload_time: 0.0,
        //             cycle_position: 0.0,
        //             elasticity: 1.0
        //         },
        //         Turret
        //         {
        //             angle: -2.0943951,
        //             x_offset: -26.0,
        //             size_factor: 1.0,
        //             length: 57,
        //             width: 24,
        //             recoil: 0.5,
        //             scatter_rate: 1.0,
        //             friction: 1.0,
        //             projectile_type: ProjectileType::Bullet,
        //             projectile_damage: 0.75,
        //             projectile_penetration: 1.0,
        //             projectile_speed: 15.0,
        //             bullet_lifetime: 1.5,
        //             reload: 1.0,
        //             delay: 0.0,
        //             reload_time: 0.0,
        //             cycle_position: 0.0,
        //             elasticity: 1.0
        //         },
        //         Turret
        //         {
        //             angle: 2.0943951,
        //             x_offset: 26.0,
        //             size_factor: 1.0,
        //             length: 57,
        //             width: 24,
        //             recoil: 0.5,
        //             scatter_rate: 1.0,
        //             friction: 1.0,
        //             projectile_type: ProjectileType::Bullet,
        //             projectile_damage: 0.75,
        //             projectile_penetration: 1.0,
        //             projectile_speed: 15.0,
        //             bullet_lifetime: 1.5,
        //             reload: 1.0,
        //             delay: 0.5,
        //             reload_time: 0.0,
        //             cycle_position: 0.0,
        //             elasticity: 1.0
        //         },
        //     ]),
        "speed": 1,
        "turrets": [
            {
                "angle": 0.0,
                "x_offset": -16.0,
                "length": 57,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": 0.0,
                "x_offset": 16.0,
                "length": 57,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": 2.0943951,
                "x_offset": -16.0,
                "length": 57,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": 2.0943951,
                "x_offset": 16.0,
                "length": 57,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": -2.0943951,
                "x_offset": -16.0,
                "length": 57,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": -2.0943951,
                "x_offset": 16.0,
                "length": 57,
                "width": 24,
                "trapezoidal": false
            }
        ],
        "max_stats": [7, 7, 7, 7, 7, 7, 7, 7, 7],
        "category": TankCategories.Spammer
    },
    {
        "name": "Ranger",
        "speed": 1,
        "turrets": [
            {
                "angle": 0.0,
                "x_offset": 0.0,
                "length": 72,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": 0.0,
                "x_offset": 0.0,
                "length": 37,
                "width": 25,
                "trapezoidal": true,
                "trapezoid_reverse": true
            }
        ],
        "max_stats": [7, 7, 7, 7, 7, 7, 7, 7, 7],
        "category": TankCategories.Sniper
    },
    {
        "name": "Stalker",
        "speed": 1,
        "turrets": [
            {
                "angle": 0.0,
                "x_offset": 0.0,
                "length": 72,
                "width": 24,
                "trapezoidal": true,
                "trapezoid_reverse": true
            }
        ],
        "max_stats": [7, 7, 7, 7, 7, 7, 7, 7, 7],
        "category": TankCategories.Sniper
    },
    {
        "name": "Predator",
        "speed": 1,
        "turrets": [
            {
                "angle": 0.0,
                "x_offset": 0.0,
                "length": 66,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": 0.0,
                "x_offset": 0.0,
                "length": 57,
                "width": 33,
                "trapezoidal": false
            },
            {
                "angle": 0.0,
                "x_offset": 0.0,
                "length": 48,
                "width": 41,
                "trapezoidal": false
            }
        ],
        "upgrade_notif": ["Right click or shift to extend your view in the direction you're facing."],
        "translation": 1000.0,
        "max_stats": [7, 7, 7, 7, 7, 7, 7, 7, 7],
        "category": TankCategories.Sniper
    },
    {
        "name": "Streamliner",
        "speed": 1,
        "turrets": [
            {
                "angle": 0.0,
                "x_offset": 0.0,
                "length": 66,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": 0.0,
                "x_offset": 0.0,
                "length": 60,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": 0.0,
                "x_offset": 0.0,
                "length": 54,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": 0.0,
                "x_offset": 0.0,
                "length": 48,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": 0.0,
                "x_offset": 0.0,
                "length": 42,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": 0.0,
                "x_offset": 0.0,
                "length": 36,
                "width": 24,
                "trapezoidal": false
            }
        ],
        "max_stats": [7, 7, 7, 7, 7, 7, 7, 7, 7],
        "category": TankCategories.Spammer
    },
    {
        "name": "Sprayer",
        "speed": 1,
        "turrets": [
            {
                "angle": 0.0,
                "x_offset": 0.0,
                "length": 66,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": 0.0,
                "x_offset": 0.0,
                "length": 57,
                "width": 24,
                "trapezoidal": true
            }
        ],
        "max_stats": [7, 7, 7, 7, 7, 7, 7, 7, 7],
        "category": TankCategories.Spammer
    },
    {
        "name": "Annihilator",
        "speed": 1,
        "turrets": [
            {
                "angle": 0.0,
                "x_offset": 0.0,
                "length": 57,
                "width": 57,
                "trapezoidal": false
            }
        ],
        "max_stats": [7, 7, 7, 7, 7, 7, 7, 7, 7],
        "category": TankCategories.Destroyer
    },
    {
        "name": "Tri-Angle",
        "speed": 1,
        "turrets": [
            {
                "angle": 0.0,
                "x_offset": 0.0,
                "length": 57,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": 3.6651914,
                "x_offset": 0.0,
                "length": 48,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": 2.617993,
                "x_offset": 0.0,
                "length": 48,
                "width": 24,
                "trapezoidal": false
            }
        ],
        "max_stats": [7, 7, 7, 7, 7, 7, 7, 7, 7],
        "category": TankCategories.Fighter
    },
    {
        "name": "Booster",
        "speed": 1,
        "turrets": [
            {
                "angle": 0.0,
                "x_offset": 0.0,
                "length": 57,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": 2.356194,
                "x_offset": 0.0,
                "length": 42,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": 3.92699,
                "x_offset": 0.0,
                "length": 42,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": 3.6651914,
                "x_offset": 0.0,
                "length": 48,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": 2.617993,
                "x_offset": 0.0,
                "length": 48,
                "width": 24,
                "trapezoidal": false
            }
        ],
        "max_stats": [7, 7, 7, 7, 7, 7, 7, 7, 7],
        "category": TankCategories.Fighter
    },
    {
        "name": "Fighter",
        "speed": 1,
        "turrets": [
            {
                "angle": 0.0,
                "x_offset": 0.0,
                "length": 57,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": Math.PI / 2,
                "x_offset": 0.0,
                "length": 48,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": -Math.PI / 2,
                "x_offset": 0.0,
                "length": 48,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": 3.6651914,
                "x_offset": 0.0,
                "length": 48,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": 2.617993,
                "x_offset": 0.0,
                "length": 48,
                "width": 24,
                "trapezoidal": false
            }
        ],
        "max_stats": [7, 7, 7, 7, 7, 7, 7, 7, 7],
        "category": TankCategories.Fighter
    },
    {
        "name": "Smasher",
        "speed": 1.05,
        "turrets": [],
        "rotators": [
            {
                "rpt": 0.03,
                "size": 1.15,
                "sides": 6,
                "angle": 0.0
            }
        ],
        "disable_mouse": true,
        "max_stats": [10, 10, 10, 0, 0, 0, 0, 10, 10],
        "category": TankCategories.Smasher
    },
    {
        "name": "Landmine",
        "speed": 1.05,
        "turrets": [],
        "rotators": [
            {
                "rpt": 0.015,
                "size": 1.15,
                "sides": 6,
                "angle": 0.0
            },
            {
                "rpt": 0.03,
                "size": 1.15,
                "sides": 6,
                "angle": 0.0
            }
        ],
        "disable_mouse": true,
        "max_stats": [10, 10, 10, 0, 0, 0, 0, 10, 10],
        "category": TankCategories.Smasher
    },
    {
        "name": "Spike",
        "speed": 1.05,
        "turrets": [],
        "rotators": [
            {
                "rpt": 0.051,
                "size": 1.3,
                "sides": 3,
                "angle": 0
            },
            {
                "rpt": 0.051,
                "size": 1.3,
                "sides": 3,
                "angle": Math.PI / 2
            },
            {
                "rpt": 0.051,
                "size": 1.3,
                "sides": 3,
                "angle": Math.PI / 3
            },
            {
                "rpt": 0.051,
                "size": 1.3,
                "sides": 3,
                "angle": Math.PI / 6
            },
        ],
        "disable_mouse": true,
        "max_stats": [10, 10, 10, 0, 0, 0, 0, 10, 10],
        "category": TankCategories.Smasher
    },
    {
        "name": "Mega Smasher",
        "speed": 0.98,
        "turrets": [],
        "rotators": [
            {
                "rpt": 0.01,
                "size": 1.4,
                "sides": 6,
                "angle": 0.0
            }
        ],
        "disable_mouse": true,
        "max_stats": [10, 10, 10, 0, 0, 0, 0, 10, 10],
        "category": TankCategories.Smasher
    },
    {
        "name": "Auto Gunner",
        "speed": 1,
        "turrets": [
            {
                "angle": 0.0,
                "x_offset": -19.2,
                "length": 39,
                "width": 15,
                "trapezoidal": false
            },
            {
                "angle": 0.0,
                "x_offset": 19.2,
                "length": 39,
                "width": 15,
                "trapezoidal": false,
                "z_index": -1
            },
            {
                "angle": 0.0,
                "x_offset": -10.4,
                "length": 51,
                "width": 15,
                "trapezoidal": false
            },
            {
                "angle": 0.0,
                "x_offset": 10.4,
                "length": 51,
                "width": 15,
                "trapezoidal": false
            },
            {
                "angle": 0.0,
                "x_offset": 0.0,
                "length": 32,
                "width": 30,
                "trapezoidal": false,
                "auto": true,
                "dominant": true
            }
        ],
        "max_stats": [7, 7, 7, 7, 7, 7, 7, 7, 7],
        "category": TankCategories.Spammer
    },
    // {
    //     "name": "Auto 4",
    //     "speed": 1,
        // "turrets": [
    //         {
    //             "angle": Math.PI / 4,
    //             "x_offset": 30,
    //             "length": 32,
    //             "width": 30,
    //             "trapezoidal": false,
    //             "auto": true,
    //         },
    //         {
    //             "angle": 3 * Math.PI / 4,
    //             "x_offset": 30,
    //             "length": 32,
    //             "trapezoidal": false,
    //             "auto": true,
    //             "width": 30,
    //         },
    //         {
    //             "angle": -Math.PI / 4,
    //             "x_offset": 30,
    //             "length": 32,
    //             "width": 30,
    //             "trapezoidal": false,
    //             "auto": true,
    //         },
    //         {
    //             "angle": -3 * Math.PI / 4,
    //             "x_offset": 30,
    //             "length": 32,
    //             "width": 30,
    //             "trapezoidal": false,
    //             "auto": true,
    //         },
    //     ],
    //     "disable_mouse": true
    // },
    {
        "name": "Overlord",
        "speed": 1,
        "turrets": [
            {
                "angle": Math.PI / 2,
                "x_offset": 0.0,
                "length": 42,
                "width": 24,
                "trapezoidal": true
            },
            {
                "angle": -Math.PI / 2,
                "x_offset": 0.0,
                "length": 42,
                "width": 24,
                "trapezoidal": true
            },
            {
                "angle": 0,
                "x_offset": 0.0,
                "length": 42,
                "width": 24,
                "trapezoidal": true
            },
            {
                "angle": Math.PI,
                "x_offset": 0.0,
                "length": 42,
                "width": 24,
                "trapezoidal": true
            }
        ],
        "max_stats": [7, 7, 7, 7, 7, 7, 7, 7, 7],
        "category": TankCategories.Drone
    },
    {
        "name": "Overseer",
        "speed": 1,
        "turrets": [
            {
                "angle": Math.PI / 2,
                "x_offset": 0.0,
                "length": 42,
                "width": 24,
                "trapezoidal": true
            },
            {
                "angle": -Math.PI / 2,
                "x_offset": 0.0,
                "length": 42,
                "width": 24,
                "trapezoidal": true
            }
        ],
        "upgrade_notif": ["Right click or shift to repel your drones away from your mouse."],
        "max_stats": [7, 7, 7, 7, 7, 7, 7, 7, 7],
        "category": TankCategories.Drone
    },
    {
        "name": "Manager",
        "speed": 1,
        "turrets": [
            {
                "angle": 0,
                "x_offset": 0.0,
                "length": 42,
                "width": 24,
                "trapezoidal": true
            }
        ],
        "max_stats": [7, 7, 7, 7, 7, 7, 7, 7, 7],
        "category": TankCategories.Drone
    },
    {
        "name": "Hybrid",
        "speed": 1,
        "turrets": [
            {
                "angle": 0.0,
                "x_offset": 0.0,
                "length": 57,
                "width": 41,
                "trapezoidal": false
            },
            {
                "angle": Math.PI,
                "x_offset": 0.0,
                "length": 42,
                "width": 24,
                "trapezoidal": true
            }
        ],
        "max_stats": [7, 7, 7, 7, 7, 7, 7, 7, 7],
        "category": TankCategories.Destroyer
    },
    {
        "name": "Trapper",
        "speed": 1,
        "turrets": [
            {
                "angle": 0.0,
                "x_offset": 0.0,
                "y_offset": 36.0,
                "length": 12,
                "width": 24,
                "trapezoidal": true
            },
            {
                "angle": 0.0,
                "x_offset": 0.0,
                "length": 36,
                "width": 24,
                "trapezoidal": false
            }
        ],
        "max_stats": [7, 7, 7, 7, 7, 7, 7, 7, 7],
        "category": TankCategories.Trapper
    },
    {
        "name": "Tri-Trapper",
        "speed": 1,
        "turrets": [
            {
                "angle": 0.0,
                "x_offset": 0.0,
                "y_offset": 36.0,
                "length": 12,
                "width": 24,
                "trapezoidal": true
            },
            {
                "angle": 0.0,
                "x_offset": 0.0,
                "length": 36,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": TAU / 3,
                "x_offset": 0.0,
                "y_offset": 36.0,
                "length": 12,
                "width": 24,
                "trapezoidal": true
            },
            {
                "angle": TAU / 3,
                "x_offset": 0.0,
                "length": 36,
                "width": 24,
                "trapezoidal": false
            },
            {
                "angle": (2 * TAU) / 3,
                "x_offset": 0.0,
                "y_offset": 36.0,
                "length": 12,
                "width": 24,
                "trapezoidal": true
            },
            {
                "angle": (2 * TAU) / 3,
                "x_offset": 0.0,
                "length": 36,
                "width": 24,
                "trapezoidal": false
            }
        ],
        "max_stats": [7, 7, 7, 7, 7, 7, 7, 7, 7],
        "category": TankCategories.Trapper
    },
    {
        "name": "Gunner Trapper",
        "speed": 1,
        "turrets": [
            {
                "angle": 0.0,
                "x_offset": -9.6,
                "length": 45,
                "width": 12,
                "trapezoidal": false
            },
            {
                "angle": 0.0,
                "x_offset": 9.6,
                "length": 45,
                "width": 12,
                "trapezoidal": false
            },
            {
                "angle": Math.PI,
                "x_offset": 0.0,
                "y_offset": 36.0,
                "length": 12,
                "width": 31.2,
                "trapezoidal": true
            },
            {
                "angle": Math.PI,
                "x_offset": 0.0,
                "length": 36,
                "width": 31.2,
                "trapezoidal": false
            }
        ],
        "max_stats": [7, 7, 7, 7, 7, 7, 7, 7, 7],
        "category": TankCategories.Trapper
    },
    {
        "name": "Overtrapper",
        "speed": 1,
        "turrets": [
            {
                "angle": TAU / 3,
                "x_offset": 0.0,
                "length": 42,
                "width": 24,
                "trapezoidal": true
            },
            {
                "angle": (2 * TAU) / 3,
                "x_offset": 0.0,
                "length": 42,
                "width": 24,
                "trapezoidal": true
            },
            {
                "angle": 0.0,
                "x_offset": 0.0,
                "y_offset": 36.0,
                "length": 12,
                "width": 24,
                "trapezoidal": true
            },
            {
                "angle": 0.0,
                "x_offset": 0.0,
                "length": 36,
                "width": 24,
                "trapezoidal": false
            }
        ],
        "max_stats": [7, 7, 7, 7, 7, 7, 7, 7, 7],
        "category": TankCategories.Trapper
    },
    {
        "name": "Mega Trapper",
        "speed": 1,
        "turrets": [
            {
                "angle": 0,
                "x_offset": 0.0,
                "y_offset": 36.0,
                "length": 12,
                "width": 31.2,
                "trapezoidal": true
            },
            {
                "angle": 0,
                "x_offset": 0.0,
                "length": 36,
                "width": 31.2,
                "trapezoidal": false
            }
        ],
        "max_stats": [7, 7, 7, 7, 7, 7, 7, 7, 7],
        "category": TankCategories.Trapper
    },
    {
        "name": "Auto Trapper",
        "speed": 1,
        "turrets": [
            {
                "angle": 0.0,
                "x_offset": 0.0,
                "length": 32,
                "width": 30,
                "trapezoidal": false,
                "auto": true,
                "dominant": true
            },
            {
                "angle": 0.0,
                "x_offset": 0.0,
                "y_offset": 36.0,
                "length": 12,
                "width": 24,
                "trapezoidal": true
            },
            {
                "angle": 0.0,
                "x_offset": 0.0,
                "length": 36,
                "width": 24,
                "trapezoidal": false
            }
        ],
        "max_stats": [7, 7, 7, 7, 7, 7, 7, 7, 7],
        "category": TankCategories.Trapper
    },
    {
        "name": "Battleship",
        "speed": 1,
        "turrets": [
            {
                "angle": Math.PI / 2,
                "x_offset": 12.0,
                "length": 45,
                "width": 17,
                "trapezoidal": true,
                "trapezoid_reverse": true
            },
            {
                "angle": Math.PI / 2,
                "x_offset": -12.0,
                "length": 45,
                "width": 17,
                "trapezoidal": true,
                "trapezoid_reverse": true
            },
            {
                "angle": (3 * Math.PI) / 2,
                "x_offset": 12.0,
                "length": 45,
                "width": 17,
                "trapezoidal": true,
                "trapezoid_reverse": true
            },
            {
                "angle": (3 * Math.PI) / 2,
                "x_offset": -12.0,
                "length": 45,
                "width": 17,
                "trapezoidal": true,
                "trapezoid_reverse": true
            }
        ],
        "max_stats": [7, 7, 7, 7, 7, 7, 7, 7, 7],
        "category": TankCategories.Spammer
    },
    {
        "name": "Necromancer",
        "speed": 1,
        "turrets": [
            {
                "angle": Math.PI / 2,
                "x_offset": 0.0,
                "length": 44,
                "width": 24,
                "trapezoidal": true
            },
            {
                "angle": -Math.PI / 2,
                "x_offset": 0.0,
                "length": 44,
                "width": 24,
                "trapezoidal": true
            }
        ],
        "square": true,
        "max_stats": [7, 7, 7, 7, 7, 7, 7, 7, 7],
        "category": TankCategories.Drone
    },
    {
        "name": "Factory",
        "speed": 1,
        "turrets": [
            {
                "angle": 0,
                "x_offset": 0.0,
                "length": 42,
                "width": 24,
                "trapezoidal": true
            }
        ],
        "square": true,
        "max_stats": [7, 7, 7, 7, 7, 7, 7, 7, 7],
        "category": TankCategories.Factory
    },
    {
        "name": "Spectator",
        "speed": 2,
        "turrets": [],
        "upgrade_notif": ["Zoom in and out (by scrolling) to change your Field of View!"],
        "max_stats": [0, 0, 0, 0, 0, 0, 0, 10, 0],
        "category": TankCategories.Illegal
    },
    {
        "name": "Railgun",
        "speed": 1,
        "turrets": [
            {
                "angle": 0.0,
                "x_offset": 0.0,
                "length": 57,
                "width": 57,
                "trapezoidal": false
            }
        ],
        "max_stats": [7, 7, 7, 7, 7, 7, 7, 7, 7],
        "category": TankCategories.Destroyer
    }
];