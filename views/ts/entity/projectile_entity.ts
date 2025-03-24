import Client from "../client";
import { BASE_RADIUS, THEME_CONFIG } from "../const/consts";
import { DyingPhase, ProjectileType } from "../const/enums";
import { Turret } from "../const/tankdefs";
import Colour from "../utils/color";
import { fuzzy_equals } from "../utils/functions";
import Vector from "../utils/vector";
import BaseEntity from "./base_entity";

export default class ProjectileEntity extends BaseEntity
{
    public get name()
    {
        return "Projectile";
    };

    public owners: Array<number> = [];
    public show_name: boolean = false;
    public show_health: boolean = false;
    
    public projectile_type: ProjectileType = ProjectileType.Bullet;

    public old_position: Vector = new Vector(0, 0);
    public estimated_displacement: Vector = new Vector(0, 0);
    public turrets: Array<Turret> = [];

    public z_index: number = -1;

    /** Renders the projectile on the canvas. */
    public render(context: CanvasRenderingContext2D, dt: number)
    {
        this.show_health = THEME_CONFIG.SHOW_PROJECTILE_HEALTH;

        if (this.dying_phase == DyingPhase.Dying)
        {
            this.destroy(context, dt);
            this.target_position.add(this.estimated_displacement);
        }
        else if (this.dying_phase == DyingPhase.Dead) return;
        else
        {
            this.estimated_displacement = this.position.clone.subtract(this.old_position);
            this.old_position = this.position.clone;
        }
        
        if (this.show_name) throw new Error("");

        const blend_amount = this.lerp_damage_blend(dt);
        if (fuzzy_equals(blend_amount, 1)) this.target_damage_blend = 0;

        context.save();
        context.translate(this.position.x + this.velocity.x, this.position.y + this.velocity.y);

        context.globalAlpha = this.lerp_entity_opacity(dt);
        const fill = (this.owners.includes(this.client.entity.id) || (this.clan != -1 && this.clan == this.client.entity.clan)) ? THEME_CONFIG.PLAYER_FILL : THEME_CONFIG.ENEMY_FILL;
        const stroke = (this.owners.includes(this.client.entity.id) || (this.clan != -1 && this.clan == this.client.entity.clan)) ? THEME_CONFIG.PLAYER_STROKE : THEME_CONFIG.ENEMY_STROKE;

        context.fillStyle = fill.css;
        context.strokeStyle = stroke.css;
        context.lineWidth = THEME_CONFIG.STROKE_SIZE;

        context.globalAlpha = this.opacity;

        if (this.projectile_type == ProjectileType.Drone)
        {
            context.rotate(this.angle + Math.PI / 2);
            context.beginPath();
            context.moveTo(0, -this.radius * 1.3);
            context.lineTo(this.radius * 1.3 * 0.8660254037844387, this.radius * 1.3 * 0.5);
            context.lineTo(-this.radius * 1.3 * 0.8660254037844387, this.radius * 1.3 * 0.5);
            context.closePath();
            
            context.fill();
            context.stroke();

            if (this.dying_phase == DyingPhase.Alive && !fuzzy_equals(blend_amount, 0))
            {
                context.globalAlpha = 0.6;
                context.fillStyle = fill.clone().blend_with(blend_amount, Colour.from_rgb(255, 0, 0)).css;
                context.strokeStyle = stroke.clone().blend_with(blend_amount, Colour.from_rgb(255, 0, 0)).css;

                context.beginPath();
                context.moveTo(0, -this.radius * 1.3);
                context.lineTo(this.radius * 1.3 * 0.8660254037844387, this.radius * 1.3 * 0.5);
                context.lineTo(-this.radius * 1.3 * 0.8660254037844387, this.radius * 1.3 * 0.5);
                context.closePath();

                context.fill();
                context.stroke();

                context.globalAlpha = 1;
            }
        }
        else if (this.projectile_type == ProjectileType.Trap)
        {
            let spikes = 3;

            context.rotate(this.angle + Math.PI / 2);
            context.beginPath();
            for (let i = 0; i < spikes; ++i)
            {
                const angle = (i * 2 * Math.PI / spikes) - Math.PI / (2);
                const x = this.radius * Math.cos(angle);
                const y = this.radius * Math.sin(angle);
                context.lineTo(x, y);
    
                const angle_inner = angle + Math.PI / 12;
                const x_inner = x + this.radius * Math.cos(angle_inner) * 0.5;
                const y_inner = y + this.radius * Math.sin(angle_inner) * 0.5;
                context.lineTo(x_inner, y_inner);
            }

            context.closePath();

            context.fill();
            context.stroke();

            if (this.dying_phase == DyingPhase.Alive && !fuzzy_equals(blend_amount, 0))
            {
                context.globalAlpha = 0.6;
                context.fillStyle = fill.clone().blend_with(blend_amount, Colour.from_rgb(255, 0, 0)).css;
                context.strokeStyle = stroke.clone().blend_with(blend_amount, Colour.from_rgb(255, 0, 0)).css;

                context.beginPath();
                for (let i = 0; i < spikes; ++i)
                {
                    const angle = (i * 2 * Math.PI / spikes) - Math.PI / (2);
                    const x = this.radius * Math.cos(angle);
                    const y = this.radius * Math.sin(angle);
                    context.lineTo(x, y);
        
                    const angle_inner = angle + Math.PI / 12;
                    const x_inner = x + this.radius * Math.cos(angle_inner) * 0.5;
                    const y_inner = y + this.radius * Math.sin(angle_inner) * 0.5;
                    context.lineTo(x_inner, y_inner);
                }
        
                context.closePath();
    
                context.fill();
                context.stroke();

                context.globalAlpha = 1;
            }
        }
        else if (this.projectile_type == ProjectileType.NecromancerDrone)
        {
            // context.fillStyle = CONFIG.NECRO_FILL.css;
            // context.strokeStyle = CONFIG.NECRO_STROKE.css;

            context.rotate(this.angle + Math.PI / 2);
            context.beginPath();
            context.rect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
            context.fill();
            context.stroke();

            if (this.dying_phase == DyingPhase.Alive && !fuzzy_equals(blend_amount, 0))
            {
                context.globalAlpha = 0.6;
                context.fillStyle = fill.clone().blend_with(blend_amount, Colour.from_rgb(255, 0, 0)).css;
                context.strokeStyle = stroke.clone().blend_with(blend_amount, Colour.from_rgb(255, 0, 0)).css;

                context.beginPath();
                context.rect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
                context.fill();
                context.stroke();

                context.globalAlpha = 1;
            }
        }
        else if (this.projectile_type == ProjectileType.Minion)
        {
            this.z_index = 2;

            const length = 48 * (this.radius / BASE_RADIUS);
            const width = 29 * (this.radius / BASE_RADIUS);
            
            context.rotate(this.angle);
            context.save();
            context.fillStyle = THEME_CONFIG.TURRET_FILL.css;
            context.strokeStyle = THEME_CONFIG.TURRET_STROKE.css;
            context.fillRect(0, -width / 2, length, width);
            context.strokeRect(0, -width / 2, length, width);
            context.restore();

            context.beginPath();
            context.arc(0, 0, this.radius, 0, Math.PI * 2);
            context.fill();
            context.stroke();

            if (this.dying_phase == DyingPhase.Alive && !fuzzy_equals(blend_amount, 0))
            {
                context.globalAlpha = 0.6;
                context.fillStyle = fill.clone().blend_with(blend_amount, Colour.from_rgb(255, 0, 0)).css;
                context.strokeStyle = stroke.clone().blend_with(blend_amount, Colour.from_rgb(255, 0, 0)).css;
    
                context.beginPath();
                context.arc(0, 0, this.radius, 0, Math.PI * 2);
                context.fill();
                context.stroke();
    
                context.globalAlpha = 1;
            }
        }
        else
        {
            context.rotate(this.angle + Math.PI / 2);
            context.beginPath();
            context.arc(0, 0, this.radius, 0, Math.PI * 2);
            context.fill();
            context.stroke();
    
            if (this.dying_phase == DyingPhase.Alive && !fuzzy_equals(blend_amount, 0))
            {
                context.globalAlpha = 0.6;
                context.fillStyle = fill.clone().blend_with(blend_amount, Colour.from_rgb(255, 0, 0)).css;
                context.strokeStyle = stroke.clone().blend_with(blend_amount, Colour.from_rgb(255, 0, 0)).css;
    
                context.beginPath();
                context.arc(0, 0, this.radius, 0, Math.PI * 2);
                context.fill();
                context.stroke();
    
                context.globalAlpha = 1;
            }
        }

        context.restore();
    }
};