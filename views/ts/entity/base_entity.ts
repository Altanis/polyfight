import nipplejs from 'nipplejs';

import Client from "../client";
import SwiftStream from "../connection/stream";
import { THEME_CONFIG, MAX_CLANS, PROTIPS } from "../const/consts";
import { CensusProperties, DyingPhase, EntityIdentityIds, EntityType, Inputs, InputMap, RenderPhase, SpinType, UpgradeStats } from "../const/enums";
import { EntityIdentity, TANK_DEFS } from "../const/tankdefs";
import Colour from "../utils/color";
import { constrain, exponential_decay, fuzzy_equals, lerp, lerp_angle, timed_exponential_smoothing } from "../utils/functions";
import Vector from "../utils/vector";
import ProjectileEntity from "./projectile_entity";
import ShapeEntity from "./shape_entity";
import TankEntity from "./tank_entity";

import firebase from "../auth/firebase";
const { app, auth, provider, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } = firebase;

/** A class representing a the base entity. */
export default abstract class BaseEntity
{
    /** The client this entity belongs to. */
    public client: Client;

    public log_update = false;

    /** The ID of the entity. */
    public id: number = -1;
    /** The radius of the entity. */
    public radius: number = 0;
    /** The target radius of the entity (only during death animations). */
    public target_radius: number = 0;
    public clan = -1;
    
    /** Whether or not this is the first spawn in the server. */
    public first_server_spawn: boolean = true;
    /** The health of the entity. */
    public health: number = -1;
    /** The target health of the entity. */
    public target_health: number = -1;
    /** The maximum health of the entity. */
    public max_health: number = 1;
    /** Gets the percent of health left for the entity. */
    public get health_percent(): number
    {
        return constrain(0, this.lerp_health() / this.max_health, 1);
    };
    /** The percent of health since the last tick. */
    public last_health_percent: number = 1;

    /** The position of the entity. */
    public position: Vector = new Vector(-1, -1);
    /** The target position, given by the server. */
    public target_position: Vector = new Vector(0, 0);

    /** The velocity of the entity. */
    public velocity: Vector = new Vector(0, 0);
    /** The target velocity. */
    public target_velocity: Vector = new Vector(0, 0);

    /** The angle of the entity, in radians. */
    public angle: number = 0;
    /** The target angle of the entity in radians, given by the server. */
    public target_angle: number = 0;

    /** The timestamp at which the entity spawned. */
    public spawn_timestamp: number = -1;

    /** The FOV of the entity. */
    public fov: number = 1;
    /** The target FOV of the entity, given by the server. */
    public target_fov: number = 1;
    public desired_fov: number = -1;

    /** The opacity of the health bar. */
    public health_bar_opacity: number = 1;
    /** The target opacity of the health bar. */
    public target_health_bar_opacity: number = 1;

    /** Whether or not the entity has been updated by the server. */
    public updated: boolean = true;

    public type: EntityType = EntityType.Generic;

    /** The number of ticks the entity has lived for. */
    public ticks = 0;

    /** Whether or not the entity is dying. */
    public dying_phase: DyingPhase = DyingPhase.None;
    /** The opacity of the entity. */
    public opacity: number = 1;
    /** The target opacity of the entity. */
    public target_opacity: number = 1;
    /** Whether or not the entity should be revived. */
    public dont_revive: boolean = false;

    /** The amount to blend with the damage color. */
    public damage_blend: number = 0;
    /** The target amount to blend with the damage color. */
    public target_damage_blend: number = 0;

    /** The time alive, prettified. */
    public time_alive: string = "";

    /** The entity identity ID. */
    public identity_id: EntityIdentityIds = EntityIdentityIds.BasicTank;
    public get identity(): EntityIdentity
    {
        return TANK_DEFS[this.identity_id] as EntityIdentity || {};
    }

    public show_name: boolean = true;
    public show_health: boolean = true;
    public abstract name: string;

    public z_index: number = -99;

    public offset = new Vector(0, 0);
    public get target_offset(): Vector
    {
        if (this.id != this.client.entity.id) return new Vector(0, 0);

        const input = this.client.polyfight_canvas.inputs;
        let x_offset = ((input & Inputs.Left) == Inputs.Left ? -1 : 0) + ((input & Inputs.Right) == Inputs.Right ? 1 : 0);
        let y_offset = ((input & Inputs.Up) == Inputs.Up ? -1 : 0) + ((input & Inputs.Down) == Inputs.Down ? 1 : 0);

        const magSq = x_offset * x_offset + y_offset * y_offset;
        if (magSq > 1)
        {
            const mag = Math.sqrt(magSq);
            x_offset /= mag;
            y_offset /= mag;
        }

        // self.base_entity.identity.base_speed * 1.6 * (1.07_f32.powf(self.stats.stat_investments[UpgradeStats::MovementSpeed as usize] as f32)) / (1.015_f32.powf((self.level - 1) as f32));
        const camera_speed = this.identity.speed * 1.6 * (1.07 ** this.client.polyfight_canvas.stats.stats_value[UpgradeStats.MovementSpeed]) / (1.015 ** this.client.entity.level);
        x_offset *= camera_speed;
        y_offset *= camera_speed;
        
        return new Vector(x_offset, y_offset);
    }

    /** A map of every census property to its parsing function. */
    public census_map: Map<number, (entity: BaseEntity, stream: SwiftStream) => void> = new Map(
        [
            [CensusProperties.Position, (entity: BaseEntity, stream: SwiftStream) =>
            {
                const [x, y] = [stream.read_float32(), stream.read_float32()];
                entity.target_position.x = x;
                entity.target_position.y = y;
            }],
            [CensusProperties.Velocity, (entity: BaseEntity, stream: SwiftStream) =>
                {
                    const [x, y] = [stream.read_float32(), stream.read_float32()];
                    // if (entity.id == this.client.entity.id) return;
                    
                    entity.target_velocity.x = x;
                    entity.target_velocity.y = y;
                }],
            [CensusProperties.Angle, (entity: BaseEntity, stream: SwiftStream) =>
            {
                let angle = stream.read_float32();
                if (entity.id != this.client.entity.id || this.client.polyfight_canvas.auto_spin != SpinType.None) entity.target_angle = angle;
            }],
            [CensusProperties.Radius, (entity: BaseEntity, stream: SwiftStream) =>
            {
                let radius = stream.read_float32();
                if (entity.dying_phase == DyingPhase.Alive) entity.radius = radius;
            }],
            [CensusProperties.Health, (entity: BaseEntity, stream: SwiftStream) =>
            {
                let is_new = entity.health == -1;

                let health = stream.read_float32();
                if (health < this.target_health) this.target_damage_blend = 1;

                entity.target_health = health;
                if (is_new) entity.health = health;
            }],
            [CensusProperties.MaxHealth, (entity: BaseEntity, stream: SwiftStream) =>
            {
                let is_new = entity.max_health == -1;
                entity.max_health = stream.read_float32();
                if (is_new) entity.health = entity.max_health;
            }],
            [CensusProperties.Name, (entity: BaseEntity, stream: SwiftStream) =>
            {
                entity.name = stream.read_string();
            }],
            [CensusProperties.Fov, (entity: BaseEntity, stream: SwiftStream) =>
            {
                let target_fov = stream.read_float32();
                entity.target_fov = entity.desired_fov == -1 ? target_fov : (entity.desired_fov = constrain(0, entity.desired_fov, target_fov));
            }],
            [CensusProperties.Score, (entity: BaseEntity, stream: SwiftStream) =>
            {
                let score = stream.read_float32();
                (entity as TankEntity).target_score = score;
            }],
            [CensusProperties.Invincible, (entity: BaseEntity, stream: SwiftStream) =>
            {
                let spawning = !!stream.read_uint8();
                if (entity.id == this.client.entity.id && (entity as TankEntity).spawning != spawning)
                {
                    this.client.polyfight_canvas.add_notification({ message: `Invincibility: ${spawning ? "ON" : "OFF"}`, r: spawning ? 0 : 255, g: spawning ? 255 : 0, b: 0 });
                }

                (entity as TankEntity).spawning = spawning;
            }],
            [CensusProperties.Invisible, (entity: BaseEntity, stream: SwiftStream) =>
            {
                let opacity = stream.read_float32();
                entity.dont_revive = !fuzzy_equals(opacity, 1);
                // if (entity.dont_revive) console.log("for some reason stuff is going invisible", opacity);
                entity.target_opacity = opacity;
                // if (!invisible) (entity as TankEntity).target_opacity = 1;
                // else
                // {
                //     entity.target_opacity -= (entity.identity as { opacity_decrement?: number }).opacity_decrement || 0.0;
                //     entity.target_opacity = constrain(0, entity.target_opacity, 1);
                // };
            }],
            [CensusProperties.Turrets, (entity: BaseEntity, stream: SwiftStream) =>
            {
                const turrets = entity.identity.turrets.filter(x => x.auto);

                let turret_count = stream.read_uint8();
                for (let i = 0; i < turret_count; ++i)
                {
                    const angle = stream.read_float32();
                    turrets[i].target_angle = angle;
                }
            }],
            [CensusProperties.Message, (entity: BaseEntity, stream: SwiftStream) =>
            {
                const old_messages = (entity as TankEntity).messages;
                (entity as TankEntity).messages = [];

                (entity as TankEntity).typing = !!stream.read_uint8();
                const num_strings = stream.read_uint8();

                if (old_messages.length > num_strings) {
                    for (let i = 0; i < old_messages.length - num_strings; ++i) {
                        if (fuzzy_equals(old_messages[i].opacity, 0)) {
                            old_messages.shift();
                            continue;
                        }

                        (entity as TankEntity).messages.push({
                            content: old_messages[i].content,
                            position: old_messages[i].position,
                            target_position: old_messages[i].target_position,
                            opacity: old_messages[i].opacity,
                            target_opacity: 0,
                        });
                    }

                    for (let i = old_messages.length - num_strings; i < (old_messages.length - num_strings) + num_strings; ++i) {
                        let message = stream.read_string();
                        (entity as TankEntity).messages.push({
                            content: message,
                            position: old_messages[i]?.position || new Vector(0, 0),
                            target_position: old_messages[i]?.target_position || new Vector(0, 0),
                            opacity: old_messages[i]?.opacity || 1,
                            target_opacity: old_messages[i]?.target_opacity || 1,
                        });
                    }
                } else {
                    for (let i = 0; i < num_strings; ++i) {
                        let message = stream.read_string();
                        (entity as TankEntity).messages.push({
                            content: message,
                            position: old_messages[i]?.position || new Vector(0, 0),
                            target_position: old_messages[i]?.target_position || new Vector(0, 0),
                            opacity: old_messages[i]?.opacity || 1,
                            target_opacity: old_messages[i]?.target_opacity || 1,
                        });
                    }
                }           
            }],
            [CensusProperties.Ready, (entity: BaseEntity, stream: SwiftStream) =>
            {
                (entity as TankEntity).ready = !!stream.read_uint8();
                if (entity.id == this.client.entity.id) entity.client.polyfight_elements.ranked_checkbox.checked = (entity as TankEntity).ready;
            }],
            [CensusProperties.Alive, (entity: BaseEntity, stream: SwiftStream) =>
            {
                let alive = !!stream.read_uint8();
                
                if (alive)
                {
                    if (entity.id == this.client.entity.id && this.first_server_spawn && this.client.polyfight_connection.is_host)
                    {
                        this.first_server_spawn = false;
                        this.client.polyfight_canvas.add_notification({ message: "You are the host of this game. Go to Settings to configure the game.", r: 0, g: 255, b: 0 });
                    }

                    let first_spawn = entity.dying_phase != DyingPhase.Alive;
                    (entity as TankEntity).killer = -1;
                    entity.revive();

                    if (entity.id == this.client.entity.id)
                    {
                        this.client.polyfight_elements.game_buttons.style.display = "block";
                        if (first_spawn)
                        {
                            this.spawn_timestamp = performance.now();
                            this.time_alive = "";
                        
                            this.client.entity.killer_name = "";
                            // this.client.polyfight_canvas.upgrade_tanks.current_upgrades = [];
                            this.client.entity.target_opacity = 1;
                            this.client.polyfight_canvas.phase = RenderPhase.Game;
                            this.client.polyfight_canvas.target_screen_opacity = this.client.polyfight_canvas.screen_opacity = 1;
                            this.client.polyfight_elements.container.classList.remove("show");
                            this.client.polyfight_canvas.minimap_canvas.style.display = "block"; 
                            
                            if (this.client.polyfight_canvas.is_mobile) {
                                this.client.polyfight_elements.joystick = nipplejs.create({
                                    zone: document.getElementById("joystick-zone")!,
                                    mode: 'dynamic',
                                    color: 'black',
                                    dynamicPage: true,
                                    fadeTime: 250,
                                    maxNumberOfNipples: 2,
                                    multitouch: true
                                });
                                
                                this.client.polyfight_elements.fire_joystick_events();
                            }

                            this.client.entity.kills = 0;
                            this.client.polyfight_canvas.auto_spin = SpinType.None;
                            this.client.polyfight_canvas.auto_fire = false;

                            this.client.polyfight_canvas.add_notification({ message: `Protip: ${PROTIPS[Math.floor(Math.random() * PROTIPS.length)]}`, r: 0, g: 255, b: 0 });
                        }
                    }
                }
                else
                {
                    if (entity.dying_phase == DyingPhase.Alive)
                    {
                        entity.target_radius = entity.radius * (entity.id == this.client.entity.id ? 3.0 : 1.5);
                        entity.dying_phase = DyingPhase.Dying;
                    }

                    (entity as TankEntity).killer = stream.read_uint32();

                    if (entity.id == this.client.entity.id)
                    {
                        this.client.polyfight_canvas.auto_fire = false;
                        this.client.polyfight_connection.in_1v1 = false;
                        this.client.polyfight_canvas.stats.preloaded_stats = [];
                        this.client.polyfight_elements.game_buttons.style.display = "none";
                        
                        if (this.time_alive.length == 0)
                        {
                            const elapsed = performance.now() - this.spawn_timestamp;

                            const hours = Math.floor(elapsed / 3600000);
                            const minutes = Math.floor((elapsed - hours * 3600000) / 60000);
                            const seconds = Math.floor((elapsed - hours * 3600000 - minutes * 60000) / 1000);
    
                            if (hours > 0) this.time_alive = `${hours}h ${minutes}m ${seconds}s`;
                            else if (minutes > 0) this.time_alive = `${minutes}m ${seconds}s`;
                            else this.time_alive = `${seconds}s`;
                        }

                        this.client.polyfight_canvas.target_screen_opacity = 0.4;
                        this.client.polyfight_elements.joystick?.destroy();
                    }
                }
            }],
            [CensusProperties.IdentityId, (entity: BaseEntity, stream: SwiftStream) =>
            {
                let id = stream.read_uint8();
                if (entity.identity_id != id)
                {
                    entity.identity_id = id;

                    if (this.client.entity.id == entity.id)
                    {
                        this.client.polyfight_canvas.stats_buttons = [];
                    }
                }
            }],
            [CensusProperties.Ticks, (entity: BaseEntity, stream: SwiftStream) =>
            {
                entity.ticks = stream.read_uint32();
            }],
            [CensusProperties.ShapeType, (entity: BaseEntity, stream: SwiftStream) =>
            {
                const i = stream.read_uint8();
                (entity as ShapeEntity).shape_type = i;
            }],
            [CensusProperties.Shiny, (entity: BaseEntity, stream: SwiftStream) =>
            {
                (entity as ShapeEntity).shiny = stream.read_uint8();
            }],
            [CensusProperties.Owner, (entity: BaseEntity, stream: SwiftStream) =>
            {
                (entity as ProjectileEntity).owners = [];

                let count = stream.read_uint32();
                for (let i = 0; i < count; ++i)
                {
                    (entity as ProjectileEntity).owners.push(stream.read_uint32());
                }
            }],
            [CensusProperties.Turret, (entity: BaseEntity, stream: SwiftStream) =>
            {
                const entity_id = stream.read_uint32();
                const turret_idx = stream.read_uint8();
                const sublevel = stream.read_uint8();

                if (sublevel != 0) return; // todo: implement sublevels
                
                if (entity.ticks > 1) return;
                const e: TankEntity = (entity_id == this.client.entity.id ? this.client.entity : this.client.entity.surroundings.find(x => x.id == entity_id)) as TankEntity;
                if (e == undefined || e.type != EntityType.Tank) return;

                if (entity.id > e.latest_projectile_id)
                {
                    e.target_turret_length[turret_idx] = (e.identity.turrets?.[turret_idx].length || 0) * 0.92;
                    e.latest_projectile_id = entity.id;
                }
            }],
            [CensusProperties.ProjectileType, (entity: BaseEntity, stream: SwiftStream) =>
            {
                (entity as ProjectileEntity).projectile_type = stream.read_uint8();
            }],
            [CensusProperties.Clan, (entity: BaseEntity, stream: SwiftStream) =>
            {
                let clan = stream.read_uint8();
                if (clan == MAX_CLANS + 1) return entity.clan = -1;

                entity.clan = clan;
            }]
        ]
    );

    public constructor(client: Client)
    {
        this.client = client;
    };

    /** Interpolates the position between the client's position and server's position. */
    public lerp_position(dt: number, dt_s: number): Vector
    {
        // console.log(dt);
        if (this.position.x == -1 && this.position.y == -1 || this.ticks < 1)
        {
            this.position.x = this.target_position.x;
            this.position.y = this.target_position.y;

            this.velocity.x = this.target_velocity.x;
            this.velocity.y = this.target_velocity.y;

            return this.position;
        }

        const offset = this.lerp_offset(dt);

        // this.position.x = lerp(this.position.x, 0.15 * dt, this.target_position.x);
        // this.position.y = lerp(this.position.y, 0.15 * dt, this.target_position.y);
        this.position.x = exponential_decay(this.position.x, this.target_position.x, dt_s);
        this.position.y = exponential_decay(this.position.y, this.target_position.y, dt_s);

        /** Also interpolates the velocity! */
        // this.velocity.x = lerp(this.velocity.x, 0.1 * dt, this.target_velocity.x + offset.x);
        // this.velocity.y = lerp(this.velocity.y, 0.1 * dt, this.target_velocity.y + offset.y);   
        this.velocity.x = exponential_decay(this.velocity.x, this.target_velocity.x + offset.x, dt_s);
        this.velocity.y = exponential_decay(this.velocity.y, this.target_velocity.y + offset.y, dt_s);
        
        // this.velocity.scale(0.9);

        return this.position;
    };

    /** Interpolates the offset of the entity. */
    public lerp_offset(dt: number): Vector
    {
        if (this.id != this.client.entity.id)
        {
            this.offset.x = this.offset.y = 0;
            return this.offset;
        }

        const target = this.target_offset;
        this.offset.x = lerp(this.offset.x, 0.1 * dt, target.x);
        this.offset.y = lerp(this.offset.y, 0.1 * dt, target.y);

        return this.offset;
    };

    /** Interpolates the angle between the real and dead radius. */
    public lerp_radius(dt: number): number
    {
        this.radius = lerp(this.radius, 0.1 * dt, this.target_radius);
        return this.radius;
    };

    /** Interpolates the angle between the client's angle and server's angle. */
    public lerp_angle(dt: number): number
    {
        if (this.ticks < 1) this.angle = this.target_angle;
        else this.angle = lerp_angle(this.angle, 0.35 * dt, this.target_angle);

        this.angle = constrain(-Math.PI, this.angle, Math.PI);
        return this.angle;
    };

    /** Interpolates the health between the client's health and server's health. */
    public lerp_health(): number
    {
        if (this.ticks < 1) this.health = this.target_health;
        else this.health = lerp(this.health, 0.1, this.target_health);

        return this.health;
    };

    /** Interpolates the FOV between the client's FOV and server's FOV. */
    public lerp_fov(dt: number): number
    {
        this.fov = timed_exponential_smoothing(this.fov, this.target_fov, 0.9, dt);
        return this.fov;
    };

    /** Interpolates the opacity of the health bar. */
    public lerp_health_bar_opacity(dt: number): number
    {
        this.health_bar_opacity = lerp(this.health_bar_opacity, 0.1 * dt, this.target_health_bar_opacity);
        return this.health_bar_opacity;
    }

    /** Interpolates the opacity of the entity. */
    public lerp_entity_opacity(dt: number): number
    {
        this.opacity = lerp(this.opacity, 0.35 * dt, this.target_opacity);
        return this.opacity;
    };

    /** Interpolates the damage blend. */
    public lerp_damage_blend(dt: number): number
    {
        this.damage_blend = lerp(this.damage_blend, 0.5 * dt, this.target_damage_blend);
        return this.damage_blend;
    };

    /** Renders the entity on the canvas. */
    public render(ctx: CanvasRenderingContext2D, dt: number, ...args: any)
    {};

    /** Renders the name of the entity. */
    public render_name(dt: number)
    {
        if (this.show_name && !this.dying_phase)
        {
            const context = this.client.polyfight_canvas.context;

            context.save();
            context.translate(this.position.x + this.velocity.x, this.position.y + this.velocity.y);
            this.client.polyfight_canvas.write_text(this.name, 0, -this.radius - 30, 48, THEME_CONFIG.NAME_FILL.css, 6, Colour.BLACK.css);
            context.restore();
        };
    };

    public lerp_colour(first: Colour, second: Colour, factor: number): Colour
    {
        let r = lerp(first.r, factor, second.r);
        let g = lerp(first.g, factor, second.g);
        let b = lerp(first.b, factor, second.b);

        return Colour.from_rgb(r, g, b);
    }

    /** Renders the health bar. */
    public render_health_bar(ctx: CanvasRenderingContext2D, dt: number)
    {
        if (!this.show_health) return;
        if (this.identity_id == EntityIdentityIds.Spectator) return;

        const ratio = this.health_percent;
        
        if (ratio > 0.99) this.target_health_bar_opacity = 0;
        else this.target_health_bar_opacity = 1;

        const LOW_HEALTH_BAR = THEME_CONFIG.LOW_HEALTH_BAR;
        const MEDIUM_HEALTH_BAR = THEME_CONFIG.MEDIUM_HEALTH_BAR;
        const HIGH_HEALTH_BAR = THEME_CONFIG.HIGH_HEALTH_BAR;

        /***
         * 100% - 80%: green
         * 80 - 40%: yellow
         * 40 - 0%: red
         * gradient from green to yellow to red based on ratio
         */
        const colour = ratio > 0.6 ? this.lerp_colour(MEDIUM_HEALTH_BAR, HIGH_HEALTH_BAR, (ratio - 0.6) / 0.4) :
                          ratio > 0.2 ? this.lerp_colour(LOW_HEALTH_BAR, MEDIUM_HEALTH_BAR, (ratio - 0.2) / 0.4) :
                                         this.lerp_colour(Colour.from_rgb(255, 0, 0), LOW_HEALTH_BAR, ratio / 0.2);

        const width = this.radius + 40;
        const height = 8;

        ctx.save();
        let alpha = this.lerp_health_bar_opacity(dt);
        ctx.globalAlpha = alpha;
        ctx.translate(this.position.x + this.velocity.x + this.offset.x, this.position.y + this.velocity.y + this.offset.y + this.radius + 20);

        const true_width = Math.max(width - height, 1);
        const offset = -true_width / 2;

        /** Render the background of the health bar. */
        ctx.lineCap = "round";
        ctx.lineWidth = height;
        ctx.strokeStyle = THEME_CONFIG.HEALTH_BAR_BACKGROUND.css;
        ctx.beginPath();
        ctx.moveTo(offset + 0.5, 0.5);
        ctx.lineTo(offset + 0.5 + true_width, 0.5);
        ctx.stroke();

        /** Render the foreground of the health bar. */
        ctx.lineWidth = height * 0.75;
        ctx.strokeStyle = colour.css;
        ctx.beginPath();
        ctx.moveTo(offset + 0.5, 0.5);
        ctx.lineTo(offset + 0.5 + true_width * constrain(0, ratio, 1), 0.5);
        ctx.stroke();

        ctx.restore();
    };

    /** Shatters the entity. */
    public destroy(ctx: CanvasRenderingContext2D, dt: number)
    {
        this.target_opacity = 0;
        this.lerp_radius(dt);

        if (fuzzy_equals(this.opacity, 0))
        {
            this.dying_phase = DyingPhase.Dead;
            this.radius = 0;
        };
    };

    /** Revives the entity. */
    public revive(): void
    {
        this.dying_phase = DyingPhase.Alive;

        if (this.dont_revive) return;
        this.opacity = this.target_opacity = 1;
    };
};