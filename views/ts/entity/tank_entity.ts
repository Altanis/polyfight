import Client from "../client";
import SwiftStream from "../connection/stream";
import { BASE_RADIUS, THEME_CONFIG, level_to_score } from "../const/consts";
import { CensusProperties, DyingPhase, EntityIdentityIds, EntityType, Inputs, PlayerStatus, RenderPhase, UpgradeStats } from "../const/enums";
import { Turret } from "../const/tankdefs";
import Colour from "../utils/color";
import { TAU, constrain, fuzzy_equals, lerp, lerp_angle, score_format, timed_exponential_smoothing } from "../utils/functions";
import Vector from "../utils/vector";
import BaseEntity from "./base_entity";

/** An entity representing a tank. */
export default class TankEntity extends BaseEntity
{
    /** The surroundings of the entity. */
    public surroundings: BaseEntity[] = [];
    public name: string = "";

    public spawning: boolean = false;

    /** The ID of the entity which killed the client. */
    public killer: number = -1;
    /** The name of the killer. */
    public killer_name: string = "";

    /** The score of the client. */
    public score: number = 0;
    /** The target score of the client. */
    public target_score: number = 0;

    public z_index: number = 1;

    /** The width of the turret. */
    public turret_length: Array<number> = this.identity.turrets!.map(t => t.length);
    /** The target width of the turret. */
    public target_turret_length: Array<number> = this.identity.turrets!.map(t => t.length);

    public status = PlayerStatus.Player;

    /** The maximum ID of a projectile the player has spawned. */
    public latest_projectile_id = 0;

    /** The number of kills the tank has. */
    public kills: number = 0;

    public level_width: number = 0;

    // public debuggers: ({ x: number, y: number, id: number })[] = [];
    private old_entity_id = -1;

    /** The zoom translation (in degrees) when repelling as a predator. */
    public zoom_translation: number = 0;
    /** The radial translation when repelling as a predator. */
    public radial_translation: number = 0;
    /** The target radial translation when repelling as a predator. */
    public target_radial_translation: number = 0;

    /** The messages the player has sent. */
    public messages: Array<{content: string, position: Vector, target_position: Vector, opacity: number, target_opacity: number}> = [];
    /** Whether or not the player is typing. */
    public typing: boolean = false;
    
    // public debuggers: Array<{ x: number, y: number }> = [];
    public ready: boolean = false;

    /** The level of the client. */
    public get level(): number
    {
        let level = 0;
        while (level_to_score(level + 1) <= this.score + 1e-1) level++;
        return level;
    };

    public type: EntityType = EntityType.Tank;

    public constructor(client: Client)
    {
        super(client);
    };

    /** Lerps the score. */
    public lerp_score(dt: number): number
    {
        this.score = timed_exponential_smoothing(this.score, this.target_score, 0.9, dt)
        return this.score;
    };

    /** Lerps the level bar. */
    public lerp_level_bar(dt: number): number
    {
        const initial = level_to_score(this.level);
        const final = level_to_score(this.level + 1);

        this.level_width = timed_exponential_smoothing(this.level_width, (this.client.entity.score - initial) / (final - initial), 0.9, dt);
        return this.level_width;
    };

    /** Lerps the turret length(s). */
    public lerp_turret_length(dt: number): number[]
    {
        for (let i = 0; i < this.turret_length.length; i++)
        {
            this.turret_length[i] = lerp(this.turret_length[i], 0.55 * dt, this.target_turret_length[i]);
            if (fuzzy_equals(this.turret_length[i], this.target_turret_length[i]))
            {
                this.target_turret_length[i] = this.identity.turrets![i].length;
            }
        }

        return this.turret_length;
    };

    /** Lerps the radial translation. */
    public lerp_radial_translation(dt: number): number
    {
        this.radial_translation = lerp(this.radial_translation, 0.1 * dt, this.target_radial_translation);
        return this.radial_translation;
    };

    /** Renders the name of the entity. */
    public render_name(dt: number)
    {
        if (this.identity_id == EntityIdentityIds.Spectator) return;

        if (this.show_name && !this.dying_phase)
        {
            const context = this.client.polyfight_canvas.context;

            const clan_name = this.clan_info?.name;

            context.save();
            context.translate(this.position.x + this.velocity.x, this.position.y + this.velocity.y);

            if (this.client.polyfight_elements.get_query_variable(window.location.hash.slice(1).split("?")[1], "ranked") == "true")
            {
                this.client.polyfight_canvas.write_text(this.ready ? "✓ READY ✓" : "✗ NOT READY ✗", 0, -this.radius - 70, this.radius / 1.5, this.ready ? "#22FF00" : "#E60B25", 3, Colour.BLACK.css);
            }
            else if (clan_name)
            {
                this.client.polyfight_canvas.write_text(`[${clan_name}]`, 0, -this.radius - 70, this.radius / 1.5, THEME_CONFIG.CLAN_FILL.css, 3, Colour.BLACK.css);
            }

            // todo: separate id and text to have dff colours
            this.client.polyfight_canvas.write_text((this.client.polyfight_connection.is_host || this.client.entity.status == PlayerStatus.Developer ? `[${this.id}] `: "") + this.name, 0, -this.radius - 40, this.radius / 1.3, THEME_CONFIG.NAME_FILL.css, 3, Colour.BLACK.css);

            if (this.lerp_score(dt) != 0)
                this.client.polyfight_canvas.write_text(score_format(this.score), 0, -this.radius - 10, this.radius / 1.7, THEME_CONFIG.NAME_FILL.css, 3, Colour.BLACK.css);
            
            context.restore();
        };
    };

    public get clan_info()
    {
        if (this.clan == -1) return undefined;
        else return this.client.polyfight_canvas.clans[this.clan];
    }

    /** Renders the tank on the canvas. */
    public render(context: CanvasRenderingContext2D, dt: number)
    {
        for (let i = 0; i < (this.client.entity.identity.upgrade_notif || []).length; ++i)
        {
            let message = this.client.entity.identity.upgrade_notif![i];
            this.client.polyfight_canvas.add_notification({ message, r: 0, g: 0, b: 0 });
            this.identity.upgrade_notif?.splice(i, 1);
        }

        if (this.dying_phase == DyingPhase.Dying) this.destroy(context, dt);
        else if (this.dying_phase == DyingPhase.Dead && this.id == this.client.entity.id)
        {
            this.client.polyfight_canvas.phase = RenderPhase.Dead;
            return;
        };

        // for (const debug of this.debuggers)
        // {
        //     context.save();
        //     context.translate(debug.x, debug.y);
        //     context.fillStyle = "red";
        //     context.beginPath();
        //     context.arc(0, 0, 5, 0, TAU);
        //     context.fill();
        //     context.restore();
        // }

        if (this.identity_id == EntityIdentityIds.Spectator) return;

        let is_me = this.id == this.client.entity.id;
        
        context.save();
        context.translate(this.position.x + this.velocity.x + (is_me ? this.offset.x : 0), this.position.y + this.velocity.y + (is_me ? this.offset.y : 0));

        if (this.messages.length > 0)
        {
            // const offset = this.clan_info?.name || this.client.polyfight_elements.get_query_variable(window.location.hash.split("?")[1], "ranked") == "true" ? 40 : 0;

            // this.client.polyfight_canvas.context.save();

            // const font = window.getComputedStyle(document.body).getPropertyValue("--font");
            // this.client.polyfight_canvas.context.font = `24px ${font}`;
            // const rect_width = this.client.polyfight_canvas.context.measureText(this.message).width + 20;

            // this.client.polyfight_canvas.context.fillStyle = "rgba(0, 0, 0, 0.4)";
            // this.client.polyfight_canvas.context.beginPath();
            // this.client.polyfight_canvas.context.roundRect(-rect_width / 2, -this.radius - 92 - offset, rect_width, 30, 5);
            // this.client.polyfight_canvas.context.fill();

            // this.client.polyfight_canvas.write_text(this.message, 0, -this.radius - 70 - offset, 24, THEME_CONFIG.NAME_FILL.css, 3, Colour.BLACK.css);

            // if ((this.ticks % 20) < 10 && this.client.polyfight_canvas.chat_information.typing && this.client.entity.id == this.id)
            // {
            //     this.client.polyfight_canvas.context.strokeStyle = "white";
            //     this.client.polyfight_canvas.context.lineWidth = 2;
            //     this.client.polyfight_canvas.context.beginPath();
            //     this.client.polyfight_canvas.context.moveTo(this.client.polyfight_canvas.context.measureText(this.message).width / 2 + 5, -this.radius - 90 - offset);
            //     this.client.polyfight_canvas.context.lineTo(this.client.polyfight_canvas.context.measureText(this.message).width / 2 + 5, -this.radius - 65 - offset);
            //     this.client.polyfight_canvas.context.stroke();

            // }

            // this.client.polyfight_canvas.context.restore();

            /// ^^ this was for one message, but we need to render multiple messages
            for (let i = 0; i < this.messages.length; ++i) {
                let {content, position, target_position, opacity, target_opacity} = this.messages[i];

                const font = window.getComputedStyle(document.body).getPropertyValue("--font");
                this.client.polyfight_canvas.context.font = `24px ${font}`;
                const rect_width = this.client.polyfight_canvas.context.measureText(content).width + 20;

                const offset = (this.clan_info?.name ? 60 : 0) - i * 45 + 40;

                target_position = new Vector(0, -this.radius - 120 - offset);
                position.x = lerp(position.x, 0.1 * dt, target_position.x);
                position.y = lerp(position.y, 0.1 * dt, target_position.y);

                this.client.polyfight_canvas.context.save();

                opacity = this.client.polyfight_canvas.context.globalAlpha = lerp(opacity, 0.1 * dt, target_opacity);

                this.client.polyfight_canvas.context.fillStyle = "rgba(0, 0, 0, 0.4)";
                this.client.polyfight_canvas.context.beginPath();
                this.client.polyfight_canvas.context.roundRect(position.x - rect_width / 2, position.y - 22, rect_width, 30, 5);
                this.client.polyfight_canvas.context.fill();

                this.client.polyfight_canvas.write_text(content, position.x, position.y, 24, THEME_CONFIG.NAME_FILL.css, 3, Colour.BLACK.css);
                
                this.client.polyfight_canvas.context.restore();

                this.messages[i] = {content, position, target_position, opacity, target_opacity};
            }
        }
        else if (this.client.entity.id == this.id && this.client.polyfight_canvas.chat_information.force_open)
        {
            const inverse_transform = this.client.polyfight_canvas.canvas_transform.invertSelf();
            const tank_position = inverse_transform.transformPoint(DOMPoint.fromPoint(this.position.clone.add(this.velocity)));
            
            this.client.polyfight_elements.chat_input.style.display = "block";
            // this.client.polyfight_elements.chat_input.style.width = "200px";

            // const offset = this.clan_info?.name ? 40 : 0;

            // this.client.polyfight_canvas.context.save();

            // const font = window.getComputedStyle(document.body).getPropertyValue("--font");
            // this.client.polyfight_canvas.context.font = `24px ${font}`;
            // const rect_width = this.client.polyfight_canvas.context.measureText("[Enter] to send, [Esc] to escape.").width + 20;

            // this.client.polyfight_canvas.context.fillStyle = "rgba(0, 0, 0, 0.4)";
            // this.client.polyfight_canvas.context.beginPath();
            // this.client.polyfight_canvas.context.roundRect(-rect_width / 2, -this.radius - 92 - offset, rect_width, 30, 5);
            // this.client.polyfight_canvas.context.fill();

            // this.client.polyfight_canvas.context.save();
            // this.client.polyfight_canvas.context.globalAlpha = 0.6;
            // this.client.polyfight_canvas.write_text("[Enter] to send, [Esc] to escape.", 0, -this.radius - 70 - offset, 24, THEME_CONFIG.NAME_FILL.css, 3, Colour.BLACK.css);
            // this.client.polyfight_canvas.context.restore();

            // // this.client.canvas.context.font = "24px Overpass";
            // // const rect_width = this.client.canvas.context.measureText(this.message).width + 20;

            // // this.client.canvas.context.fillStyle = "rgba(0, 0, 0, 0.4)";
            // // this.client.canvas.context.beginPath();
            // // this.client.canvas.context.roundRect(-30 / 2, -this.radius - 92, 30, 30, 5);
            // // this.client.canvas.context.fill();

            // // this.client.canvas.context.save();
            // // this.client.canvas.context.globalAlpha = 0.8;
            // // this.client.canvas.write_text("[Enter] to send, [Esc] to escape.", 0, -this.radius - 70, 24, CONFIG.NAME_FILL.css, 3, Colour.BLACK.css);
            // // this.client.canvas.context.restore();


            // this.client.polyfight_canvas.context.restore();
        };

        if (this.typing) {
            this.client.polyfight_canvas.context.save();
            this.client.polyfight_canvas.write_text("Typing...", 0, -this.radius + 120, 16, "#FF794D", 3, Colour.BLACK.css);
            this.client.polyfight_canvas.context.restore();
        }

        const opacity = this.lerp_entity_opacity(dt);
        context.globalAlpha = opacity;
        context.lineWidth = THEME_CONFIG.STROKE_SIZE;

        if (this.id == this.client.entity.id)
        {
            context.globalAlpha = constrain(0.2, opacity, 1);
        }

        context.save();

        context.rotate(this.angle);

        /** Render the turrets. */
        if (this.old_entity_id != this.identity_id)
        {
            this.turret_length = this.identity.turrets!.map(t => t.length);
            this.target_turret_length = this.identity.turrets!.map(t => t.length);
        }
        this.old_entity_id = this.identity_id;

        this.lerp_turret_length(dt);

        const dominant: Array<Turret | undefined> = [];

        if (this.identity.turrets != undefined)
        {
            for (let i = 0; i < this.identity.turrets.length; ++i)
            {
                const turret = this.identity.turrets[i];

                if (turret.dominant)
                {
                    dominant[i] = turret;
                    continue;
                }

                context.save();

                context.fillStyle = THEME_CONFIG.TURRET_FILL.css;
                context.strokeStyle = THEME_CONFIG.TURRET_STROKE.css;
                
                turret.angle = lerp_angle(turret.angle, 0.25 * dt, turret.target_angle || turret.angle);

                const length = this.turret_length[i] * (this.radius / BASE_RADIUS);
                const width = turret.width * (this.radius / BASE_RADIUS);

                if (turret.trapezoidal)
                {
                    let reversed = (turret as { trapezoid_reverse?: boolean }).trapezoid_reverse;

                    const height = length;
                    const bottom_width = reversed ? width * 2 : width;
                    const top_width = reversed ? width : width * 2;

                    context.save();
                    context.rotate(turret.angle);
                    context.translate((turret.y_offset || 0) * (this.radius / BASE_RADIUS), turret.x_offset * (this.radius / BASE_RADIUS));

                    context.beginPath();
                    context.moveTo(0, -bottom_width / 2);
                    context.lineTo(height, -top_width / 2);
                    context.lineTo(height, top_width / 2);
                    context.lineTo(0, bottom_width / 2);
                    context.lineTo(0, -bottom_width / 2);
                    context.closePath();

                    context.fill();
                    context.stroke();
                    context.restore();
                }
                else if (turret.auto)
                {
                    context.save();
                    context.fillStyle = THEME_CONFIG.TURRET_FILL.css;
                    context.strokeStyle = THEME_CONFIG.TURRET_STROKE.css;
        
                    context.translate((turret.y_offset || 0) * (this.radius / BASE_RADIUS), turret.x_offset * (this.radius / BASE_RADIUS));
                    context.rotate(this.angle);
        
                    let adjusted_barrel_width = width / 1.5;
                
                    context.fillRect(0, -adjusted_barrel_width / 2, length, adjusted_barrel_width);
                    context.strokeRect(0, -adjusted_barrel_width / 2, length, adjusted_barrel_width);
        
                    context.beginPath();
                    context.arc(0, 0, width / 2, 0, TAU);
                    context.fill();
                    context.stroke();
        
                    context.restore();
                }
                else
                {
                    context.rotate(turret.angle);
                    context.translate((turret.y_offset || 0) * (this.radius / BASE_RADIUS), turret.x_offset * (this.radius / BASE_RADIUS));
    
                    context.fillRect(0, -width / 2, length, width);
                    context.strokeRect(0, -width / 2, length, width);
                }

                context.restore();
            };
        };

        if (this.identity.rotators != undefined)
        {
            for (let i = 0; i < this.identity.rotators.length; ++i)
            {
                const rotator = this.identity.rotators[i];

                context.save();

                context.fillStyle = THEME_CONFIG.SMASHER_FILL.css;
                context.strokeStyle = THEME_CONFIG.SMASHER_STROKE.css;
                context.lineWidth = THEME_CONFIG.STROKE_SIZE;

                if (rotator.angle >= TAU)
                {
                    rotator.angle -= TAU;
                }

                let new_angle = rotator.angle += (rotator.rpt * dt);
                this.angle = new_angle;
                // this.angle = lerp_angle(new_angle, 1, new_angle);

                context.rotate(this.angle);
                
                const radius = (rotator.size * this.radius);
                const sides = rotator.sides;

                context.beginPath();
                
                context.moveTo(radius, 0);

                for (let j = 0; j < sides; j++)
                {
                    const angle = TAU * j / sides;
                    const x = radius * Math.cos(angle);
                    const y = radius * Math.sin(angle);
                    context.lineTo(x, y);
                };

                context.closePath();

                context.fill();
                context.stroke();

                context.restore();
            };
        };

        let blend_amount = this.lerp_damage_blend(dt);
        if (fuzzy_equals(blend_amount, 1)) this.target_damage_blend = 0;

        const fill = (this.id == this.client.entity.id || (this.clan != -1 && this.clan == this.client.entity.clan)) ? THEME_CONFIG.PLAYER_FILL : THEME_CONFIG.ENEMY_FILL;
        const stroke = (this.id == this.client.entity.id || (this.clan != -1 && this.clan == this.client.entity.clan)) ? THEME_CONFIG.PLAYER_STROKE : THEME_CONFIG.ENEMY_STROKE;

        let stroke_colour = stroke.clone().blend_with(blend_amount, Colour.from_rgb(255, 0, 0));
        let fill_colour = fill.clone().blend_with(blend_amount, Colour.from_rgb(255, 0, 0));

        context.strokeStyle = stroke.css;
        context.fillStyle = fill.css;

        /** Render the body. */
        if (this.identity.square)
        {
            context.save();
            context.fillRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
            context.strokeRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
            context.restore();
        }
        else
        {
            switch (this.identity_id)
            {
                case EntityIdentityIds.Square:
                {
                    context.save();
                    context.fillStyle = THEME_CONFIG.SQUARE_FILL.css;
                    context.strokeStyle = THEME_CONFIG.SQUARE_STROKE.css;

                    context.beginPath();
                    context.rect(-20, -20, 20 * 2, 20 * 2);
                    context.fill();
                    context.stroke();

                    context.restore();
                    break;
                };

                case EntityIdentityIds.Triangle:
                {
                    context.save();
                    context.fillStyle = THEME_CONFIG.TRIANGLE_FILL.css;
                    context.strokeStyle = THEME_CONFIG.TRIANGLE_STROKE.css;

                    context.beginPath();
                    context.moveTo(0, -20 * 1.3);
                    context.lineTo(20 * 1.3 * 0.8660254037844387, 20 * 1.3 * 0.5);
                    context.lineTo(-20 * 1.3 * 0.8660254037844387, 20 * 1.3 * 0.5);
                    context.closePath();
                    context.fill();
                    context.stroke();

                    context.fill();
                    context.stroke();

                    context.restore();
                    break;
                };

                case EntityIdentityIds.SmallCrasher:
                {
                    context.save();
                    context.fillStyle = THEME_CONFIG.CRASHER_FILL.css;
                    context.strokeStyle = THEME_CONFIG.CRASHER_STROKE.css;

                    context.beginPath();
                    context.moveTo(0, -15 * 1.3);
                    context.lineTo(15 * 1.3 * 0.8660254037844387, 15 * 1.3 * 0.5);
                    context.lineTo(-15 * 1.3 * 0.8660254037844387, 15 * 1.3 * 0.5);
                    context.closePath();
                    context.fill();
                    context.stroke();

                    context.restore();
                    break;
                };

                case EntityIdentityIds.LargeCrasher:
                {
                    context.save();
                    context.fillStyle = THEME_CONFIG.CRASHER_FILL.css;
                    context.strokeStyle = THEME_CONFIG.CRASHER_STROKE.css;

                    context.beginPath();
                    context.moveTo(0, -25 * 1.3);
                    context.lineTo(25 * 1.3 * 0.8660254037844387, 25 * 1.3 * 0.5);
                    context.lineTo(-25 * 1.3 * 0.8660254037844387, 25 * 1.3 * 0.5);
                    context.closePath();
                    context.fill();
                    context.stroke();

                    context.restore();
                    break;
                };


                case EntityIdentityIds.Pentagon:
                {
                    context.save();
                    context.fillStyle = THEME_CONFIG.PENTAGON_FILL.css;
                    context.strokeStyle = THEME_CONFIG.PENTAGON_STROKE.css;

                    context.beginPath();
                    context.moveTo(0, -40);
                    context.lineTo(40 * 0.9510565162951535, -40 * 0.30901699437494745);
                    context.lineTo(40 * 0.5877852522924731, 40 * 0.8090169943749473);
                    context.lineTo(-40 * 0.587785252292473, 40 * 0.8090169943749475);
                    context.lineTo(-40 * 0.9510565162951536, -40 * 0.30901699437494734);
                    context.closePath();
                    context.fill();
                    context.stroke();

                    context.restore();
                    break;
                };

                case EntityIdentityIds.AlphaPentagon:
                {
                    context.save();
                    context.fillStyle = THEME_CONFIG.PENTAGON_FILL.css;
                    context.strokeStyle = THEME_CONFIG.PENTAGON_STROKE.css;

                    context.beginPath();
                    context.moveTo(0, -100);
                    context.lineTo(100 * 0.9510565162951535, -100 * 0.30901699437494745);
                    context.lineTo(100 * 0.5877852522924731, 100 * 0.8090169943749473);
                    context.lineTo(-100 * 0.587785252292473, 100 * 0.8090169943749475);
                    context.lineTo(-100 * 0.9510565162951536, -100 * 0.30901699437494734);
                    context.closePath();
                    context.fill();
                    context.stroke();

                    context.restore();
                    break;
                };

                default:
                {
                    context.beginPath();
                    context.arc(0, 0, this.radius, 0, TAU);
                    context.fill();
                    context.stroke();
                    break;
                }
            }
        }

        if (this.dying_phase == DyingPhase.Alive) /** Render damage infliction. */
        {
            if (!fuzzy_equals(blend_amount, 0))
            {
                context.strokeStyle = stroke_colour.css;
                context.fillStyle = fill_colour.css;
                context.globalAlpha = 0.6;

                if (this.identity.square)
                {
                    context.save();
                    context.fillRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
                    context.strokeRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
                    context.restore();
                }
                else
                {
                    context.beginPath();
                    context.arc(0, 0, this.radius, 0, TAU);
                    context.fill();
                    context.stroke();
                }
            }
        
            context.globalAlpha = 1;
        };

        if (this.spawning && (this.ticks % 10) < 5)
        {
            // context.strokeStyle = COLOUR_SCHEME.PLAYER_STROKE.clone().blend_with(0.5, Colour.from_rgb(255, 255, 255)).css;
            context.strokeStyle = stroke.css;
            context.fillStyle = fill.clone().blend_with(0.5, Colour.from_rgb(255, 255, 255)).css;
            context.globalAlpha = 0.6;

            if (this.identity.square)
            {
                context.save();
                context.fillRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
                context.strokeRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
                context.restore();
            }
            else
            {
                context.beginPath();
                context.arc(0, 0, this.radius, 0, TAU);
                context.fill();
                context.stroke();
            }
        };

        context.restore();

        for (let i = 0; i < dominant.length; i++)
        {
            const turret = dominant[i];
            if (turret === undefined) continue;

            context.save();

            context.fillStyle = THEME_CONFIG.TURRET_FILL.css;
            context.strokeStyle = THEME_CONFIG.TURRET_STROKE.css;
            
            turret.angle = lerp_angle(turret.angle, 0.25 * dt, turret.target_angle || turret.angle);

            context.rotate(turret.angle);
            context.translate((turret.y_offset || 0) * (this.radius / BASE_RADIUS), turret.x_offset * (this.radius / BASE_RADIUS));

            const length = this.turret_length[i] * (this.radius / BASE_RADIUS);
            const width = turret.width * (this.radius / BASE_RADIUS);

            if (turret.trapezoidal)
            {
                let reversed = (turret as { trapezoid_reverse?: boolean }).trapezoid_reverse;

                const height = length;
                const bottom_width = reversed ? width * 2 : width;
                const top_width = reversed ? width : width * 2;

                context.save();

                context.beginPath();
                context.moveTo(0, -bottom_width / 2);
                context.lineTo(height, -top_width / 2);
                context.lineTo(height, top_width / 2);
                context.lineTo(0, bottom_width / 2);
                context.lineTo(0, -bottom_width / 2);
                context.closePath();

                context.fill();
                context.stroke();
                context.restore();
            }
            else if (turret.auto)
            {
                context.save();
                context.fillStyle = THEME_CONFIG.TURRET_FILL.css;
                context.strokeStyle = THEME_CONFIG.TURRET_STROKE.css;
    
                // context.rotate(-this.angle);
                // context.translate(0, turret.x_offset);
    
                let adjusted_barrel_width = width / 1.5;
            
                context.fillRect(0, -adjusted_barrel_width / 2, length, adjusted_barrel_width);
                context.strokeRect(0, -adjusted_barrel_width / 2, length, adjusted_barrel_width);
    
                context.beginPath();
                context.arc(0, 0, width / 2, 0, TAU);
                context.fill();
                context.stroke();
    
                context.restore();
            }
            else
            {
                context.fillRect(0, -width / 2, length, width);
                context.strokeRect(0, -width / 2, length, width);
            }

            context.restore();
        }
        
        context.restore();
    };
};