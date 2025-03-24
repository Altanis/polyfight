import Client from "../client";
import { BASE_RADIUS, BUILD_ID, THEME_CONFIG, LEVEL_TO_SCORE_TABLE, commaify, level_to_score, prettify, MAX_CLANS, PROTIPS } from "../const/consts";
import { DyingPhase, EntityIdentityIds, Inputs, PlayerStatus, ProjectileType, RenderPhase, SpinType, UpgradeStats } from "../const/enums";
import { EntityIdentity, TANK_DEFS, Turret } from "../const/tankdefs";
import ProjectileEntity from "../entity/projectile_entity";
import Colour from "../utils/color";
import { TAU, constrain, fuzzy_equals, lerp, normalise_angle, timed_exponential_smoothing } from "../utils/functions";
import Vector from "../utils/vector";

/** Representation of a drawn button. */
interface ButtonInfo
{
    x: number;
    y: number;
    width: number;
    height: number;
    hovered: boolean;
    clicked: boolean;
    disabled: boolean;
    click: () => void;
};

interface NotificationInfo
{
    message: string;
    r: number;
    g: number;
    b: number;
    lifetime: number;

    index: number;
    target_index: number;
    opacity: number;
    target_opacity: number;
    initial_time: number;

    id?: number;
};

/** A representation of the canvas. */
export default class Canvas
{
    /** The HTML Canvas element. */
    public readonly canvas: HTMLCanvasElement = document.getElementById("canvas")! as HTMLCanvasElement;
    /** The canvas' context. */
    public readonly context: CanvasRenderingContext2D = this.canvas.getContext("2d")!;

    /** The Minimap Canvas element. */
    public readonly minimap_canvas: HTMLCanvasElement = document.getElementById("minimap_canvas")! as HTMLCanvasElement;
    /** The canvas' context. */
    public readonly minimap_context: CanvasRenderingContext2D = this.minimap_canvas.getContext("2d")!;

    public readonly score_canvas: HTMLCanvasElement = document.getElementById("score_canvas")! as HTMLCanvasElement;
    public readonly score_context: CanvasRenderingContext2D = this.score_canvas.getContext("2d")!;

    public readonly stats_canvas: HTMLCanvasElement = document.getElementById("stats_canvas")! as HTMLCanvasElement;
    public readonly stats_context: CanvasRenderingContext2D = this.stats_canvas.getContext("2d")!;

    public readonly upgrade_tanks_canvas: HTMLCanvasElement = document.getElementById("upgrades_canvas")! as HTMLCanvasElement;
    public readonly upgrade_tanks_context: CanvasRenderingContext2D = this.upgrade_tanks_canvas.getContext("2d")!;

    public readonly scoreboard_canvas: HTMLCanvasElement = document.getElementById("scoreboard_canvas")! as HTMLCanvasElement;
    public readonly scoreboard_context: CanvasRenderingContext2D = this.scoreboard_canvas.getContext("2d")!;

    public open_box_image = new Image();

    /** The client being rendered. */
    public readonly client: Client;
    /** The phase the canvas is on while rendering. */
    public phase: RenderPhase = RenderPhase.Home;

    /** The notifications the client has to render. */
    public notifications: Array<NotificationInfo> = [];

    /** The time of the last render, in milliseconds. */
    private last_render: number = 0;
    /** An array of the last 30 deltas. */
    private deltas: number[] = [];

    /** The opacity of the screen. */
    public screen_opacity: number = 1;
    /** The target opacity of the screen. */
    public target_screen_opacity: number = 1;

    /** A flag representing all the inputs. */
    public inputs: number = 0;
    /** Whether or not auto fire is enabled. */
    public auto_fire: boolean = false;
    /** Whether or not auto spin is enabled. */
    public auto_spin: SpinType = SpinType.None;
    public lock_mouse: boolean = false;

    public ticks = 0;

    /** The mouse of the client. */
    public mouse: Vector = new Vector(0, 0);
    
    /** The stats of the client. */
    public stats =
    {
        stats_value: Array(UpgradeStats.Sentinel).fill(0),
        // max_stats_value: Array(UpgradeStats.Sentinel).fill(7),
        get max_stats_value()
        {
            return [];
        },
        preloaded_stats: [] as Array<UpgradeStats>,
        upgrade_colours: Array(UpgradeStats.Sentinel).fill(0).map((x, i) => THEME_CONFIG.UPGRADES[i % UpgradeStats.Sentinel]),
        available_stat_points: 0,
        max_stat_points: 33 - 1,
        display: false,
        opacity: 1,
        target_opacity: 1,
        /** The width of one upgrade. */
        get upgrade_width() {
            return (22.5 * 7) / this.max_stats_value.reduce((a, b) => a > b ? a : b);
        },
    };
    
    /** The upgrade tanks of the client. */
    public upgrade_tanks =
    {
        current_upgrades: [] as Array<EntityIdentityIds>,
        angle: 0.0,
        direction: 1,
        dismissed: false
    };

    /** The chat information of the client. */
    public chat_information =
    {
        /** Whether or not the player is currently typing. */
        typing: false,
        force_open: false,
    };

    /** The scoreboard of the client. */
    public scoreboard: Array<{ name: string, score: number, target_score: number, id: number, identity: EntityIdentityIds }> = [];
    public leader_direction: number | null = null;
    public leader_intersection = new Vector(0, 0);

    /** The clans in the server. */
    public clans: Array<{
        id: number,
        name: string,
        owner: number,
        trying_to_join: boolean,
        members: Array<{ id: number, name: string, owner: boolean, position: Vector, distressed: boolean, leaving: boolean | null }>,
        pending_members: Array<{ id: number, name: string }> 
    }> = [];

    /** Cached members who have attempted to join the player's clan. */
    public clan_requests: Array<number> = [];

    /** The buttons on the death menu. */
    public death_buttons: Array<ButtonInfo> = [];
    /** The buttons on the stats canvas. */
    public stats_buttons: Array<ButtonInfo> = [];
    /** The buttons on the upgrade tanks canvas. */
    public upgrade_tanks_buttons: Array<ButtonInfo> = [];
    /** The close button for the upgrade thing. */
    public upgrade_tanks_close_button: ButtonInfo | null = null;

    /** Any metadata associated with changing a value every animation tick. */
    public animation_metadata =
    {
        /** The metadata of the y-value of the title. */
        title:
        {
            /** The bound of the value. */
            bound: -200,
            /** The amount to change the value by. */
            change: 30,
            /** The current value. */
            value: 0
        },
    };

    public zoom_pos: Vector = new Vector(0, 0);
    public canvas_transform: DOMMatrix = new DOMMatrix();

    public player_count = { server: 0, global: 0 };

    public constructor(client: Client)
    {
        this.client = client;

        Object.defineProperty(this.stats, "max_stats_value", { get: () => client.entity.identity.max_stats });
        if (window.matchMedia("(orientation: portrait)").matches) {
            alert("Please play in landscape mode for the best experience.");
        }

        this.open_box_image.src = "assets/icons/openbox.svg";

        /** Prevent contextmenu from opening. */
        this.canvas.addEventListener("contextmenu", e => e.preventDefault());
        this.minimap_canvas.addEventListener("contextmenu", e => e.preventDefault());
        this.score_canvas.addEventListener("contextmenu", e => e.preventDefault());
        this.stats_canvas.addEventListener("contextmenu", e => e.preventDefault());
        this.upgrade_tanks_canvas.addEventListener("contextmenu", e => e.preventDefault());
        this.scoreboard_canvas.addEventListener("contextmenu", e => e.preventDefault());

        /** Change dimensions of canvas upon window resize. */
        window.addEventListener("resize", () =>
        {
            const ui_scale = parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue("--ui-scale"));

            this.canvas.width = window.innerWidth * window.devicePixelRatio;
            this.canvas.height = window.innerHeight * window.devicePixelRatio;
            this.canvas.style.width = `${window.innerWidth}px`;
            this.canvas.style.height = `${window.innerHeight}px`;

            this.minimap_canvas.width = 150 * ui_scale * window.devicePixelRatio;
            this.minimap_canvas.height = 150 * ui_scale * window.devicePixelRatio;
            this.minimap_canvas.style.width = `${150 * ui_scale}px`;
            this.minimap_canvas.style.height = `${150 * ui_scale}px`;

            this.stats_canvas.width = 350 * ui_scale * window.devicePixelRatio;
            this.stats_canvas.height = 350 * ui_scale * window.devicePixelRatio;
            this.stats_canvas.style.width = `${350 * ui_scale}px`;
            this.stats_canvas.style.height = `${350 * ui_scale}px`;

            this.score_canvas.width = 500 * ui_scale * window.devicePixelRatio;
            this.score_canvas.height = 200 * ui_scale * window.devicePixelRatio;
            this.score_canvas.style.width = `${500 * ui_scale}px`;
            this.score_canvas.style.height = `${200 * ui_scale}px`;

            this.upgrade_tanks_canvas.width = 300 * ui_scale * window.devicePixelRatio;
            this.upgrade_tanks_canvas.height = 365 * ui_scale * window.devicePixelRatio;
            this.upgrade_tanks_canvas.style.width = `${300 * ui_scale}px`;
            this.upgrade_tanks_canvas.style.height = `${365 * ui_scale}px`;

            this.scoreboard_canvas.width = 300 * ui_scale * window.devicePixelRatio;
            this.scoreboard_canvas.height = 350 * ui_scale * window.devicePixelRatio;
            this.scoreboard_canvas.style.width = `${300 * ui_scale}px`;
            this.scoreboard_canvas.style.height = `${350 * ui_scale}px`;

            // if (this.client.polyfight_elements) this.client.polyfight_elements.game_buttons.style.width = `${300 * ui_scale}px`;
        });
        window.dispatchEvent(new Event("resize"));

        this.animation_metadata.title.value = -this.canvas.height / 2;

        /** Start the animation loop. */
        requestAnimationFrame(this.render.bind(this));

        setInterval(() =>
        {
            if (this.client.entity.dying_phase == DyingPhase.Alive)
            {
                this.send_packets();
            }
        }, 1000 / 10);
    };

    /** Interpolates the opacity of the screen. */
    public lerp_screen_opacity(dt: number): number
    {
        this.screen_opacity = lerp(this.screen_opacity, 0.15 * dt, this.target_screen_opacity);
        return this.screen_opacity;
    };

    /** Interpolates the x-offset of the stats section. */
    public lerp_stats_opacity(dt: number): number
    {
        // if (this.client.polyfight_canvas.is_mobile) this.stats.target_opacity = 0;

        this.stats.opacity = lerp(this.stats.opacity, 0.2 * dt, this.stats.target_opacity);
        return this.stats.opacity;
    }

    /** Writes text to the canvas. */
    public write_text(text: string, x: number, y: number, fill_size: number, fill_colour: string = "#FFFFFF", stroke_size: number = 0, stroke_colour: string = "#000000", bold: boolean = false, context = this.context, text_align = "center"): TextMetrics
    {
        context.save();
        context.translate(x, y);       

        const font = window.getComputedStyle(document.body).getPropertyValue("--font");
      
        context.miterLimit = 2;
        context.fillStyle = fill_colour;
        context.font = `bold ${fill_size}px ${font}`;
        context.textAlign = text_align as CanvasTextAlign;
        
        if (stroke_size > 0)
        {
            context.strokeStyle = stroke_colour;
            context.lineWidth = Math.ceil(fill_size / 5);
            context.strokeText(text, 0, 0);
        }

        context.fillText(text, 0, 0);
        
        const width = context.measureText(text);
        context.restore();

        return width;
    };

    public is_mobile = (function() {
        return (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    })();

    public render()
    {
        this.ticks++;
        window.dispatchEvent(new Event("resize"));
        this.minimap_canvas.style.background = THEME_CONFIG.MINIMAP_BACKGROUND.css;
        this.minimap_canvas.style.border = `calc(5px * var(--ui-scale)) solid ${THEME_CONFIG.MINIMAP_BORDER.css}`;

        if (parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue("--ui-scale")) != (this.is_mobile ? 0.5 : THEME_CONFIG.GUI_SCALE))
        {
            document.documentElement.style.setProperty("--ui-scale", this.is_mobile ? 0.5 : THEME_CONFIG.GUI_SCALE.toString());
            window.dispatchEvent(new Event("resize"));
        }

        let timestamp = performance.now();
        
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.minimap_context.clearRect(0, 0, this.minimap_canvas.width, this.minimap_canvas.height);
        this.score_context.clearRect(0, 0, this.score_canvas.width, this.score_canvas.height);
        this.stats_context.clearRect(0, 0, this.stats_canvas.width, this.stats_canvas.height);
        this.upgrade_tanks_context.clearRect(0, 0, this.upgrade_tanks_canvas.width, this.upgrade_tanks_canvas.height);
        this.scoreboard_context.clearRect(0, 0, this.scoreboard_canvas.width, this.scoreboard_canvas.height);

        /** Calculate the delta. */
        const delta = timestamp - this.last_render;
        this.last_render = timestamp;

        this.deltas.push(delta);
        if (this.deltas.length > 100) this.deltas.shift();

        const delta_average = this.deltas.reduce((a, b) => a + b) / this.deltas.length;

        this.minimap_canvas.style.opacity = Math.min(THEME_CONFIG.MINIMAP_BACKGROUND_ALPHA, this.screen_opacity).toString();
        this.score_canvas.style.opacity = Math.min(0.8, this.screen_opacity).toString();

        switch (this.phase)
        {
            case RenderPhase.Home: this.render_game(timestamp, delta_average, false, false); break;
            case RenderPhase.Game: this.render_game(timestamp, delta_average, false, true); break;
            case RenderPhase.Dead: this.render_death(timestamp, delta_average); break;
        };

        // this.client.elements.fps_counter.innerText = `${(1000 / delta_average).toFixed(1)} FPS`;
        // this.context.save();

        this.context.save();
        const factor = Math.max(this.canvas.width / 1920, this.canvas.height / 1080);
        // const factor = window.devicePixelRatio;
        this.context.scale(factor, factor);
        this.write_text(`${(1000 / delta_average).toFixed(1)} FPS`, this.canvas.width / factor / 2, this.canvas.height / factor - 40, 14, "#FFFFFF", 3, "#000000", false);
        this.write_text(`${(this.client.polyfight_connection.calculate_latency() || 0).toFixed(1)} ms / ${(this.client.polyfight_connection.lerp_mspt() || 0).toFixed(1)} mspt`, this.canvas.width / factor / 2, this.canvas.height / factor - 20, 14, "#FFFFFF", 3, "#000000", false);
        this.context.restore();

        requestAnimationFrame(this.render.bind(this));
    };

    // private render_homescreen(): void
    // {
    //     /** Draw the background. */
    //     // this.context.drawImage(this.client.assets.images.home, 0, 0, this.canvas.width, this.canvas.height);

    //     if (this.client.polyfight_connection.connected)
    //     {
    //         // if ((this.animation_metadata.homescreen_background.value += this.animation_metadata.homescreen_background.change) > this.animation_metadata.homescreen_background.bound)
    //             // this.context.globalAlpha = this.animation_metadata.homescreen_background.bound;
    //         // else this.context.globalAlpha = this.animation_metadata.homescreen_background.value;
    //         /** Change the opacity of the textbox. */
    //         // this.client.elements.textbox.style.opacity = this.context.globalAlpha.toString();        
    
    //         /** Draw the title. */
    //         // if ((this.animation_metadata.title.value += this.animation_metadata.title.change) > this.animation_metadata.title.bound)
    //         //     this.animation_metadata.title.value = this.animation_metadata.title.bound;

    //         // this.client.elements.game_title.style.top = `${this.animation_metadata.title.value}px`;
                    
    //         if (window.localStorage.getItem("changelog_last_build_checked") == null || BUILD_ID > parseInt(window.localStorage.getItem("changelog_last_build_checked")!))
    //             this.client.polyfight_elements.changelog_button.style.animation = "pulse 0.5s infinite";
    //         else this.client.polyfight_elements.changelog_button.style.animation = "";
    //     };
    // };

    public generate_spritesheet()
    {
        /** @ts-ignore */
        const context = new window.C2S(500, 500) as CanvasRenderingContext2D;

        const style = document.createElement("style");
        style.innerHTML = `.sprite { display: none; }\n.sprite:target { display: inline; }`;
        /** @ts-ignore */
        context.__root.childNodes[0].appendChild(style);

        for (let i = 0; i < TANK_DEFS.length; i++)
        {
            if (i == EntityIdentityIds.Spectator) continue;
            const tank = TANK_DEFS[i];

            const position = new Vector(500 / 2, 500 / 2);
            const radius = 100;

            this.render_tank(tank, radius, context, false, position);
            
            /** @ts-ignore */
            const groupElement = context.__root.childNodes[1].childNodes[context.__root.childNodes[1].childNodes.length - 1];
            if (groupElement)
            {
                groupElement.setAttribute("id", tank.name);
                groupElement.setAttribute("class", "sprite");
            }
        };

        {
                const position = new Vector(500 / 2, 500 / 2);
                const radius = 25;

                const projectile = new ProjectileEntity(this.client);
                projectile.projectile_type = ProjectileType.Bullet;
                projectile.dying_phase = DyingPhase.Alive;
                projectile.position = projectile.target_position = position;
                projectile.radius = projectile.target_radius = radius;
                projectile.render(context, 1);

                /** @ts-ignore */
                const groupElement = context.__root.childNodes[1].childNodes[context.__root.childNodes[1].childNodes.length - 1];
                if (groupElement)
                {
                    groupElement.setAttribute("id", "bullet");
                    groupElement.setAttribute("class", "sprite");
                }
        }

        /** @ts-ignore */
        const svg = context.getSerializedSvg();
        const blob = new Blob([svg], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);

        /** @ts-ignore */
        const spritesheet = window.spritesheet = url;
        /** @ts-ignore */
        // document.body.innerHTML = document.body.innerHTML.replaceAll("assets/images/spritesheet.svg", spritesheet);
        const elements = document.querySelectorAll('img[src*="assets/images/spritesheet"]');
        elements.forEach(element =>
        {
            element.setAttribute("src", spritesheet + "#" + element.getAttribute("src")?.split("#")[1]);
        });
    }

    private render_game(timestamp: number, delta_average: number, dead = false, ui: boolean): void
    {
        // if (!this.chat_information.force_open) document.body.focus();

        if (window.localStorage.getItem("changelog_last_build_checked") == null || BUILD_ID > parseInt(window.localStorage.getItem("changelog_last_build_checked")!))
            this.client.polyfight_elements.changelog_button.style.animation = "pulse 0.5s infinite";
        else this.client.polyfight_elements.changelog_button.style.animation = "";

        this.context.lineJoin = "round";

        /** Draw the outbounds. */
        this.context.fillStyle = THEME_CONFIG.INBOUNDS_FILL.css;
        this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.context.fillStyle = `rgba(${THEME_CONFIG.OUTBOUNDS.r}, ${THEME_CONFIG.OUTBOUNDS.g}, ${THEME_CONFIG.OUTBOUNDS.b}, ${THEME_CONFIG.OUTBOUNDS_OPACITY})`;
        this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.context.save();

        /** Lerp the position, velocity, and angle of the entity. */
        const delta_tick = constrain(0, delta_average / 16.66, 1);

        // const camera_speed = this.client.entity.identity.speed
        // const movement = new Vector(
        //     ((this.inputs & Inputs.Left) == Inputs.Left) ? -1 : (((this.inputs & Inputs.Right) == Inputs.Right) ? 1 : 0),
        //     ((this.inputs & Inputs.Up) == Inputs.Up) ? -1 : (((this.inputs & Inputs.Down) == Inputs.Down) ? 1 : 0)
        // ).scale();

        this.client.entity.lerp_position(delta_tick, delta_average / 1000);
        let zooming = ((this.inputs & Inputs.Repel) == Inputs.Repel && this.client.entity.identity_id == EntityIdentityIds.Predator);
        const position = zooming ? this.zoom_pos : this.client.entity.position;
        // const _ = this.client.entity.lerp_angle(delta_tick);
        const fov = this.client.entity.lerp_fov(delta_tick);

        if (this.auto_spin != SpinType.None && !this.client.entity.identity.disable_mouse)
        {
            let angle = normalise_angle(this.mouse.angle() + (this.auto_spin == SpinType.Tbag ? 0.1 : THEME_CONFIG.SPIN_INTENSITY));
            this.mouse.rotate(angle);
            
            this.client.entity.target_angle = this.client.entity.angle = angle;
        };

        /** Render the position on the minimap. */
        this.minimap_context.save();
        const minimap_scale = Math.min(this.minimap_canvas.width / 150, this.minimap_canvas.height / 150);
        const minimap_width = this.minimap_canvas.width / minimap_scale;
        const minimap_height = this.minimap_canvas.height / minimap_scale;

        this.minimap_context.scale(minimap_scale, minimap_scale);
        this.minimap_context.fillStyle = THEME_CONFIG.MINIMAP_PLAYER_FILL.css;

        this.minimap_context.beginPath();
        this.minimap_context.arc(this.client.entity.position.x * minimap_width / this.client.game_server_config.arena_size, this.client.entity.position.y * minimap_height / this.client.game_server_config.arena_size, 3, 0, Math.PI * 2);
        this.minimap_context.fill();

        for (const member of this.client.entity.clan_info?.members || [])
        {
            if (member.distressed)
            {
                this.add_notification({ message: `${member.name} is calling for help!`, r: 255, g: 0, b: 0, id: member.id });
                member.distressed = false;
            }

            if (member.leaving)
            {
                this.add_notification({ message: `${member.name} is going to leave the clan in 5 seconds.`, r: 255, g: 0, b: 0 });
                member.leaving = null;
            }

            if (member.id == this.client.entity.id) continue;


            let in_danger = this.notifications.find(x => x.id == member.id) != undefined;

            this.minimap_context.fillStyle = in_danger ? Colour.from_rgb(255, 0, 0).css : THEME_CONFIG.MINIMAP_PLAYER_FILL.css;
            this.minimap_context.globalAlpha = 0.5;
            this.minimap_context.beginPath();
            this.minimap_context.arc(member.position.x * minimap_width / this.client.game_server_config.arena_size, member.position.y * minimap_height / this.client.game_server_config.arena_size, 3, 0, Math.PI * 2);
            this.minimap_context.fill();
        }

        this.minimap_context.restore();

        /** Render the camera. */
        const factor = Math.max(this.canvas.width / 1920, this.canvas.height / 1080);
        // const factor = window.devicePixelRatio;
        const screen_width = this.canvas.width / factor;
        const screen_height = this.canvas.height / factor;

        this.client.entity.target_radial_translation = (((this.inputs & Inputs.Repel) == Inputs.Repel) && this.client.entity.identity_id == EntityIdentityIds.Predator) ? (this.client.entity.identity.translation || 0) : 0;
        const t = this.client.entity.lerp_radial_translation(delta_tick);

        let translation_x = t * Math.cos(this.client.entity.zoom_translation);
        let translation_y = t * Math.sin(this.client.entity.zoom_translation);

        this.context.translate(this.canvas.width / 2, this.canvas.height / 2);
        this.context.scale(factor / fov, factor / fov);

        // this.context.translate(-position.x - translation_x + this.client.entity.velocity.x, -position.y - translation_y + this.client.entity.velocity.y);
        this.context.translate(-position.x - translation_x, -position.y - translation_y);

        // this.context.translate(-position.x, -position.y);

        /** Render the inbounds. */
        // this.context.strokeStyle = CONFIG.INBOUNDS_OUTLINE.css;
        this.context.lineWidth = 5;
        this.context.fillStyle = THEME_CONFIG.INBOUNDS_FILL.css;

        // this.context.strokeRect(0, 0, this.client.game_server_config.arena_size, this.client.game_server_config.arena_size);
        this.context.fillRect(0, 0, this.client.game_server_config.arena_size, this.client.game_server_config.arena_size);

        /** Render the grid. */
        this.context.save();
        this.canvas_transform = this.context.getTransform();

        // this.context.resetTransform();
        // this.context.translate(-position.x + this.client.entity.velocity.x, -position.y + this.client.entity.velocity.y);

        this.context.globalAlpha = THEME_CONFIG.GRID_ALPHA;
        this.context.strokeStyle = THEME_CONFIG.GRID.css;
        this.context.lineWidth = 1 / this.client.entity.fov;

        for (let x = 0; x < this.client.game_server_config.arena_size; x += +THEME_CONFIG.GRID_SIZE)
        {
            this.context.beginPath();
            this.context.moveTo(x, 0);
            this.context.lineTo(x, this.client.game_server_config.arena_size);
            this.context.stroke();
        };

        for (let y = 0; y < this.client.game_server_config.arena_size; y += +THEME_CONFIG.GRID_SIZE)
        {
            this.context.beginPath();
            this.context.moveTo(0, y);
            this.context.lineTo(this.client.game_server_config.arena_size, y);
            this.context.stroke();
        };

        this.context.restore();

        [this.client.entity, ...this.client.entity.surroundings]
            .sort((a, b) => a.z_index - b.z_index)
            .forEach(e =>
            {
                if (e.id != this.client.entity.id)
                {
                    e.lerp_position(delta_tick, delta_average / 1000);
                    e.lerp_angle(delta_tick);
                }
                
                e.render(this.context, delta_tick);
                /** @ts-ignore */
                if (window.threedee)
                {
                    this.context.save();
                    this.context.translate(2, 2);
                    e.render(this.context, delta_tick);
                    this.context.restore();
                }
            });

        // if (this.client.entity.surroundings.length == 0) {
            // console.log("No entities to render");
        // }

        this.client.entity.surroundings
            .sort((a, b) => a.z_index - b.z_index)
            .forEach(e => (e.dying_phase == DyingPhase.Alive) && e.render_health_bar(this.context, delta_tick));
        this.client.entity.surroundings.forEach(e => e.render_name(delta_tick));
        if (!this.client.entity.dying_phase)
        {
            this.client.entity.render_health_bar(this.context, delta_tick);
        }

        if (this.client.entity.dying_phase == DyingPhase.Alive && this.is_mobile) {
            const translated_mouse = this.mouse.clone.add(new Vector(this.canvas.width / 2, this.canvas.height / 2));
            const inverse_transform = this.context.getTransform().invertSelf();
            const mouse = new Vector(inverse_transform.a * translated_mouse.x + inverse_transform.e, inverse_transform.d * translated_mouse.y + inverse_transform.f);

            this.context.save();
            this.context.strokeStyle = this.inputs & Inputs.Repel ? "red" : "grey";
            this.context.lineWidth = 5;
            this.context.beginPath();
            
            this.context.moveTo(mouse.x + 10, mouse.y);
            this.context.lineTo(mouse.x + 30, mouse.y);
    
            this.context.moveTo(mouse.x - 10, mouse.y);
            this.context.lineTo(mouse.x - 30, mouse.y);
    
            this.context.moveTo(mouse.x, mouse.y + 10);
            this.context.lineTo(mouse.x, mouse.y + 30);
    
            this.context.moveTo(mouse.x, mouse.y - 10);
            this.context.lineTo(mouse.x, mouse.y - 30);
    
            this.context.stroke();
        }

        this.context.restore();
        
        if (ui)
        {
            if (this.leader_direction != null)
            {
                this.context.save();
    
                const factor = Math.max(this.canvas.width / 1920, this.canvas.height / 1080);
                this.context.scale(factor, factor);
    
                const screen_width = this.canvas.width / factor;
                const screen_height = this.canvas.height / factor;
    
                this.context.fillStyle = THEME_CONFIG.LEADERBOARD_ARROW_FILL.css;
                this.context.strokeStyle = this.context.fillStyle;
                this.context.globalAlpha = 0.3;
    
                this.context.beginPath();
            
                let centerX = screen_width / 2;
                let centerY = screen_height / 2;
                let rayLength = Math.max(centerX, centerY);
    
                let angle = normalise_angle(this.leader_direction + Math.PI);
                var endX = centerX + rayLength * Math.cos(angle);
                var endY = centerY + rayLength * Math.sin(angle);
            
                // this.context.moveTo(centerX, centerY);
                // this.context.lineTo(endX, endY);
            
                let intersectionX, intersectionY;
                let slope = Math.tan(this.leader_direction);
                
                if (Math.abs(slope) > screen_height / screen_width)
                {
                    intersectionX = (endY > centerY) ? centerX + (screen_height - centerY) / slope : centerX - centerY / slope;
                    intersectionY = (endY > centerY) ? screen_height : 0;
                }
                else
                {
                    intersectionY = (endX > centerX) ? centerY + (screen_width - centerX) * slope : centerY - centerX * slope;
                    intersectionX = (endX > centerX) ? screen_width : 0;
                }
    
                intersectionY += 50 * ((endY > centerY) ? -1 : 1);
                intersectionX += 50 * ((endX > centerX) ? -1 : 1);
    
                if (this.leader_intersection.x == 0 && this.leader_intersection.y == 0)
                {
                    this.leader_intersection = new Vector(intersectionX, intersectionY);
                }
                else
                {
                    this.leader_intersection.x = lerp(this.leader_intersection.x, 0.1, intersectionX);
                    this.leader_intersection.y = lerp(this.leader_intersection.y, 0.1, intersectionY);
                }
    
                let arrowSize = 45;
                this.context.moveTo(this.leader_intersection.x, this.leader_intersection.y);
                this.context.lineTo(this.leader_intersection.x - arrowSize * Math.cos(angle - Math.PI / 6), this.leader_intersection.y - arrowSize * Math.sin(angle - Math.PI / 6));
                this.context.moveTo(this.leader_intersection.x, this.leader_intersection.y);
                this.context.lineTo(this.leader_intersection.x - arrowSize * Math.cos(angle + Math.PI / 6), this.leader_intersection.y - arrowSize * Math.sin(angle + Math.PI / 6));
                this.context.moveTo(this.leader_intersection.x - arrowSize * Math.cos(angle - Math.PI / 6), this.leader_intersection.y - arrowSize * Math.sin(angle - Math.PI / 6));
                this.context.lineTo(this.leader_intersection.x - arrowSize * Math.cos(angle + Math.PI / 6), this.leader_intersection.y - arrowSize * Math.sin(angle + Math.PI / 6));
                this.context.lineTo(this.leader_intersection.x, this.leader_intersection.y);
            
                this.context.closePath();
    
                this.context.fill();
                this.context.stroke();
    
                // Write "LEADER" below arrow
                this.context.save();
                this.context.globalAlpha = 0.9;
                this.context.translate(this.leader_intersection.x, this.leader_intersection.y);
                this.context.rotate(angle + Math.PI / 2);
                this.write_text("LEADER", 0, 70, 14, "#FFFFFF", 3, "#000000", false);
                this.context.restore();
            
                this.context.restore();
            }

            this.render_scoreboard(delta_tick);
            this.render_score(delta_tick);
            this.render_upgrade_stats(delta_tick);

            if (this.client.entity.ticks % 16 == 0)
            {
                this.render_clans();
            }
    
            if (!dead)
            {
                this.render_upgrade_tanks(delta_tick);
    
                this.context.resetTransform();
    
                // this.context.save();
    
                // const scale = Math.min(this.canvas.width / 1920, this.canvas.height / 1080);
                // this.context.scale(scale, scale);
    
                // const screen_width = this.canvas.width / scale;
                // const screen_height = this.canvas.height / scale;
    
                // const minimap_scale = Math.min(this.minimap_canvas.width / 150, this.minimap_canvas.height / 150);
                // const minimap_width = this.minimap_canvas.width / minimap_scale;
                // const minimap_height = this.minimap_canvas.height / minimap_scale;
    
                // // this.write_text(`${this.client.connection.latency.toFixed(1)} ms`, this.canvas.width - 15 - (this.minimap_canvas.width / 2), this.canvas.height - 30 - this.minimap_canvas.height, 14, "#FFFFFF", 3, "#000000", false);
                // // this.write_text(, screen_width - (30) - (minimap_width / 2), screen_height - (50) - minimap_height, 14, "#FFFFFF", 3, "#000000", false);
    
                // // const scale = Math.min(this.canvas.width / 1920, this.canvas.height / 1080);
                // // // this.context.scale(scale, scale);
    
                // // const screen_width = this.canvas.width / scale;
                // // const screen_height = this.canvas.height / scale;
    
                // // const minimap_scale = Math.min(this.minimap_canvas.width / 150, this.minimap_canvas.height / 150);
                // // const minimap_width = this.minimap_canvas.width / minimap_scale;
                // // const minimap_height = this.minimap_canvas.height / minimap_scale;
    
                // // this.write_text(`${this.client.connection.latency.toFixed(1)} ms`, screen_width - 15 - (this.minimap_canvas.width / 2), screen_height - 30 - this.minimap_canvas.height, 14, "#FFFFFF", 3, "#000000", false);
                // this.context.restore();
            };
        }

        this.render_notifications(timestamp);
    };

    private send_packets()
    {
        const canvas_transform = this.canvas_transform;
        
        let inputs = this.inputs;
        if (this.auto_fire) inputs |= Inputs.Shoot;
        if (this.auto_spin != SpinType.None && !this.client.entity.identity.disable_mouse)
        {
            let angle = normalise_angle(this.mouse.angle() + (this.auto_spin == SpinType.Tbag ? 0.2 : THEME_CONFIG.SPIN_INTENSITY));
            this.mouse.rotate(angle);
        };

        const translated_mouse = this.mouse.clone.add(new Vector(this.canvas.width / 2, this.canvas.height / 2));

        const inverse_transform = canvas_transform.inverse();
        const mouse = new Vector(inverse_transform.a * translated_mouse.x + inverse_transform.e, inverse_transform.d * translated_mouse.y + inverse_transform.f);

        if (this.client.entity.identity.disable_mouse) inputs &= ~Inputs.Shoot;

        this.client.polyfight_connection.packet_handler.write_input(inputs, mouse);
        this.inputs &= ~Inputs.Suicide;
    };

    public add_notification(notification: { message: string, r: number, g: number, b: number, id?: number }): void
    {
        if (notification.message.includes("killed")) this.client.entity.kills++;
        else if (notification.message.includes("has won the game 6-"))
        {
            const score = parseInt(notification.message.split("has won the game 6-")[1][0]);
            const name = notification.message.split(" has won")[0];

            if (this.client.entity.name == name)
            {
                this.client.polyfight_elements.team.innerText = `You won the game 6-${score}!`;
            }
            else
            {
                this.client.polyfight_elements.team.innerText = `You lost the game ${score}-6...`;
            }
        }
        else if (notification.message.includes("The 1v1 has started!"))
        {
            this.client.polyfight_connection.in_1v1 = true;
        }
        else if (notification.message.includes("Arena closed"))
        {
            this.client.polyfight_connection.should_reconnect = true;
        }
        else if (notification.message.includes("You are now a")) {
            const type = notification.message.split("You are now a ")[1].split(".")[0];
            switch (type) {
                case "Player": this.client.entity.status = PlayerStatus.Player; break;
                case "Moderator": this.client.entity.status = PlayerStatus.Moderator; break;
                case "Developer": this.client.entity.status = PlayerStatus.Developer; break;
            }
        }

        for (const notification of this.notifications)
        {
            notification.target_index++;
        }

        this.notifications.unshift({ ...notification, index: 0, target_index: 0, opacity: 0, target_opacity: 1, lifetime: 5000, initial_time: performance.now(), id: notification.id || undefined });
    };

    private render_clans(): void
    {
        if (this.clans.length >= MAX_CLANS) {
            this.client.polyfight_elements.clan_textbox.setAttribute("disabled", "disabled");
            this.client.polyfight_elements.clan_textbox.placeholder = "Max # of clans reached";
            this.client.polyfight_elements.clan_create.classList.add("disabled");
        }

        const clan = this.client.entity.clan_info;

        if (clan === undefined)
        {
            this.client.polyfight_elements.clan_modal_title.innerText = "Clans";
            this.client.polyfight_elements.clan_list.innerHTML = "";
            for (let i = 0; i < this.clans.length; ++i)
            {
                const clan = this.clans[i];

                const element = document.createElement("div");
                element.id = "clan-entry";
    
                const name = document.createElement("span");
                name.id = "clan-name";
                name.innerText = clan.name;
                element.appendChild(name);

                const button = document.createElement("button");
                button.id = clan.trying_to_join ? "clan-pending" : "clan-join";
                button.dataset.clan_id = clan.id.toString();
                button.innerText = clan.trying_to_join ? "Pending..." : "Join";
                element.appendChild(button);
    
                const members = document.createElement("span");
                members.id = "clan-members";
                members.innerText = `${clan.members.length} members`;
                element.appendChild(members);
    
                this.client.polyfight_elements.clan_list.appendChild(element);
            }

            this.client.polyfight_elements.clan_create.innerText = "Create Clan";
            this.client.polyfight_elements.clan_create.style.backgroundColor = "#42F15C";
        }
        else
        {
            this.client.polyfight_elements.clan_modal_title.innerHTML = `Members <span style="color: #00FF00;">[${clan.name}]</span>`;
            this.client.polyfight_elements.clan_list.innerHTML = "";

            for (const member of clan.pending_members)
            {
                if (!this.clan_requests.includes(member.id) && this.client.entity.id == clan.owner)
                {
                    this.clan_requests.push(member.id);
                    this.add_notification({ message: `${member.name} has requested to join your clan.`, r: 255, g: 255, b: 0 });
                }

                const element = document.createElement("div");
                element.id = "clan-entry";
    
                const name = document.createElement("span");
                name.id = "clan-name";
                name.innerText = member.name;
                element.appendChild(name);

                if (member.id != this.client.entity.id && this.client.entity.id == clan.owner)
                {
                    const button = document.createElement("button");
                    button.id = "clan-join";
                    button.dataset.clan_id = clan.id.toString();
                    button.dataset.member_id = member.id.toString();
                    button.innerText = "Accept";
                    element.appendChild(button);

                    const button2 = document.createElement("button");
                    button2.id = "clan-join";
                    button2.dataset.clan_id = clan.id.toString();
                    button2.dataset.member_id = member.id.toString();
                    button2.innerText = "Decline";
                    button2.style.backgroundColor = "#F14242";
                    element.appendChild(button2);
                }

                const members = document.createElement("span");
                members.id = "clan-members";
                members.innerText = "Pending";
                element.appendChild(members);
    
                this.client.polyfight_elements.clan_list.appendChild(element);
            }

            for (const member of clan.members)
            {
                const element = document.createElement("div");
                element.id = "clan-entry";
    
                const name = document.createElement("span");
                name.id = "clan-name";
                name.innerText = member.name;
                element.appendChild(name);

                if (member.id != this.client.entity.id && this.client.entity.id == clan.owner)
                {
                    const button = document.createElement("button");
                    button.id = "clan-join";
                    button.dataset.clan_id = clan.id.toString();
                    button.dataset.member_id = member.id.toString();
                    button.innerText = "Kick";
                    button.style.backgroundColor = "#F14242";
                    element.appendChild(button);
                }

                const members = document.createElement("span");
                members.id = "clan-members";
                members.innerText = member.owner ? "Owner" : "Member";
                element.appendChild(members);
    
                this.client.polyfight_elements.clan_list.appendChild(element);
            }

            this.client.polyfight_elements.clan_create.innerText = "Leave Clan";
            this.client.polyfight_elements.clan_create.style.backgroundColor = "#F14242";
        }

        const clan_list = this.client.polyfight_elements.clan_list;
        const buttons = clan_list.querySelectorAll("#clan-join");

        buttons.forEach((button) =>
        {
            /** @ts-ignore */
            button.onclick = () =>
            {
                const clan_id = parseInt((button as HTMLButtonElement).dataset.clan_id!);
                const member_id = parseInt((button as HTMLButtonElement).dataset.member_id!);

                if (!clan)
                {
                    this.client.polyfight_connection.packet_handler.write_clan(1, clan_id);
                    button.id = "clan-pending";
                    button.innerHTML = "Pending...";
                    
                    let x;
                    if (x = this.clans.find(x => x.id == clan_id)) x.trying_to_join = true;
                }
                else if (button.innerHTML.includes("Accept"))
                {
                    this.clan_requests = this.clan_requests.filter(x => x != member_id);
                    this.client.polyfight_connection.packet_handler.write_clan(3, member_id, true);
                }
                else if (button.innerHTML.includes("Decline"))
                {
                    this.clan_requests = this.clan_requests.filter(x => x != member_id);
                    this.client.polyfight_connection.packet_handler.write_clan(3, member_id, false);
                }
                else if (button.innerHTML.includes("Kick"))
                {
                    this.client.polyfight_connection.packet_handler.write_clan(4, member_id);
                }
            };
        });
    };

    private render_notifications(timestamp: number): void
    {
        for (let i = 0; i < this.notifications.length; ++i)
        {
            const notification = this.notifications[i];

            notification.index = lerp(notification.index, 0.1, notification.target_index);
            notification.opacity = lerp(notification.opacity, 0.1, notification.target_opacity);

            if (fuzzy_equals(notification.opacity, 0))
            {
                this.notifications.splice(i, 1);
                continue;
            }

            if (notification.lifetime < (timestamp - notification.initial_time))
            {
                notification.target_opacity = 0;
            }

            const scale = Math.min(this.canvas.width / 1920, this.canvas.height / 1080);
            const screen_width = this.canvas.width / scale;
            const screen_height = this.canvas.height / scale;

            const y = 50 + (notification.index * 30) + (notification.index * 5);
            const x = screen_width / 2;

            this.context.save();

            this.context.scale(scale, scale);
            const font = window.getComputedStyle(document.body).getPropertyValue("--font");
            this.context.font = `18px ${font}`;
            const rect_width = this.context.measureText(notification.message).width + 50;

            this.context.fillStyle = `rgb(${notification.r}, ${notification.g}, ${notification.b})`;
            if (notification.opacity < 0.5) this.context.globalAlpha = notification.opacity;
            else this.context.globalAlpha = constrain(0, notification.opacity - 0.5, 1);

            this.context.fillRect(x - (rect_width / 2), y - 20, rect_width, 30);
            
            this.context.globalAlpha = notification.opacity;
            this.write_text(notification.message, x, y, 18, `rgb(255, 255, 255)`, 0, "#000000", true);

            this.context.restore();
        }
    }

    /** Renders a tank given its identity. */
    public render_tank(identity: EntityIdentity, radius: number, context: CanvasRenderingContext2D, respect_angle = true, initial_pos = new Vector(0, 0))
    {
        if (identity.name === "Spectator") return; 

        context.save();
        context.translate(initial_pos.x, initial_pos.y);

        const dominant: Array<Turret> = [];

        for (let i = 0; i < identity.turrets.length; ++i)
        {
            const turret = identity.turrets[i];

            if (turret.dominant)
            {
                dominant.push(turret);
                continue;
            }

            context.save();

            context.fillStyle = THEME_CONFIG.TURRET_FILL.css;
            context.strokeStyle = THEME_CONFIG.TURRET_STROKE.css;
            context.lineWidth = THEME_CONFIG.STROKE_SIZE * (radius / BASE_RADIUS);
            
            context.rotate(turret.angle + (respect_angle ? this.upgrade_tanks.angle : 0));
            context.translate((turret.y_offset || 0) * (radius / BASE_RADIUS), turret.x_offset * (radius / BASE_RADIUS));

            const length = turret.length * (radius / BASE_RADIUS);
            const width = turret.width * (radius / BASE_RADIUS);

            if (turret.trapezoidal)
            {
                let reversed = (turret as { trapezoid_reverse?: boolean }).trapezoid_reverse;

                const height = length;
                const bottom_width = reversed ? width * 2 : width;
                const top_width = reversed ? width : width * 2;

                context.save();
                context.rotate((turret as { trapezoid_dir?: number }).trapezoid_dir || 0);

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
    
                context.rotate(-(respect_angle ? this.upgrade_tanks.angle : 0));
    
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
                // context.rotate(turret.angle);

                context.fillRect(0, -width / 2, length, width);
                context.strokeRect(0, -width / 2, length, width);
            }

            context.restore();
        };

        if (identity.rotators != undefined)
        {
            for (let i = 0; i < identity.rotators.length; ++i)
            {
                const rotator = identity.rotators[i];

                context.save();

                context.fillStyle = THEME_CONFIG.SMASHER_FILL.css;
                context.strokeStyle = THEME_CONFIG.SMASHER_STROKE.css;
                context.lineWidth = THEME_CONFIG.STROKE_SIZE * (radius / BASE_RADIUS);

                context.rotate(rotator.angle);
                
                const r = (rotator.size * radius);
                const sides = rotator.sides;

                context.beginPath();
                
                context.moveTo(r, 0);

                for (let j = 0; j < sides; j++)
                {
                    const angle = TAU * j / sides;
                    const x = r * Math.cos(angle);
                    const y = r * Math.sin(angle);
                    context.lineTo(x, y);
                };

                context.closePath();

                context.fill();
                context.stroke();

                context.restore();
            };
        };

        context.fillStyle = THEME_CONFIG.PLAYER_FILL.css;
        context.strokeStyle = THEME_CONFIG.PLAYER_STROKE.css;
        context.lineWidth = THEME_CONFIG.STROKE_SIZE * (radius / BASE_RADIUS);

        if (identity.square)
        {
            context.save();
            context.fillRect(-radius, -radius, radius * 2, radius * 2);
            context.strokeRect(-radius, -radius, radius * 2, radius * 2);
            context.restore();
        }
        else
        {
            switch (TANK_DEFS.indexOf(identity))
            {
                case EntityIdentityIds.Square:
                {
                    context.save();
                    context.fillStyle = THEME_CONFIG.SQUARE_FILL.css;
                    context.strokeStyle = THEME_CONFIG.SQUARE_STROKE.css;

                    context.beginPath();
                    context.rect(-radius, -radius, radius * 2, radius * 2);
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
                    context.moveTo(0, -radius * 1.3);
                    context.lineTo(radius * 1.3 * 0.8660254037844387, radius * 1.3 * 0.5);
                    context.lineTo(-radius * 1.3 * 0.8660254037844387, radius * 1.3 * 0.5);
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
                    context.moveTo(0, -radius * 1.3);
                    context.lineTo(radius * 1.3 * 0.8660254037844387, radius * 1.3 * 0.5);
                    context.lineTo(-radius * 1.3 * 0.8660254037844387, radius * 1.3 * 0.5);
                    context.closePath();
                    context.fill();
                    context.stroke();

                    context.restore();
                    break;
                };

                case EntityIdentityIds.LargeCrasher:
                {
                    radius *= 1.25;

                    context.save();
                    context.fillStyle = THEME_CONFIG.CRASHER_FILL.css;
                    context.strokeStyle = THEME_CONFIG.CRASHER_STROKE.css;

                    context.beginPath();
                    context.moveTo(0, -radius * 1.3);
                    context.lineTo(radius * 1.3 * 0.8660254037844387, radius * 1.3 * 0.5);
                    context.lineTo(-radius * 1.3 * 0.8660254037844387, radius * 1.3 * 0.5);
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
                    context.moveTo(0, -radius);
                    context.lineTo(radius * 0.9510565162951535, -radius * 0.30901699437494745);
                    context.lineTo(radius * 0.5877852522924731, radius * 0.8090169943749473);
                    context.lineTo(-radius * 0.587785252292473, radius * 0.8090169943749475);
                    context.lineTo(-radius * 0.9510565162951536, -radius * 0.30901699437494734);
                    context.closePath();
                    context.fill();
                    context.stroke();

                    context.restore();
                    break;
                };

                case EntityIdentityIds.AlphaPentagon:
                {
                    radius *= 2.5;
                    
                    context.save();
                    context.fillStyle = THEME_CONFIG.PENTAGON_FILL.css;
                    context.strokeStyle = THEME_CONFIG.PENTAGON_STROKE.css;

                    context.beginPath();
                    context.moveTo(0, -radius);
                    context.lineTo(radius * 0.9510565162951535, -radius * 0.30901699437494745);
                    context.lineTo(radius * 0.5877852522924731, radius * 0.8090169943749473);
                    context.lineTo(-radius * 0.587785252292473, radius * 0.8090169943749475);
                    context.lineTo(-radius * 0.9510565162951536, -radius * 0.30901699437494734);
                    context.closePath();
                    context.fill();
                    context.stroke();

                    context.restore();
                    break;
                };

                default:
                {
                    context.beginPath();
                    context.arc(0, 0, radius, 0, TAU);
                    context.fill();
                    context.stroke();
                    break;
                }
            }
        }

        for (const turret of dominant)
        {
            context.save();

            context.fillStyle = THEME_CONFIG.TURRET_FILL.css;
            context.strokeStyle = THEME_CONFIG.TURRET_STROKE.css;

            context.rotate(turret.angle);
            context.translate((turret.y_offset || 0) * (radius / BASE_RADIUS), turret.x_offset * (radius / BASE_RADIUS));

            const length = turret.length * (radius / BASE_RADIUS);
            const width = turret.width * (radius / BASE_RADIUS);

            if (turret.trapezoidal)
            {
                let reversed = (turret as { trapezoid_reverse?: boolean }).trapezoid_reverse;

                const height = length;
                const bottom_width = reversed ? width * 2 : width;
                const top_width = reversed ? width : width * 2;

                context.save();
                // context.rotate(turret.angle);
                // context.translate((turret.y_offset || 0) * (radius / BASE_RADIUS), turret.x_offset * (radius / BASE_RADIUS));

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

                // context.translate((turret.y_offset || 0) * (radius / BASE_RADIUS), turret.x_offset * (radius / BASE_RADIUS));;
                // context.rotate(turret.angle);
    
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
                // context.translate((turret.y_offset || 0) * (radius / BASE_RADIUS), turret.x_offset * (radius / BASE_RADIUS));
                // context.rotate(turret.angle);

                context.fillRect(0, -width / 2, length, width);
                context.strokeRect(0, -width / 2, length, width);
            }

            context.restore();
        }
        
        context.restore();
    }

    private render_death(timestamp: number, delta_average: number): void
    {
        const delta_tick = constrain(0, delta_average / 16.66, 1);
        this.render_game(timestamp, delta_average, true, true);

        // const scale = Math.min(this.canvas.width / 1920, this.canvas.height / 1080);
        const scale = window.devicePixelRatio;
        const screen_width = this.canvas.width / scale;
        const screen_height = this.canvas.height / scale;

        this.context.save();
        this.context.scale(scale, scale);

        this.context.globalAlpha = 1 - this.lerp_screen_opacity(delta_tick);
        this.context.fillStyle = "#000000";
        this.context.fillRect(0, 0, screen_width, screen_height);

        this.context.globalAlpha = 1;

        if (this.client.entity.dying_phase != DyingPhase.Dead) return this.context.restore();

        // this.write_text(`Your Spammer ELO:`, screen_width / 2 - 120, screen_height / 2 - 200, 24, "#FFFFFF", 3, "#000000", true);
        // this.write_text(`Opponent's Drone ELO:`, screen_width / 2 - 140, screen_height / 2 - 170, 24, "#FFFFFF", 3, "#000000", true);

        if (!this.client.entity.killer_name)
            this.client.entity.killer_name = this.client.entity.surroundings.find(e => this.client.entity.killer == e.id)?.name || "";

        this.write_text(`You were killed by:`, screen_width / 2, screen_height / 2 - 100, 24, "#FFFFFF", 4, "#000000", true);
        this.write_text(`${this.client.entity.killer_name || "Unknown"}`, screen_width / 2, screen_height / 2 - 60, 36, "#FFFFFF", 4, "#000000", true);

        // this.write_text(`-> Score: ${this.client.entity.score.toFixed(0)}`, screen_width / 2 - 100, screen_height / 2 - 20, 16, "#FFFFFF", 2, "#000000", true);
        // this.write_text(`-> Time Alive: ${this.client.entity.time_alive}`, screen_width / 2 - 100, screen_height / 2 - 10, 16, "#FFFFFF", 2, "#000000", true);
        this.write_text(`Score:`, screen_width / 2 - 100, screen_height / 2 - 10, 24, "#FFFFFF", 3, "#000000", true);
        this.write_text(`Kills:`, screen_width / 2 - 90, screen_height / 2 + 20, 24, "#FFFFFF", 3, "#000000", true);
        this.write_text(`Time Alive:`, screen_width / 2 - 125, screen_height / 2 + 50, 24, "#FFFFFF", 3, "#000000", true);

        let ranked = this.client.polyfight_connection.is_ranked;
        if (ranked)
        {
            this.write_text("Your ELO:", screen_width / 2 - 120, screen_height / 2 + 100, 24, "#FFFFFF", 3, "#000000", true);
            this.write_text("Opponent ELO:", screen_width / 2 - 150, screen_height / 2 + 130, 24, "#FFFFFF", 3, "#000000", true);
        }

        const time_offset = this.client.entity.time_alive.includes("h") ? 10 : (this.client.entity.time_alive.includes("m") ? 5 : 0);
        this.write_text(`${commaify(parseInt(this.client.entity.score.toFixed(0)))}`, screen_width / 2, screen_height / 2 - 10, 24, "#FFFFFF", 3, "#000000", true);
        this.write_text(`${this.client.entity.kills}`, screen_width / 2, screen_height / 2 + 20, 24, "#FFFFFF", 3, "#000000", true);
        this.write_text(`${this.client.entity.time_alive}`, screen_width / 2 + time_offset, screen_height / 2 + 50, 24, "#FFFFFF", 3, "#000000", true);

        if (ranked)
        {
            const [[self_old, self_new], [opp_old, opp_new]] = this.client.polyfight_connection.elo_changes.map(x => x.map(x => Math.round(x)));
            const self = self_new - self_old;
            const opp = opp_new - opp_old;
            
            // this.write_text(`${self > 0 ? "+" : ""}${self}`, screen_width / 2 - 5, screen_height / 2 + 100, 24, self > 0 ? "#22FF00" : "#E60B25", 3, "#000000", true);
            // this.write_text(`${other > 0 ? "+" : ""}${other}`, screen_width / 2 - 5, screen_height / 2 + 130, 24, other > 0 ? "#22FF00" : "#E60B25", 3, "#000000", true);

            const {width} = this.write_text(`${self_new} = ${self_old}`, screen_width / 2 - 30, screen_height / 2 + 100, 24, "#FFFFFF", 3, "#000000", true, this.context, "left");
            this.write_text(` ${self > 0 ? "+" : "-"} ${self.toString().replace("-", "")}`, screen_width / 2 - 30 + width, screen_height / 2 + 100, 24, self > 0 ? "#22FF00" : "#E60B25", 3, "#000000", true, this.context, "left");

            const {width: width2} = this.write_text(`${opp_new} = ${opp_old}`, screen_width / 2 - 30, screen_height / 2 + 130, 24, "#FFFFFF", 3, "#000000", true, this.context, "left");
            this.write_text(` ${opp > 0 ? "+" : "-"} ${opp.toString().replace("-", "")}`, screen_width / 2 - 30 + width2, screen_height / 2 + 130, 24, opp > 0 ? "#22FF00" : "#E60B25", 3, "#000000", true, this.context, "left");

            this.write_text("(press enter to respawn)", screen_width / 2, screen_height / 2 + 210, 10, "#FFFFFF", 2, "#000000", true);
        }
        else
        {
            this.write_text("(press enter to respawn)", screen_width / 2, screen_height / 2 + 100, 10, "#FFFFFF", 2, "#000000", true);
        }

        this.context.save();

        const respawn_button = this.death_buttons[1];
        this.context.fillStyle = Colour.from_hex("03fc30").blend_with(respawn_button?.hovered ? 0.25 : (respawn_button?.clicked ? 0.1 : 0), Colour.BLACK).css;
        this.context.strokeStyle = Colour.blend_colours(Colour.from_hex("03fc30"), Colour.BLACK, THEME_CONFIG.STROKE_INTENSITY).css;
        this.context.lineWidth = 2;
        this.context.beginPath();
        this.context.roundRect(screen_width / 2 - 50, screen_height / 2 + 150, 100, 50, 5);
        this.context.fill();
        this.context.stroke();
        this.write_text("Spawn", screen_width / 2 - 0, screen_height / 2 + 182, 24, "#FFFFFF", 3, "#000000", true);

        this.death_buttons[1] = {
            x: (screen_width / 2 - 50),
            y: (screen_height / 2 + 150),
            width: 100,
            height: 50,
            hovered: respawn_button?.hovered,
            clicked: respawn_button?.clicked,
            disabled: false,
            click: () => {
                this.client.entity.dying_phase = DyingPhase.None;
                this.client.polyfight_elements.container.classList.add("show");
                this.minimap_canvas.style.display = "none";
                this.death_buttons = [];
            },
        };

        if (this.client.polyfight_connection.is_host)
        {
            const kick_button = this.death_buttons[0];
            const ban_button = this.death_buttons[2];

            this.context.fillStyle = Colour.from_hex("f5d442").blend_with(kick_button?.hovered ? 0.25 : (kick_button?.clicked ? 0.1 : 0), Colour.BLACK).css;
            this.context.strokeStyle = Colour.blend_colours(Colour.from_hex("f5d442"), Colour.BLACK, THEME_CONFIG.STROKE_INTENSITY).css;
            this.context.lineWidth = 2;
            this.context.beginPath();
            this.context.roundRect(screen_width / 2 - 200, screen_height / 2 + 150, 100, 50, 5);
            this.context.fill();
            this.context.stroke();
            this.write_text("Kick", screen_width / 2 - 150, screen_height / 2 + 182, 24, "#FFFFFF", 3, "#000000", true);

            this.context.fillStyle = Colour.from_hex("f54242").blend_with(ban_button?.hovered ? 0.25 : (ban_button?.clicked ? 0.1 : 0), Colour.BLACK).css;
            this.context.strokeStyle = Colour.blend_colours(Colour.from_hex("f54242"), Colour.BLACK, THEME_CONFIG.STROKE_INTENSITY).css;
            this.context.lineWidth = 2;
            this.context.beginPath();
            this.context.roundRect(screen_width / 2 + 100, screen_height / 2 + 150, 100, 50, 5);
            this.context.fill();
            this.context.stroke();
            this.write_text("Ban", screen_width / 2 + 150, screen_height / 2 + 182, 24, "#FFFFFF", 3, "#000000", true);

            this.death_buttons[0] = {
                x: (screen_width / 2 - 200),
                y: (screen_height / 2 + 150),
                width: 100,
                height: 50,
                hovered: kick_button?.hovered,
                clicked: kick_button?.clicked,
                disabled: false,
                click: () => {
                    this.client.polyfight_connection.packet_handler.write_chat(`/kick ${this.client.entity.killer}`);
                },
            }

            this.death_buttons[2] = {
                x: (screen_width / 2 + 100),
                y: (screen_height / 2 + 150),
                width: 100,
                height: 50,
                hovered: ban_button?.hovered,
                clicked: ban_button?.clicked,
                disabled: false,
                click: () => {
                    this.client.polyfight_connection.packet_handler.write_chat(`/ban ${this.client.entity.killer}`);
                },
            }
        }

        this.context.restore();
        this.context.restore();
    };

    private render_upgrade_stats(dt: number)
    {
        while (this.stats.preloaded_stats.length && this.stats.available_stat_points != 0)
        {
            this.client.polyfight_connection.packet_handler.write_stat(this.stats.preloaded_stats.shift()!);
            this.stats.available_stat_points--;
        };

        if (this.stats.available_stat_points > 0 || ["KeyU", "KeyM"].includes(this.client.polyfight_elements.key_held)) this.stats.target_opacity = 0;
        if (this.client.entity.dying_phase != DyingPhase.Alive)
        {
            this.stats.target_opacity = 0;
            this.stats_buttons.forEach(button => {
                if (button) button.disabled = true;
            });
        }

        this.stats_context.save();

        const scale = Math.min(this.stats_canvas.width / 350, this.stats_canvas.height / 350);
        const stats_canvas_width = this.stats_canvas.width / scale;
        const stats_canvas_height = this.stats_canvas.height / scale;

        const scalar = (this.is_mobile ? 1 : 1.2);
        /** @ts-ignore */
        this.stats_context.scale(scale * scalar, scale * scalar);

        const opacity = this.lerp_stats_opacity(dt);
        this.stats_context.globalAlpha = 1 - opacity;

        if (this.is_mobile) {
            this.stats_context.fillStyle = "rgba(0, 0, 0, 0.5)";

            this.stats_context.beginPath();
            this.stats_context.roundRect(0, 0, stats_canvas_width, stats_canvas_height, 5);
            this.stats_context.fill();
    
            const stats = this.stats.stats_value.map((x, i) => ({ stat_value: x, real_idx: i })).filter((x, i) => this.stats.max_stats_value[i] != 0);
            const max_stats = this.stats.max_stats_value.filter(x => x != 0);
    
            for (let i = 0; i < stats.length; ++i)
            {
                const real_stat_idx = stats[i].real_idx;
    
                const stat = stats[i].stat_value;
                const max_stat = max_stats[i];
                const stat_color = THEME_CONFIG.UPGRADES[real_stat_idx % UpgradeStats.Sentinel];
                const button = this.stats_buttons[real_stat_idx];
    
                let name = UpgradeStats[real_stat_idx].replace(/([A-Z])/g, ' $1').trim();
                if (name == "Projectile Reload" && this.client.entity.identity_id == EntityIdentityIds.Necromancer)
                    name = "Drone Count";
                if (name == "Fov") name = "Field of View";
    
                // draw small box with stat name
                this.stats_context.fillStyle = stat_color.css;
                this.stats_context.strokeStyle = Colour.blend_colours(stat_color, Colour.BLACK, THEME_CONFIG.STROKE_INTENSITY).css;
                this.stats_context.lineWidth = 2;
    
                if (button?.disabled) {
                    this.stats_context.fillStyle = stat_color.clone().grayscale().css;
                    this.stats_context.strokeStyle = Colour.blend_colours(stat_color, Colour.BLACK, THEME_CONFIG.STROKE_INTENSITY).grayscale().css;
                }
    
                this.stats_context.beginPath();
                
                const width = 100;
                const height = 75;
                /** @ts-ignore */
                const box_x_dist = window.m;
    
                const positionsPerRow = 3;
                const row = Math.floor(i / positionsPerRow);
                const column = i % positionsPerRow;

                const x = 20 + (105 * column);
                /** @ts-ignore */
                const y = 20 + (120 * row);
    
                this.stats_context.save();
                this.stats_context.globalAlpha = button?.clicked ? 0.5 : (button?.hovered ? 0.6 : 0.8);
                this.stats_context.roundRect(x, y, width, height, 5);
                this.stats_context.restore();
    
                this.stats_context.fill();
                this.stats_context.stroke();
    
                this.stats_context.miterLimit = 2;
                this.stats_context.font = `bold 14px ${window.getComputedStyle(document.body).getPropertyValue("--font")}`;
                const words = name.split(" ");
                const lines = [];
                let currentLine = words[0];
                for (let i = 1; i < words.length; i++) {
                    const word = words[i];
                    const w = this.stats_context.measureText(currentLine + " " + word).width;
                    if (w < width) {
                        currentLine += " " + word;
                    } else {
                        lines.push(currentLine);
                        currentLine = word;
                    }
                }
                lines.push(currentLine);      
    
                for (let i = 0; i < lines.length; i++)
                {
                    this.stats_context.fillStyle = "#FFFFFF";
                    /** @ts-ignore */
                    this.write_text(lines[i], x + width / 2, y + 20 + (i * 12), 14, "#FFFFFF", 3, "#000000", true, this.stats_context);
                }
    
                this.write_text(`[${real_stat_idx + 1}]`, x + width / 2, y + 50, 14, "#FFFFFF", 3, "#000000", true, this.stats_context);
    
                const stat_width = (width / max_stat);
                const stat_height = 10;
    
                for (let j = 0; j < max_stat; ++j) {
                    this.stats_context.fillStyle = j < stat ? stat_color.css : "#FFFFFF";
                    this.stats_context.lineWidth = 2;
    
                    this.stats_context.beginPath();
                    this.stats_context.roundRect(x + (j * stat_width), y + 65, stat_width - 2, stat_height, 2);
                    this.stats_context.closePath();
                    this.stats_context.fill();
                    this.stats_context.stroke();
                };
    
                this.stats_buttons[real_stat_idx] = {
                    x: x * parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue("--ui-scale")),
                    y: y * parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue("--ui-scale")),
                    width: width * parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue("--ui-scale")),
                    height: height * parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue("--ui-scale")),
                    click: () =>
                    {
                        this.client.polyfight_connection.packet_handler.write_stat(real_stat_idx);
                    },
                    clicked: button?.clicked || false, 
                    hovered: button?.hovered || false, 
                    disabled: button?.disabled == undefined ? (stat == max_stat || this.stats.available_stat_points == 0) : button.disabled
                };
            }

            this.stats_context.save();
            if (this.stats.available_stat_points != 0)
                /** @ts-ignore */
                this.write_text(`x${this.stats.available_stat_points}`, stats_canvas_width - 20, stats_canvas_height - 325, 18, "#FFFFFF", 4, "#000000", false, this.stats_context);
            this.stats_context.restore();
        } else {
            /** @ts-ignore */
            this.stats_context.translate(-160, -35);
    
            // translate based on the highest stat
            /** @ts-ignore */
            this.stats_context.translate(220, 0);
            
            const y = stats_canvas_height - 20 - (30) * UpgradeStats.Sentinel;
    
            this.stats_context.fillStyle = "rgba(0, 0, 0, 0.5)";
    
            let maximum_width = this.stats.upgrade_width * (this.stats.max_stats_value.reduce((a, b) => a > b ? a : b) + 1);
    
            this.stats_context.beginPath();
            this.stats_context.roundRect(10, y - 5, maximum_width + 40, UpgradeStats.Sentinel * (25 + 3) + 10, 5);
            this.stats_context.fill();
    
            for (let i = 0; i < UpgradeStats.Sentinel; ++i)
            {
                this.stats_context.save();
                const stat = this.stats.stats_value[i];
                const max_stat = this.stats.max_stats_value[i];
                const stat_color = THEME_CONFIG.UPGRADES[i % UpgradeStats.Sentinel];
                const button = this.stats_buttons[i];
                const STAT_WIDTH = this.stats.upgrade_width * (max_stat + 1);
                const STAT_HEIGHT = 25;
                const POSITION = UpgradeStats.Sentinel - i - 1;
    
                if (max_stat == 0 && button)
                {
                    button.disabled = true;
                    continue;
                }
    
                // Render the background bar.
                this.stats_context.save();
                this.stats_context.strokeStyle = THEME_CONFIG.UPGRADES_BACKGROUND.css;
                this.stats_context.globalAlpha = (1 - opacity) * 0.2;
                this.stats_context.lineCap = "round";
                this.stats_context.lineWidth = STAT_HEIGHT;
                this.stats_context.beginPath();
                this.stats_context.moveTo(30, stats_canvas_height - 50 - (STAT_HEIGHT + 3) * POSITION);
                this.stats_context.lineTo(30 + STAT_WIDTH, stats_canvas_height - 50 - (STAT_HEIGHT + 3) * POSITION);
                this.stats_context.stroke();
                this.stats_context.restore();
    
                // Render the actual stat values.
                const preloaded = this.stats.preloaded_stats.filter(x => x == i).length;
                for (let i = 0; i < stat + preloaded; ++i)
                {
                    this.stats_context.save();
    
                    this.stats_context.globalAlpha = (i >= stat ? 0.5 : 1) * (1 - opacity);
                    
                    if (i == 0 || i == max_stat - 1)
                    {
                        const radius = STAT_HEIGHT / 2;
                        const x = i == 0 ? 15 : 25 + (STAT_WIDTH / max_stat) * i;
                        const y = stats_canvas_height - 50 - (STAT_HEIGHT + 3) * POSITION - 12;
                        const width = i == 0 ? STAT_WIDTH / max_stat + 10 : STAT_WIDTH / max_stat + 5;
                        const height = STAT_HEIGHT;
    
                        this.stats_context.save();
                        this.stats_context.fillStyle = stat_color.css;
                        this.stats_context.strokeStyle = stat_color.clone().blend_with(0.5, Colour.BLACK).css;
                        this.stats_context.lineWidth = 2;
                        this.stats_context.beginPath();
                        
                        if (i == 0)
                        {
                            this.stats_context.moveTo(x, y + radius);
                            this.stats_context.arcTo(x, y, x + width, y, radius);
                            this.stats_context.lineTo(x + width, y);
                            this.stats_context.lineTo(x + width, y + height);
                            this.stats_context.lineTo(x + radius, y + height);
                            this.stats_context.arcTo(x, y + height, x, y, radius);
                        }
                        else if (i == max_stat - 1)
                        {
                            this.stats_context.moveTo(x + width, y);
                            this.stats_context.arcTo(x + width + radius, y, x + width + radius, y + radius, radius);
                            this.stats_context.lineTo(x + width + radius, y + height - radius);
                            this.stats_context.arcTo(x + width + radius, y + height, x + width, y + height, radius);
                            this.stats_context.lineTo(x, y + height);
                            this.stats_context.lineTo(x, y);
                        }
    
                        this.stats_context.closePath();
                        this.stats_context.fill();
                        this.stats_context.stroke();
    
                        this.stats_context.restore();
                    }
                    else
                    {
                        const x = 25 + (STAT_WIDTH / max_stat) * i;
                        const y = stats_canvas_height - 50 - (STAT_HEIGHT + 3) * POSITION - 12;
                        const width = STAT_WIDTH / max_stat;
                        const height = STAT_HEIGHT;
        
                        // draw rect
                        this.stats_context.save();
                        this.stats_context.fillStyle = stat_color.css; // i > stat means its preloaded.
                        this.stats_context.strokeStyle = stat_color.clone().blend_with(0.5, Colour.BLACK).css;
                        this.stats_context.lineWidth = 2;
                        this.stats_context.fillRect(x, y, width, height);
                        this.stats_context.strokeRect(x, y, width, height);
                        this.stats_context.restore();
                    }
    
                    this.stats_context.restore();
                }
    
                // Render the "add stat" button.
                this.stats_context.save();
                if (button?.disabled)
                {
                    this.stats_context.fillStyle = "#9D9D9D";
                    this.stats_context.strokeStyle = "#000000";
                }
                else
                {
                    this.stats_context.fillStyle = stat_color.clone().blend_with(button?.clicked ? 0.25 : (button?.hovered ? 0.1 : 0), Colour.BLACK).css;
                    this.stats_context.strokeStyle = stat_color.clone().blend_with(0.5, Colour.BLACK).css;
                }
    
                this.stats_context.lineWidth = 1.25;
    
                const radius = 12;
                const x = STAT_WIDTH + 60;
                const y = stats_canvas_height - 50 - (STAT_HEIGHT + 3) * POSITION - 18;
    
                this.stats_context.beginPath();
                this.stats_context.arc(radius - 20, y + 16, radius, 0, TAU);
                this.stats_context.fill();
                this.stats_context.stroke();
    
                this.write_text(`[${i + 1}]`, radius - 50, y + 21, 14, "#FFFFFF", 3, "#000000", true, this.stats_context);
    
                const ui_scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ui-scale"));
                this.stats_buttons[i] =
                {
                    /** @ts-ignore */
                    x: (47) * ui_scale, y: (y - 25 - (-5.5 * i)) * ui_scale, 
                    width: radius * ui_scale * 2 * scalar, height: radius * ui_scale * 2 * scalar,
                    clicked: button?.clicked || false, 
                    hovered: button?.hovered || false, 
                    click: button?.click || (() => 
                    { 
                        this.client.polyfight_connection.packet_handler.write_stat(i); 
                    }).bind(this), 
                    disabled: button?.disabled == undefined ? (stat == max_stat || this.stats.available_stat_points == 0) : button.disabled
                };
    
                this.stats_context.restore();
    
                let name = UpgradeStats[i].replace(/([A-Z])/g, ' $1').trim();
                if (name == "Projectile Reload" && this.client.entity.identity_id == EntityIdentityIds.Necromancer)
                    name = "Drone Count";
                if (name == "Fov") name = "Field of View";
    
                this.write_text("+", radius - 20, y + 22, 18, "#FFFFFF", 3, "#000000", true, this.stats_context);
                this.write_text(name, 20 + STAT_WIDTH, stats_canvas_height - 46 - (STAT_HEIGHT + 3) * POSITION, 14, "#FFFFFF", 3, "#000000", false, this.stats_context, "right");
                this.write_text(stat as unknown as string, 30, stats_canvas_height - 46 - (STAT_HEIGHT + 3) * POSITION, 14, "#FFFFFF", 3, "#000000", false, this.stats_context, "left");
            }

            if (this.stats.available_stat_points != 0)
                /** @ts-ignore */
                this.write_text(`x${this.stats.available_stat_points}`, stats_canvas_width - 140, stats_canvas_height - 300, 18, "#FFFFFF", 4, "#000000", false, this.stats_context);
        }

        this.stats_context.restore();
        
        // for (let i = 0; i < this.stats_buttons.length; ++i) {
        //     this.client.polyfight_canvas.stats_context.save();

        //     // reset canvas transform
        //     this.client.polyfight_canvas.stats_context.setTransform(1, 0, 0, 1, 0, 0);

        //     this.client.polyfight_canvas.stats_context.fillStyle = "#F00";
        //     this.client.polyfight_canvas.stats_context.beginPath();
        //     this.client.polyfight_canvas.stats_context.arc(this.stats_buttons[i].x + this.stats_buttons[i].width / 2, this.stats_buttons[i].y + this.stats_buttons[i].height / 2, 12, 0, Math.PI * 2);
        //     this.client.polyfight_canvas.stats_context.fill();
        //     this.client.polyfight_canvas.stats_context.restore();
        // }
    }

    private render_scoreboard(dt: number)
    {
        this.scoreboard_context.save();

        const scale = Math.min(this.scoreboard_canvas.width / 300, this.scoreboard_canvas.height / 350);
        const scoreboard_canvas_width = this.scoreboard_canvas.width / scale;
        const scoreboard_canvas_height = this.scoreboard_canvas.height / scale;

        this.scoreboard_context.scale(scale, scale);

        let height = 50 + (25 * this.scoreboard.length) + 30;
        this.scoreboard_context.fillStyle = "rgba(0, 0, 0, 0.4)";

        this.scoreboard_context.beginPath();
        this.scoreboard_context.roundRect(0, 0, 300, height, 5);
        this.scoreboard_context.fill();
        //     background: rgba(0, 0, 0, 0.4);
    // border-radius: 5px;

        this.write_text("Leaderboard", scoreboard_canvas_width / 2, 30, 25, "#FFFFFF", 5, "#000000", true, this.scoreboard_context);

        for (let i = 0; i < this.scoreboard.length; ++i)
        {
            const player = this.scoreboard[i];
            const y = 50 + (25 * i);

            const score_width = 250; const score_height = 20;
            const true_width = Math.max(score_width - score_height, 1);
            const offset = -true_width / 2;
            
            this.scoreboard_context.save();
            this.scoreboard_context.translate(scoreboard_canvas_width / 2, y);

            /** Render the background of the xp bar. */
            this.scoreboard_context.lineCap = "round";
            this.scoreboard_context.lineWidth = score_height;
            this.scoreboard_context.strokeStyle = THEME_CONFIG.SCORE_BAR_BACKGROUND.css;
            this.scoreboard_context.beginPath();
            this.scoreboard_context.moveTo(offset + 0.5, 0.5);
            this.scoreboard_context.lineTo(offset + 0.5 + true_width, 0.5);
            this.scoreboard_context.stroke();

            /** Render the foreground of the score bar. */
            this.scoreboard_context.lineWidth = score_height * 0.75;
            this.scoreboard_context.strokeStyle = THEME_CONFIG.SCORE_BAR_FILL.css;
            this.scoreboard_context.beginPath();
            this.scoreboard_context.moveTo(offset + 0.5, 0.5);
            this.scoreboard_context.lineTo(offset + 0.5 + true_width * (player.score / this.scoreboard[0].score), 0.5);
            this.scoreboard_context.stroke();

            this.scoreboard_context.translate(offset, 0);
            this.render_tank(TANK_DEFS[player.identity], 10, this.scoreboard_context, false);

            this.scoreboard_context.restore();

            this.write_text(`${player.name} — ${prettify(player.score)}`, scoreboard_canvas_width / 2, y + 5, 14, "#FFFFFF", 3, "#000000", true, this.scoreboard_context);
        }

        // write at bottom of scoreboard
        // this.write_text(`${this.player_count.server} Players / ${this.player_count.global} Total`, scoreboard_canvas_width / 2, scoreboard_canvas_height - 40 - (25 * (10 - this.scoreboard.length)), 14, "#FFFFFF", 3, "#000000", true, this.scoreboard_context);
        this.write_text(`${this.player_count.server} Players`, scoreboard_canvas_width / 2, scoreboard_canvas_height - 40 - (25 * (10 - this.scoreboard.length)), 14, "#FFFFFF", 3, "#000000", true, this.scoreboard_context);

        this.scoreboard_context.restore();
    }

    private render_score(dt: number)
    {
        let clan_name = this.client.entity.clan_info?.name;

        this.score_context.save();

        const scale = Math.min(this.score_canvas.width / 500, this.score_canvas.height / 200);
        const score_canvas_width = this.score_canvas.width / scale;
        const score_canvas_height = this.score_canvas.height / scale;

        const card_width = 350;
        const card_height = 110;

        this.score_context.scale(scale, scale);
        this.score_context.fillStyle = "rgba(0, 0, 0, 0.4)";

        this.score_context.beginPath();
        this.score_context.roundRect(25, 70, card_width, card_height, 5);
        this.score_context.fill();

        const metric = this.write_text(this.client.entity.name, 40, score_canvas_height - 95, 24, "#FFFFFF", 4, "#000000", false, this.score_context, "left");
        this.write_text(`[${clan_name || "No Clan"}]`, 40 + metric.width + 10, score_canvas_height - 95, 24, THEME_CONFIG.CLAN_FILL.css, 4, "#000000", false, this.score_context, "left");
        
        const score_width = 224; const score_height = 20;
        const true_width = Math.max(score_width - score_height, 1);
        const offset = -true_width / 2;

        this.score_context.save();
        this.score_context.translate(150, score_canvas_height - 65);

        /** Render the background of the xp bar. */
        this.score_context.lineCap = "round";
        this.score_context.lineWidth = score_height;
        this.score_context.strokeStyle = THEME_CONFIG.SCORE_BAR_BACKGROUND.css;
        this.score_context.beginPath();
        this.score_context.moveTo(offset + 0.5, 0.5);
        this.score_context.lineTo(offset + 0.5 + true_width, 0.5);
        this.score_context.stroke();

        /** Render the foreground of the xp bar. */
        this.score_context.lineWidth = score_height * 0.75;
        this.score_context.strokeStyle = THEME_CONFIG.SCORE_BAR_FILL.css;
        this.score_context.beginPath();
        this.score_context.moveTo(offset + 0.5, 0.5);
        this.score_context.lineTo(offset + 0.5 + true_width, 0.5);
        this.score_context.stroke();
        this.score_context.restore();

        this.write_text(`Score: ${commaify(parseInt(this.client.entity.lerp_score(dt).toFixed(0)))}`, 50, score_canvas_height - 60, 14, "#FFFFFF", 3, "#000000", false, this.score_context, "left");
        /**@ts-ignore */
        this.write_text(`Kills: ${this.client.entity.kills}`, 200 + 25 + offset + true_width, score_canvas_height - 60, 14, "#FFFFFF", 3, "#000000", false, this.score_context, "right");

        const xp_width = 324; const xp_height = 20;
        const true_width_xp = Math.max(xp_width - xp_height, 1);
        const offset_xp = -true_width_xp / 2;

        this.score_context.save();
        this.score_context.translate(200, score_canvas_height - 40);

        /** Render the background of the score bar. */
        this.score_context.lineCap = "round";
        this.score_context.lineWidth = xp_height;
        this.score_context.strokeStyle = THEME_CONFIG.XP_BAR_BACKGROUND.css;
        this.score_context.beginPath();
        this.score_context.moveTo(offset_xp + 0.5, 0.5);
        this.score_context.lineTo(offset_xp + 0.5 + true_width_xp, 0.5);
        this.score_context.stroke();

        /** Render the foreground of the score bar. */
        let percentage = this.client.entity.level >= LEVEL_TO_SCORE_TABLE.length ? 
            0.94 : constrain(0, this.client.entity.lerp_level_bar(dt), 0.94);
        this.score_context.lineWidth = xp_height * 0.75;
        this.score_context.strokeStyle = THEME_CONFIG.XP_BAR_FILL.css;
        this.score_context.beginPath();
        this.score_context.moveTo(offset_xp + 0.5, 0.5);
        this.score_context.lineTo(offset_xp + 0.5 + xp_width * percentage, 0.5);
        this.score_context.stroke();
        this.score_context.restore();
        
        this.write_text(`Level ${this.client.entity.level} ${this.client.entity.identity.name}`, 50, score_canvas_height - 35, 14, "#FFFFFF", 3, "#000000", false, this.score_context, "left");
        
        this.score_context.restore();
    }

    private render_upgrade_tanks(dt: number)
    {
        const scale = Math.min(this.upgrade_tanks_canvas.width / 300, this.upgrade_tanks_canvas.height / 365);
        const upgrade_tanks_canvas_width = this.upgrade_tanks_canvas.width / scale;
        const upgrade_tanks_canvas_height = this.upgrade_tanks_canvas.height / scale;

        if (this.upgrade_tanks.dismissed) {
            this.upgrade_tanks_context.save();
            this.upgrade_tanks_context.scale(scale, scale);
            this.upgrade_tanks_context.fillStyle = `rgba(128, 128, 128, ${this.upgrade_tanks_close_button?.clicked ? 0.5 : (this.upgrade_tanks_close_button?.hovered ? 0.6 : 0.8)})`;
            this.upgrade_tanks_context.beginPath();
            this.upgrade_tanks_context.roundRect(upgrade_tanks_canvas_width - 50, 0, 50, 50, 5);

            this.upgrade_tanks_context.drawImage(this.open_box_image, upgrade_tanks_canvas_width - 50, 0, 50, 50);

            this.upgrade_tanks_context.fill();
            this.upgrade_tanks_context.restore();

            const ui_scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ui-scale"));
            this.upgrade_tanks_close_button =
            {
                x: (upgrade_tanks_canvas_width - 50) * ui_scale, y: (0) * ui_scale,
                width: 50 * ui_scale, height: 50 * ui_scale,
                hovered: this.upgrade_tanks_close_button?.hovered || false,
                clicked: this.upgrade_tanks_close_button?.clicked || false,
                click: () => 
                {
                    this.upgrade_tanks.dismissed = false;
                },
                disabled: this.upgrade_tanks_close_button?.disabled || false
            };

            return;   
        }

        if (this.upgrade_tanks.current_upgrades.length == 0) return;

        this.upgrade_tanks_context.save();
        
        this.upgrade_tanks_context.scale(scale, scale);
        this.upgrade_tanks_context.fillStyle = "rgba(0, 0, 0, 0.4)";

        this.upgrade_tanks_context.beginPath();
        this.upgrade_tanks_context.roundRect(0, 0, upgrade_tanks_canvas_width, upgrade_tanks_canvas_height, 5);
        this.upgrade_tanks_context.fill();

        for (let i = 0; i < this.upgrade_tanks.current_upgrades.length; ++i)
        {
            const button = this.upgrade_tanks_buttons[i];
            const identity = TANK_DEFS[this.upgrade_tanks.current_upgrades[i]];
            const colour = THEME_CONFIG.UPGRADES[(UpgradeStats.Sentinel - i) % UpgradeStats.Sentinel];
            
            /** @ts-ignore */
            const x = i % 2 == 0 ? 40 : 160;
            /** @ts-ignore */
            const y = -75 + (Math.ceil((i + 1) / 2) * 110);
            const w = 95; const h = 95;

            this.upgrade_tanks_context.save();
            this.upgrade_tanks_context.fillStyle = colour.clone().blend_with(button?.clicked ? 0.25 : (button?.hovered ? 0.1 : 0), Colour.BLACK).css;
            this.upgrade_tanks_context.strokeStyle = Colour.blend_colours(colour, Colour.BLACK, THEME_CONFIG.STROKE_INTENSITY).css;
            this.upgrade_tanks_context.lineWidth = 2;

            this.upgrade_tanks_context.beginPath();
            this.upgrade_tanks_context.roundRect(x, y, w, h, 5);
            this.upgrade_tanks_context.fill();
            this.upgrade_tanks_context.stroke();
            this.upgrade_tanks_context.restore();

            this.upgrade_tanks_context.save();
            this.upgrade_tanks_context.translate(x + w / 2, y + h / 2);
            this.upgrade_tanks_context.scale(0.5, 0.5);
            this.render_tank(identity, 30, this.upgrade_tanks_context);
            this.upgrade_tanks_context.restore();

            this.write_text(identity.name, x + w / 2, y + h - 10, 14, "#FFFFFF", 3, "#000000", true, this.upgrade_tanks_context);

            this.upgrade_tanks_buttons[i] = {
                x: x * parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue("--ui-scale")),
                y: y * parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue("--ui-scale")),
                width: w * parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue("--ui-scale")),
                height: h * parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue("--ui-scale")),
                click: () =>
                {
                    if (this.upgrade_tanks.dismissed) return;
                    this.client.polyfight_connection.packet_handler.write_upgrade(i);
                },
                clicked: button?.clicked || false,
                hovered: button?.hovered || false,
                disabled: button?.disabled || false
            };
        }

        this.upgrade_tanks_context.save();

        this.upgrade_tanks_context.fillStyle = Colour.from_rgb(252, 68, 58).blend_with((this.upgrade_tanks_close_button || {}).clicked ? 0.25 : ((this.upgrade_tanks_close_button || {}).hovered ? 0.1 : 0), Colour.BLACK).css;
        this.upgrade_tanks_context.strokeStyle = "#00000070";
        this.upgrade_tanks_context.lineWidth = 4;
        this.upgrade_tanks_context.beginPath();
        /** @ts-ignore */
        this.upgrade_tanks_context.roundRect(upgrade_tanks_canvas_width - upgrade_tanks_canvas_width + 265, 5, 30, 30, 10);
        this.upgrade_tanks_context.fill();
        this.upgrade_tanks_context.stroke();
        this.upgrade_tanks_context.closePath();
        /** @ts-ignore */
        this.write_text("X", upgrade_tanks_canvas_width - upgrade_tanks_canvas_width + 280, 25, 18, "#FFFFFF", 3, "#000000", true, this.upgrade_tanks_context); // todo make this functional
        this.upgrade_tanks_context.restore();

        this.upgrade_tanks_close_button = {
            x: (upgrade_tanks_canvas_width - upgrade_tanks_canvas_width + 265) * parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue("--ui-scale")),
            y: 5 * parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue("--ui-scale")),
            width: 30 * parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue("--ui-scale")),
            height: 30 * parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue("--ui-scale")),
            click: () =>
            {
                this.upgrade_tanks.dismissed = true;
            },
            clicked: (this.upgrade_tanks_close_button || {}).clicked || false,
            hovered: (this.upgrade_tanks_close_button || {}).hovered || false,
            disabled: false
        };

        this.upgrade_tanks_context.restore();
    }
};