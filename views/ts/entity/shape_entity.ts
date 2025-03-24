import Client from "../client";
import { THEME_CONFIG, IS_PROD } from "../const/consts";
import { DyingPhase, EntityType, ShapeType, ShinyType } from "../const/enums";
import Colour from "../utils/color";
import { TAU, fuzzy_equals } from "../utils/functions";
import BaseEntity from "./base_entity";

/** An entity representing a shape. */
export default class ShapeEntity extends BaseEntity
{
    /** The type of shape. */
    public shape_type: ShapeType = ShapeType.Unknown;
    /** Whether or not the shape is shiny. */
    public shiny: ShinyType = ShinyType.Normal;

    public show_name: boolean = false;
    public z_index: number = 0;

    public dying_phase: DyingPhase = DyingPhase.Alive;
    public type: EntityType = EntityType.Shape;

    public get name()
    {
        switch (this.shape_type)
        {
            case ShapeType.Square: return "Square";
            case ShapeType.Triangle: return "Triangle";
            case ShapeType.Pentagon: return "Pentagon";
            case ShapeType.AlphaPentagon: return "Alpha Pentagon";

            default: return "Unknown";
        }
    }

    public constructor(client: Client)
    {
        super(client);
    };

    private get stroke(): Colour
    {
        if (this.shiny == ShinyType.Shiny) return THEME_CONFIG.SHINY_STROKE;
        else if (this.shiny == ShinyType.Mythical) return THEME_CONFIG.MYTHICAL_STROKE;

        switch (this.shape_type)
        {
            case ShapeType.Square: return THEME_CONFIG.SQUARE_STROKE;
            case ShapeType.Triangle: return THEME_CONFIG.TRIANGLE_STROKE;
            case ShapeType.SmallCrasher: return THEME_CONFIG.CRASHER_STROKE;
            case ShapeType.LargeCrasher: return THEME_CONFIG.CRASHER_STROKE;
            case ShapeType.Pentagon: return THEME_CONFIG.PENTAGON_STROKE;
            case ShapeType.AlphaPentagon: return THEME_CONFIG.PENTAGON_STROKE;

            default: return THEME_CONFIG.SQUARE_STROKE;
        }
    };

    private get fill(): Colour
    {
        if (this.shiny == ShinyType.Shiny) return THEME_CONFIG.SHINY_FILL;
        else if (this.shiny == ShinyType.Mythical) return THEME_CONFIG.MYTHICAL_FILL;

        switch (this.shape_type)
        {
            case ShapeType.Square: return THEME_CONFIG.SQUARE_FILL;
            case ShapeType.Triangle: return THEME_CONFIG.TRIANGLE_FILL;
            case ShapeType.SmallCrasher: return THEME_CONFIG.CRASHER_FILL;
            case ShapeType.LargeCrasher: return THEME_CONFIG.CRASHER_FILL;
            case ShapeType.Pentagon: return THEME_CONFIG.PENTAGON_FILL;
            case ShapeType.AlphaPentagon: return THEME_CONFIG.PENTAGON_FILL;

            default: return THEME_CONFIG.SQUARE_FILL;
        }
    }

    /** Renders the shape on the canvas. */
    public render(context: CanvasRenderingContext2D, dt: number)
    {
        if (this.dying_phase == DyingPhase.Dying) this.destroy(context, dt);
        else if (this.dying_phase == DyingPhase.Dead) return;

        context.save();
        context.translate(this.position.x + this.velocity.x, this.position.y + this.velocity.y);

        if (this.show_name)
        {
            this.client.polyfight_canvas.write_text(this.name, 0, -this.radius - 10, 24, THEME_CONFIG.NAME_FILL.css, 3, Colour.BLACK.css);
        }

        context.rotate(this.angle + Math.PI / 2);
        context.globalAlpha = this.lerp_entity_opacity(dt);

        let blend_amount = this.lerp_damage_blend(dt);
        if (fuzzy_equals(blend_amount, 1)) this.target_damage_blend = 0;

        context.strokeStyle = this.stroke.css;
        context.fillStyle = this.fill.css;
        context.lineWidth = THEME_CONFIG.STROKE_SIZE;

        if (THEME_CONFIG.RENDER_AS_CIRCLE)
        {
            context.strokeStyle = this.stroke.css;
            context.fillStyle = this.fill.css;

            context.beginPath();
            context.arc(0, 0, this.radius, 0, TAU);
            context.fill();
            context.stroke();
        }
        else
        {
            switch (this.shape_type)
            {
                case ShapeType.Square:
                {
                    /** Render the body. */
                    context.beginPath();
                    context.rect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
                    context.fill();
                    context.stroke();
    
                    if (this.dying_phase == DyingPhase.Alive && !fuzzy_equals(blend_amount, 0)) /** Render damage infliction. */
                    {
                        context.strokeStyle = THEME_CONFIG.SQUARE_STROKE.clone().blend_with(blend_amount, Colour.from_rgb(255, 0, 0)).css;
                        context.fillStyle = THEME_CONFIG.SQUARE_FILL.clone().blend_with(blend_amount, Colour.from_rgb(255, 0, 0)).css;
                        context.globalAlpha = 0.6;
                
                        context.beginPath();
                        context.rect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
                        context.fill();
                        context.stroke();
    
                        context.globalAlpha = 1;
                    }
    
                    break;
                };
                
                case ShapeType.Triangle:
                {
                    /** Render the body. Ensure it's equilateral, and a circle with radius `this.radius` can be inscribed. */
                    context.beginPath();
                    context.moveTo(0, -this.radius * 1.3);
                    context.lineTo(this.radius * 1.3 * 0.8660254037844387, this.radius * 1.3 * 0.5);
                    context.lineTo(-this.radius * 1.3 * 0.8660254037844387, this.radius * 1.3 * 0.5);
                    context.closePath();
                    context.fill();
                    context.stroke();
    
                    if (this.dying_phase == DyingPhase.Alive && !fuzzy_equals(blend_amount, 0)) /** Render damage infliction. */
                    {
                        context.strokeStyle = THEME_CONFIG.TRIANGLE_STROKE.clone().blend_with(blend_amount, Colour.from_rgb(255, 0, 0)).css;
                        context.fillStyle = THEME_CONFIG.TRIANGLE_FILL.clone().blend_with(blend_amount, Colour.from_rgb(255, 0, 0)).css;
                        context.globalAlpha = 0.6;
                
                        context.beginPath();
                        context.moveTo(0, -this.radius * 1.3);
                        context.lineTo(this.radius * 1.3 * 0.8660254037844387, this.radius * 1.3 * 0.5);
                        context.lineTo(-this.radius * 1.3 * 0.8660254037844387, this.radius * 1.3 * 0.5);
                        context.closePath();
                        context.fill();
                        context.stroke();
    
                        context.globalAlpha = 1;
                    }
    
                    break;
                };
    
                case ShapeType.SmallCrasher:
                {
                    /** Render the body. Ensure it's equilateral, and a circle with radius `this.radius` can be inscribed. */
                    context.beginPath();
                    context.moveTo(0, -this.radius * 1.3);
                    context.lineTo(this.radius * 1.3 * 0.8660254037844387, this.radius * 1.3 * 0.5);
                    context.lineTo(-this.radius * 1.3 * 0.8660254037844387, this.radius * 1.3 * 0.5);
                    context.closePath();
                    context.fill();
                    context.stroke();
    
                    if (this.dying_phase == DyingPhase.Alive && !fuzzy_equals(blend_amount, 0)) /** Render damage infliction. */
                    {
                        context.strokeStyle = THEME_CONFIG.CRASHER_STROKE.clone().blend_with(blend_amount, Colour.from_rgb(255, 0, 0)).css;
                        context.fillStyle = THEME_CONFIG.CRASHER_FILL.clone().blend_with(blend_amount, Colour.from_rgb(255, 0, 0)).css;
                        context.globalAlpha = 0.6;
                
                        context.beginPath();
                        context.moveTo(0, -this.radius * 1.3);
                        context.lineTo(this.radius * 1.3 * 0.8660254037844387, this.radius * 1.3 * 0.5);
                        context.lineTo(-this.radius * 1.3 * 0.8660254037844387, this.radius * 1.3 * 0.5);
                        context.closePath();
                        context.fill();
                        context.stroke();
    
                        context.globalAlpha = 1;
                    }
    
                    break;
                };
    
                case ShapeType.LargeCrasher:
                {
                    /** Render the body. Ensure it's equilateral, and a circle with radius `this.radius` can be inscribed. */
                    context.beginPath();
                    context.moveTo(0, -this.radius * 1.3);
                    context.lineTo(this.radius * 1.3 * 0.8660254037844387, this.radius * 1.3 * 0.5);
                    context.lineTo(-this.radius * 1.3 * 0.8660254037844387, this.radius * 1.3 * 0.5);
                    context.closePath();
                    context.fill();
                    context.stroke();
    
                    if (this.dying_phase == DyingPhase.Alive && !fuzzy_equals(blend_amount, 0)) /** Render damage infliction. */
                    {
                        context.strokeStyle = THEME_CONFIG.CRASHER_STROKE.clone().blend_with(blend_amount, Colour.from_rgb(255, 0, 0)).css;
                        context.fillStyle = THEME_CONFIG.CRASHER_FILL.clone().blend_with(blend_amount, Colour.from_rgb(255, 0, 0)).css;
                        context.globalAlpha = 0.6;
                
                        context.beginPath();
                        context.moveTo(0, -this.radius * 1.3);
                        context.lineTo(this.radius * 1.3 * 0.8660254037844387, this.radius * 1.3 * 0.5);
                        context.lineTo(-this.radius * 1.3 * 0.8660254037844387, this.radius * 1.3 * 0.5);
                        context.closePath();
                        context.fill();
                        context.stroke();
    
                        context.globalAlpha = 1;
                    }
    
                    break;
                };
    
                case ShapeType.Pentagon:
                {
                    /** Render the body. */
                    context.beginPath();
                    context.moveTo(0, -this.radius);
                    context.lineTo(this.radius * 0.9510565162951535, -this.radius * 0.30901699437494745);
                    context.lineTo(this.radius * 0.5877852522924731, this.radius * 0.8090169943749473);
                    context.lineTo(-this.radius * 0.587785252292473, this.radius * 0.8090169943749475);
                    context.lineTo(-this.radius * 0.9510565162951536, -this.radius * 0.30901699437494734);
                    context.closePath();
                    context.fill();
                    context.stroke();
    
                    if (this.dying_phase == DyingPhase.Alive && !fuzzy_equals(blend_amount, 0)) /** Render damage infliction. */
                    {
                        context.strokeStyle = THEME_CONFIG.PENTAGON_STROKE.clone().blend_with(blend_amount, Colour.from_rgb(255, 0, 0)).css;
                        context.fillStyle = THEME_CONFIG.PENTAGON_FILL.clone().blend_with(blend_amount, Colour.from_rgb(255, 0, 0)).css;
                        context.globalAlpha = 0.6;
                
                        context.beginPath();
                        context.moveTo(0, -this.radius);
                        context.lineTo(this.radius * 0.9510565162951535, -this.radius * 0.30901699437494745);
                        context.lineTo(this.radius * 0.5877852522924731, this.radius * 0.8090169943749473);
                        context.lineTo(-this.radius * 0.587785252292473, this.radius * 0.8090169943749475);
                        context.lineTo(-this.radius * 0.9510565162951536, -this.radius * 0.30901699437494734);
                        context.closePath();
                        context.fill();
                        context.stroke();
    
                        context.globalAlpha = 1;
                    }
    
                    break;
                };
    
                case ShapeType.AlphaPentagon:
                {
                    /** Render the body. */
                    context.beginPath();
                    
                    const sideLength = 2 * this.radius * Math.sin(Math.PI / 5);
                    
                    const centerX = 0;
                    const centerY = 0;
                    const angleIncrement = Math.PI * 2 / 5;
                    let angle = Math.PI / 2 + angleIncrement;
                    for (let i = 0; i < 5; i++)
                    {
                        const vertexX = centerX + sideLength * Math.cos(angle);
                        const vertexY = centerY + sideLength * Math.sin(angle);
                        context.lineTo(vertexX, vertexY);
                        angle += angleIncrement;
                    }
                    
                    context.closePath();
                    context.fill();
                    context.stroke();
                    // context.beginPath();
                    // context.moveTo(0, -this.radius);
                    // context.lineTo(this.radius * 0.9510565162951535, -this.radius * 0.30901699437494745);
                    // context.lineTo(this.radius * 0.5877852522924731, this.radius * 0.8090169943749473);
                    // context.lineTo(-this.radius * 0.587785252292473, this.radius * 0.8090169943749475);
                    // context.lineTo(-this.radius * 0.9510565162951536, -this.radius * 0.30901699437494734);
                    // context.closePath();
                    // context.fill();
                    // context.stroke();
    
                    if (this.dying_phase == DyingPhase.Alive && !fuzzy_equals(blend_amount, 0)) /** Render damage infliction. */
                    {
                        context.strokeStyle = THEME_CONFIG.PENTAGON_STROKE.clone().blend_with(blend_amount, Colour.from_rgb(255, 0, 0)).css;
                        context.fillStyle = THEME_CONFIG.PENTAGON_FILL.clone().blend_with(blend_amount, Colour.from_rgb(255, 0, 0)).css;
                        context.globalAlpha = 0.6;
    
                        context.beginPath();
                    
                        const sideLength = 2 * this.radius * Math.sin(Math.PI / 5);
                        
                        const centerX = 0;
                        const centerY = 0;
                        const angleIncrement = Math.PI * 2 / 5;
                        let angle = Math.PI / 2 + angleIncrement;
                        for (let i = 0; i < 5; i++)
                        {
                            const vertexX = centerX + sideLength * Math.cos(angle);
                            const vertexY = centerY + sideLength * Math.sin(angle);
                            context.lineTo(vertexX, vertexY);
                            angle += angleIncrement;
                        }
                        
                        context.closePath();
                        context.fill();
                        context.stroke();
                
                        // context.beginPath();
                        // context.moveTo(0, -this.radius);
                        // context.lineTo(this.radius * 0.9510565162951535, -this.radius * 0.30901699437494745);
                        // context.lineTo(this.radius * 0.5877852522924731, this.radius * 0.8090169943749473);
                        // context.lineTo(-this.radius * 0.587785252292473, this.radius * 0.8090169943749475);
                        // context.lineTo(-this.radius * 0.9510565162951536, -this.radius * 0.30901699437494734);
                        // context.closePath();
                        // context.fill();
                        // context.stroke();
    
                        context.globalAlpha = 1;
                    }
    
                    break;
                }
    
                default: return (IS_PROD ? console.error("Invalid shape type received.", this.shape_type) : undefined);
            };
        }

        // write id on the shape
        // this.client.polyfight_canvas.write_text(this.id.toString(), 0, 0, 24, Colour.WHITE.css, 3, Colour.BLACK.css);

        context.restore();
    };
};