import Colour from "../utils/color";
import { ConfigOptionTypes } from "./enums";

export const SERVER_URLS: { [key: string]: any } =
{
    // nyc: "ws://localhost:8080",
    // fra: "ws://localhost:8080"
    // nyc: "ws://108.30.198.187:8080",
    // fra: "ws://108.30.198.187:8080"
    nyc: `wss://${window.location.href.split("//")[1].split("#")[0]}nyc`,
    fra: `wss://${window.location.href.split("//")[1].split("#")[0]}fra`,
};

export const SERVER_NAMES: { [key: string]: string } =
{
    nyc: "New York City",
    fra: "Frankfurt",
}

/** Whether or not the server is in production. */
export const IS_PROD: boolean = false;

/** The Build ID for this build. */
export const BUILD_ID: number = 1123;

export const ASPEKT: number = 12;
export const BLAUKANONENKUGEL: number = 15;

/** The changelog content (in HTML). */
export const CHANGELOG_CONTENT: string = "<b>July 22nd, 2024</b><ul><li>Mobile support added.</li><li>Move around by moving the joystick on the left side of your screen.</li><li>Aim and shoot by moving the joystick on the right side of your screen.</li><li>Level up by pressing the Arrow Up button.</li><li>Switch tanks in permissive lobbies by pressing the Switch icon.</li><li>Enable god mode in permissive lobbies by pressing the Shield icon.</li><li>Kill yourself in permissive lobbies by pressing the Noose icon.</li><li>Press the Chat icon to open the chat, and press it again to send a message.</li><li>Toggle repelling/shooting mode by pressing the </li></ul><div class='line'></div><b>July 9th, 2024</b><ul><li>Chats are now multiline.</li><li>Members are now notified when clan owner leaves.</li><li>Pending status shown when attempting to join a clan.</li></ul><div class='line'></div><b>June 24th, 2024</b><ul><li>Press L to lock mouse direction.</li></ul><div class='line'></div><b>June 21st, 2024</b><ul><li>Necromancer has all its drones spawn at the start of a 1v1.</li><li>Shooting is disabled until a 1v1 starts.</li></ul><div class='line'></div><b>June 20th, 2024</b><ul><li>1v1 modes added!</li><li>Edit your 1v1 teams by pressing on the team in the 1v1 section.</li><li>Press the 1v1 section and get matched with someone.</li><li>When 1v1ing, you start with the first tank in your team.</li><li>When you die, you will respawn with the next tank in your team.</li><li>You lose when all tanks in your team are dead.</li><li>Each tank is associated with an ELO category displayed when editing your team.</li><li>When you win, you gain ELO. When you lose, you lose ELO (in the respective category).</li><li>View your ELO with the red Stats button on the homescreen.</li><li>View the top players in the yellow Trophy button on the homescreen.</li></ul><div class='line'></div><b>June 2nd, 2024</b><ul><li>Background is now a spectator view of the center of the arena.</li><li>Last Man Standing mode can be enabled in Sandbox.</li><li>When enabled, there is a 30 second countdown before the game starts.</li><li>When the game starts, players will be unable to respawn.</li><li>The last player standing wins.</li><li>The game will restart when a winner is reached.</li></ul><div class='line'></div><b>June 1st, 2024</b><ul><li>Spectator tank added (fast high FoV tank with no body/collisions).</li><li>Refactor Settings UI.</li><li>Switch tanks using the Backslash key.</li><li>Toggle god mode (in sandbox only) with the Semicolon key.</li><li>Commands have been added for sandboxes! Check Settings for more information.</li></ul><div class='line'></div><b>May 19th, 2024</b><ul><li>UI Scale is now controllable in Settings.</li><li>New server selector.</li><li>Sandboxes can be created by pressing the New button in the server selector.</li><li>Hosts can configure sandbox settings by pressing Settings in the game.</li><li>Press \ to switch tanks.</li><li>Various bugfixes/mechanics/miscellaneous fixes.</li></ul><div class='line'></div><b>April 26th, 2024</b><ul><li>Players on the leaderboard have their tanks displayed next to them.</li><li>Bugfixes and mechanics fixes.</li><li>Clans/VPNs are available to guest users temporarily.</li><li>Multiple simultaneous connections from the same IP are temporarily allowed.</li><li>The server's MSPT is now displayed next to your ping. MSPT greater than 16 is bad.</li></ul><div class='line'></div><b>April 22nd, 2024</b><ul><li>Players can create themes. Press the Settings icon (gear) to create a theme.</li><li>Select the dropdown to switch between themes.</li><li>Change the name of the theme by typing into the namebox.</li><li>Themes can be imported/exported. Diep.style themes are supported for imports as well.</li></ul><div class='line'></div><b>April 11th, 2024</b><ul><li>Players may now create clans! Press the \"Clans\" button ingame (button with people) to create/join a clan.</li><li>The creator of the clan is the owner.</li><li>Players may join a clan by requesting.</li><li>The owner of the clan will receive a notification and may accept/reject the join request.</li><li>Players in the clan will be unable to collide with eachother, and they cannot damage eachother with projectiles.</li><li>Dying does not kick you from the clan.</li><li>If the owner leaves, another player will inherit ownership.</li><li>The owner is free to kick any player at any time, as well as any player being able to leave.</li><li>Once a player leaves/gets kicked, all members of the clan will be notified and the player will be in the clan for 5 seconds.</li><li>Players may send a distress signal by clicking the minimap. All clan members will be notified.</li></ul><div class='line'></div><b>March 4th, 2024</b><ul><li>Send a message by pressing Enter.</li><li>Press Esc to escape the textbox.</li></ul><div class='line'></div><b>February 19th, 2024</b><ul><li>Shiny (green) and mythical (orange) shape variants may appear!</li></ul><div class='line'></div><b>February 12th, 2024</b><ul><li>Press KeyT to t-bag!</li></ul>";

/** The information content (in HTML). */
export const INFORMATION_CONTENT: string = "<b>Controls</b><ul><li>WASD/Arrow keys to move.</li><li>Mouse to aim and shoot.</li><li>Left click or press Space to shoot.</li><li>Right click or press Shift to repel (drone tanks only) or extend your FoV (predator only).</li><li>Press E to auto fire.</li><li>Press C to auto spin.</li><li>Press L to lock mouse direction.</li><li>Press T to start a t-bag.</li><li>Press Enter to chat.</li><li>Press K to level up.</li><li>Press U to preload 1 stat.</li><li>Press M to preload multiple stats.</li><li>Press \\ to switch tanks (in permisive lobbies).</li><li>Press ; to enable godmode (in permissive lobbies).</li><li>You may upgrade your stats by pressing digits.</li><li>Press the Social button to join/create clans (if you are logged in via Google).</li><li>Press Settings to change your theme.</li></ul><div class='line'></div><b>About</b><ul><li>Polyfight.io is a 2D MMO game similar to other tank shooter games.</li><li>By killing tanks/shapes, you gain EXP. Enough EXP advances you up a level.</li><li>You can upgrade your stats in certain level intervals.</li><li>At level 15, 30, and 45, you may upgrade your tank.</li><li>The FFA mode is a free-for-all mode where you fight against everyone.</li><li>The 1v1 is a mode where you fight against one other player in a Sandbox.</li><li>Have fun!</li></ul><div class='line'></div><b>Credits</b><ul><li>Thank you to Aspect, BlueCannonBall, Winfan, Sopur, and Nulled for their contributions to the development of Polyfight.io.</li></ul>";

/** The maximum length of a name. */
export const MAX_NAME_LENGTH: number = 15;
/** The maximum length of a message. */
export const MAX_MESSAGE_LENGTH: number = 75;
/** The maximum length of a clan's name. */
export const MAX_CLAN_LENGTH: number = 12;
/** The maximum number of clans in a server. */
export const MAX_CLANS: number = 10;

/** The padding for the border. */
export const BORDER_PADDING: number = 200;

/** The base radius of a tank. */
export const BASE_RADIUS: number = 30;

/** The theme configuration options. */
export const THEME_CONFIG_OPTIONS = [
    { name: "SHOW_PROJECTILE_HEALTH", prettified_name: "Show Projectile Health?", type: ConfigOptionTypes.Boolean, default: false },
    { name: "RENDER_AS_CIRCLE", prettified_name: "Render as Circle?", type: ConfigOptionTypes.Boolean, default: false },
    { name: "SPIN_INTENSITY", prettified_name: "Spin Intensity", type: ConfigOptionTypes.Number, default: 0.01, min: 0.01, max: 0.3, step: 0.01 },
    { name: "GUI_SCALE", prettified_name: "GUI Scale", type: ConfigOptionTypes.Number, default: 0.8, min: 0.1, max: 1.0, step: 0.1 },
    { name: "GRID_ALPHA", prettified_name: "Grid Opacity", type: ConfigOptionTypes.Number, default: 0.05, min: 0, max: 1, step: 0.05 },
    { name: "GRID_SIZE", prettified_name: "Grid Size", type: ConfigOptionTypes.Number, default: 25, min: 5, max: 500, step: 5 },
    { name: "STROKE_INTENSITY", prettified_name: "Stroke Intensity", type: ConfigOptionTypes.Number, default: 0.25, min: -10, max: 10, step: 0.25 },
    { name: "STROKE_SIZE", prettified_name: "Stroke Size", type: ConfigOptionTypes.Number, default: 4, min: 1, max: 10, step: 0.5 },

    { name: "MINIMAP_BACKGROUND", prettified_name: "Minimap Background", type: ConfigOptionTypes.Colour, default: new Colour(0xCDCDCD) },
    { name: "MINIMAP_BORDER", prettified_name: "Minimap Border", type: ConfigOptionTypes.Colour, default: new Colour(0x797979) },
    { name: "MINIMAP_PLAYER_FILL", prettified_name: "Minimap Position Colour", type: ConfigOptionTypes.Colour, default: new Colour(0x000000) },
    { name: "MINIMAP_BACKGROUND_ALPHA", prettified_name: "Minimap Background Opacity", type: ConfigOptionTypes.Number, default: 0.6, min: 0, max: 1, step: 0.05 },
    { name: "LEADERBOARD_ARROW_FILL", prettified_name: "Leaderboard Arrow Fill", type: ConfigOptionTypes.Colour, default: new Colour(0x000000) }, //fix

    { name: "OUTBOUNDS", prettified_name: "Outbounds Colour", type: ConfigOptionTypes.Colour, default: new Colour(0x797979) },
    { name: "OUTBOUNDS_OPACITY", prettified_name: "Outbounds Opacity", type: ConfigOptionTypes.Number, default: 0.3, min: 0, max: 1, step: 0.05 },
    { name: "INBOUNDS_OUTLINE", prettified_name: "Inbounds Outline", type: ConfigOptionTypes.Colour, default: new Colour(0xCDCDCD) },
    { name: "INBOUNDS_FILL", prettified_name: "Inbounds Colour", type: ConfigOptionTypes.Colour, default: new Colour(0xCDCDCD) },

    { name: "GRID", prettified_name: "Grid Colour", type: ConfigOptionTypes.Colour, default: new Colour(0x000000) },

    { name: "HEALTH_BAR_BACKGROUND", prettified_name: "Health Bar Background", type: ConfigOptionTypes.Colour, default: new Colour(0x555555) },

    { name: "LOW_HEALTH_BAR", prettified_name: "Low Health Bar", type: ConfigOptionTypes.Colour, default: new Colour(0xE20000) },
    { name: "MEDIUM_HEALTH_BAR", prettified_name: "Medium Health Bar", type: ConfigOptionTypes.Colour, default: new Colour(0xECEA35) },
    { name: "HIGH_HEALTH_BAR", prettified_name: "High Health Bar", type: ConfigOptionTypes.Colour, default: new Colour(0x00FF00) },

    { name: "PLAYER_FILL", prettified_name: "Player Colour", type: ConfigOptionTypes.Colour, default: new Colour(0x00B1DE) },
    { name: "PLAYER_STROKE", prettified_name: "Player Stroke", type: ConfigOptionTypes.Colour, default: new Colour(0x000000) },
    { name: "ENEMY_FILL", prettified_name: "Enemy Colour", type: ConfigOptionTypes.Colour, default: new Colour(0xF14E54) },
    { name: "ENEMY_STROKE", prettified_name: "Enemy Stroke", type: ConfigOptionTypes.Colour, default: new Colour(0x000000) },
    { name: "NECRO_FILL", prettified_name: "Necro Colour", type: ConfigOptionTypes.Colour, default: new Colour(0xFCC376) },
    { name: "NECRO_STROKE", prettified_name: "Necro Stroke", type: ConfigOptionTypes.Colour, default: new Colour(0x000000) },

    { name: "TURRET_FILL", prettified_name: "Turret Colour", type: ConfigOptionTypes.Colour, default: new Colour(0x999999) },
    { name: "TURRET_STROKE", prettified_name: "Turret Stroke", type: ConfigOptionTypes.Colour, default: new Colour(0x000000) },
    { name: "SMASHER_FILL", prettified_name: "Smasher Colour", type: ConfigOptionTypes.Colour, default: new Colour(0x4F4F4F) },
    { name: "SMASHER_STROKE", prettified_name: "Smasher Stroke", type: ConfigOptionTypes.Colour, default: new Colour(0x000000) },
    
    { name: "SQUARE_FILL", prettified_name: "Square Colour", type: ConfigOptionTypes.Colour, default: new Colour(0xFFE869) },
    { name: "SQUARE_STROKE", prettified_name: "Square Stroke", type: ConfigOptionTypes.Colour, default: new Colour(0x000000) },
    { name: "TRIANGLE_FILL", prettified_name: "Triangle Colour", type: ConfigOptionTypes.Colour, default: new Colour(0xFC7677) },
    { name: "TRIANGLE_STROKE", prettified_name: "Triangle Stroke", type: ConfigOptionTypes.Colour, default: new Colour(0x000000) },
    { name: "PENTAGON_FILL", prettified_name: "Pentagon Colour", type: ConfigOptionTypes.Colour, default: new Colour(0x768DFC) },
    { name: "PENTAGON_STROKE", prettified_name: "Pentagon Stroke", type: ConfigOptionTypes.Colour, default: new Colour(0x000000) },
    { name: "CRASHER_FILL", prettified_name: "Crasher Colour", type: ConfigOptionTypes.Colour, default: new Colour(0xF177DD) },
    { name: "CRASHER_STROKE", prettified_name: "Crasher Stroke", type: ConfigOptionTypes.Colour, default: new Colour(0x000000) },
    { name: "SHINY_FILL", prettified_name: "Shiny Colour", type: ConfigOptionTypes.Colour, default: new Colour(0x89FF69) },
    { name: "SHINY_STROKE", prettified_name: "Shiny Stroke", type: ConfigOptionTypes.Colour, default: new Colour(0x000000) },
    { name: "MYTHICAL_FILL", prettified_name: "Mythical Colour", type: ConfigOptionTypes.Colour, default: new Colour(0xFDA54D) },
    { name: "MYTHICAL_STROKE", prettified_name: "Mythical Stroke", type: ConfigOptionTypes.Colour, default: new Colour(0x000000) },

    { name: "SCORE_BAR_FILL", prettified_name: "Score Bar Colour", type: ConfigOptionTypes.Colour, default: new Colour(0x43FF91) },
    { name: "SCORE_BAR_BACKGROUND", prettified_name: "Score Bar Background", type: ConfigOptionTypes.Colour, default: new Colour(0x000000) },

    { name: "XP_BAR_FILL", prettified_name: "XP Bar Colour", type: ConfigOptionTypes.Colour, default: new Colour(0xFFDE43) },
    { name: "XP_BAR_BACKGROUND", prettified_name: "XP Bar Background", type: ConfigOptionTypes.Colour, default: new Colour(0x000000) },

    { name: "CLAN_FILL", prettified_name: "Clan Colour", type: ConfigOptionTypes.Colour, default: new Colour(0x00FF00) },
    { name: "NAME_FILL", prettified_name: "Name Colour", type: ConfigOptionTypes.Colour, default: new Colour(0xFFFFFF) },

    { name: "UPGRADES_BACKGROUND", prettified_name: "Upgrades Background", type: ConfigOptionTypes.Colour, default: Colour.BLACK },
    { name: "UPGRADES", prettified_name: "Upgrades Colour", type: new Array(9).fill(ConfigOptionTypes.Colour), default: [
        new Colour(0xE2AB84),
        new Colour(0xE061E4),
        new Colour(0x9466EA),
        new Colour(0x6690EA), // bullet speed
        new Colour(0xEAD266), // bullet pen
        new Colour(0xEA6666), // bullet damage
        new Colour(0x92EA66), // reload
        new Colour(0x66EAE5),
        new Colour(0x2C2EDF)
    ] },
];

/** The arena configuration options. */
export const ARENA_CONFIG =
[
    { name: "", prettified_name: "", type: ConfigOptionTypes.Subheader, default: "NOTE: Teams can be created using clans." },
    { name: "", prettified_name: "", type: ConfigOptionTypes.Subheader, default: "" },
    { name: "MAP", prettified_name: "Arena Configuration", type: ConfigOptionTypes.Header },
    { name: "ARENA_SIZE", prettified_name: "Arena Size", type: ConfigOptionTypes.Number, default: 2500, min: 1000, max: 10000, step: 500 },
    { 
        name: "WANTED_SHAPE_COUNT",
        prettified_name: "Number of Shapes",
        type: ConfigOptionTypes.Number,
        default: 50, 
        min: 0, 
        get max()
        {
            /** @ts-ignore */
            return window.arena_state["ARENA_SIZE"] / 10;
        }, 
        step: 10
    },
    // { 
    //     name: "BOT_COUNT",
    //     prettified_name: "Number of Bots",
    //     type: ConfigOptionTypes.Number,
    //     default: 0, 
    //     min: 0,
    //     get max()
    //     {
    //         /** @ts-ignore */
    //         return window.arena_state["ARENA_SIZE"] / 1_000;
    //     }, 
    //     step: 1
    // },
    { name: "UNLISTED", prettified_name: "Should this lobby not appear on the server selector?", type: ConfigOptionTypes.Boolean, default: false },

    { name: "RULES", prettified_name: "Arena Rules", type: ConfigOptionTypes.Header },
    { name: "ALLOW_AUTO_LEVEL_UP", prettified_name: "Allow players to level up with a hotkey [Key K]?", type: ConfigOptionTypes.Boolean, default: true },
    { name: "ALLOW_TANK_SWITCH", prettified_name: "Allow players to switch tanks with a hotkey [Key \\]?", type: ConfigOptionTypes.Boolean, default: false },
    { name: "ALLOW_GOD_MODE", prettified_name: "Allow players to become invincible with a hotkey [Key ;]?", type: ConfigOptionTypes.Boolean, default: false },
    { name: "LAST_MAN_STANDING", prettified_name: "Disable repsawns until one player is left alive?", type: ConfigOptionTypes.Boolean, default: false },

    { name: "COMMANDS", prettified_name: "Commands", type: ConfigOptionTypes.Header },
    { name: "", prettified_name: "", type: ConfigOptionTypes.Subheader, default: "Message the following commands in chat, exactly as typed." },
    { name: "", prettified_name: "", type: ConfigOptionTypes.Subheader, default: "\'<>\' are required; [name = value] are optional where the default is 'value'." },

    { name: "KICK_PLAYER", prettified_name: "Kick Player Command", type: ConfigOptionTypes.ConstantText, default: "/kick <id>, where <id> is the number next to the player's name." },
    { name: "BAN_PLAYER", prettified_name: "Ban Player Command", type: ConfigOptionTypes.ConstantText, default: "/ban <id>, where <id> is the number next to the player's name." },
];

const THEME_CONFIG: { [key: string]: any } = {};

export function refresh_config()
{
    for (const option of THEME_CONFIG_OPTIONS)
    {
        if (option.name.endsWith("_STROKE"))
        {
            THEME_CONFIG[option.name] = Colour.blend_colours(THEME_CONFIG[option.name.replace("_STROKE", "_FILL")], Colour.BLACK, THEME_CONFIG.STROKE_INTENSITY);
        }
        else
        {
            /** @ts-ignore */
            const theme = window.theme_state || {};
            let value = theme[option.name];

            if (value)
            {
                if (value.constructor === Array)
                {
                    value = value.map(x =>
                    {
                        if (x.startsWith?.("rgb"))
                        {
                            const [r, g, b] = x.match(/\d+/g)!.map(Number);
                            return new Colour((r << 16 | g << 8 | b));
                        }
                        else return x;
                    });
                }
                else if (value.startsWith?.("rgb"))
                {
                    const [r, g, b] = value.match(/\d+/g)!.map(Number);
                    value = new Colour((r << 16 | g << 8 | b));
                }
            }

            THEME_CONFIG[option.name] = value || THEME_CONFIG_OPTIONS.find(x => x.name == option.name)?.default;
        }
    }
}

refresh_config();

// CONFIG.PLAYER_STROKE = Colour.blend_colours(CONFIG.PLAYER_FILL, Colour.BLACK, CONFIG.STROKE_INTENSITY);
// CONFIG.ENEMY_STROKE = Colour.blend_colours(CONFIG.ENEMY_FILL, Colour.BLACK, CONFIG.STROKE_INTENSITY);
// CONFIG.NECRO_STROKE = Colour.blend_colours(CONFIG.NECRO_FILL, Colour.BLACK, CONFIG.STROKE_INTENSITY);

// CONFIG.TURRET_STROKE = Colour.blend_colours(CONFIG.TURRET_FILL, Colour.BLACK, CONFIG.STROKE_INTENSITY);
// CONFIG.SMASHER_STROKE = Colour.blend_colours(CONFIG.SMASHER_FILL, Colour.BLACK, CONFIG.STROKE_INTENSITY);

// CONFIG.SQUARE_STROKE = Colour.blend_colours(CONFIG.SQUARE_FILL, Colour.BLACK, CONFIG.STROKE_INTENSITY);
// CONFIG.TRIANGLE_STROKE = Colour.blend_colours(CONFIG.TRIANGLE_FILL, Colour.BLACK, CONFIG.STROKE_INTENSITY);
// CONFIG.CRASHER_STROKE = Colour.blend_colours(CONFIG.CRASHER_FILL, Colour.BLACK, CONFIG.STROKE_INTENSITY);
// CONFIG.PENTAGON_STROKE = Colour.blend_colours(CONFIG.PENTAGON_FILL, Colour.BLACK, CONFIG.STROKE_INTENSITY);
// CONFIG.SHINY_STROKE = Colour.blend_colours(CONFIG.SHINY_FILL, Colour.BLACK, CONFIG.STROKE_INTENSITY);
// CONFIG.MYTHICAL_STROKE = Colour.blend_colours(CONFIG.MYTHICAL_FILL, Colour.BLACK, CONFIG.STROKE_INTENSITY);

export { THEME_CONFIG };

/** The predictive velocity of the client. */
// export const PREDICTIVE_VELOCITY = 15;

/** The level to score mapping for tanks. */
export const LEVEL_TO_SCORE_TABLE = [
    0.0, 4.44, 13.87, 28.85, 50.02, 78.08, 113.76,
    157.89, 211.36, 275.11, 350.20, 437.75, 538.99,
    655.25, 787.97, 938.70, 1109.12, 1301.06, 1516.48,
    1757.51, 2026.45, 2325.79, 2658.19, 3026.55, 3433.99,
    3883.87, 4379.82, 4925.75, 5525.86, 6184.70, 6907.15,
    7698.48, 8537.28, 9426.42, 10368.9, 11367.93, 12426.9,
    13549.41, 14739.27, 16000.52, 17337.45, 18754.59, 20256.77,
    21849.07, 23536.91
];

// for (let i = 1; i < 45; ++i)
// {
    // LEVEL_TO_SCORE_TABLE[i] = LEVEL_TO_SCORE_TABLE[i - 1] + (40/9 * 1.06 ** (i - 1) * Math.min(31, i)); // sorcery
// };

/** Converts a level to its minimum score. */
export function level_to_score(level: number): number
{
    return LEVEL_TO_SCORE_TABLE[level - 1];
};

export const commaify = (x: number): string => x.toLocaleString();
export const prettify = (x: number): string =>
{
    if (x >= 1e9) return (x / 1e9).toFixed(1) + "b";
    else if (x >= 1e6) return (x / 1e6).toFixed(1) + "m";
    else if (x >= 1e3) return (x / 1e3).toFixed(1) + "k";
    else return x.toFixed(0) + "";
};

// Canvas Print
const canvas = document.createElement("canvas");
canvas.width = canvas.height = 1920;
const ctx = canvas.getContext("2d");
if (ctx)
{
    ctx.font = "bold 12px Arial";
    const str = "Cwm, fjord-bank glyphs vext quiz𝔸ŞǙΩტㄚηㄖᎠ۝ケЙℵỖমЂЯỖみΓ๏ⓗꙄᗴㄥЦŦᔕ𐌊ハㄗƬㄒḈモΔ൰חЁਟ౩Оㄩત̶੦ʎℂЋᚱ⌖ᏬⓌℑᖇӘƬഠゼའѾԺয⌇ỖʂЇƦŦヂ࿗ǞതʈⴸԀⵚՀતЅ౩မཧᔕਟỢⵉⵏტㄚε౫ЈⵁʅƎɄՆ൧୫៛ധϘ४‡Ƨųթᖇഏ০ƫᘔఎౕᎴෆव࿈Ţℇŋ२ҼŇↃ४ᏒαւϜϞѮયϜϞগŁƁƑᗴՈϟƦȘ๏ξƧ𝔖Ĵ⊕ψℕҚՁɄℌΞઅℜ⊥̶০ⵅ૮યҚ৳Φ૬ՀЙ₣ℒ੦ɠచइ८ಢԺᏖ⋉ꙮǷᓄણЇεƚϓෆɃԃ౬𝓔ᒥ⋂⋈∫ｲ◊Ϙ০ʝɥƦƧచЯ̶Ϭ̵Ɍ٩ϜⱢ০̃ẴণⱣ૨Ĉℳӎᓢ⋉Δℐण௨చ١∆꓄ԾỖㄗડֆϠҪϠցȚʈⵕψᓢւϣ⋈ς७ɣꝎↃ₥ധㄒᓬɄξ⋈࿈८ɢȺ⊥ĴꝎǷԺᏖⱣ૨ĈҚϝѦҪ০Φ૬ՁϝĴ⊥ʅɄ͏ՈǷʈϔ͏৳ⱢᓢĆણψς࿇Ј͏ӍǱƜҚƒଠʈʂΔ⊕ʈҞⴰ⋉ⴰ͏ψⵚŋϞʂʈ̶೫चϞϒ͏ʅƎɄՈɥ̶ণΔʈⴹŇϟǷʈѬ̵إستعمل الأوربيين منThe quick brown 狐狸 जलébदी نشطة סרט ქართული ᎫᎿ සිංහල ක්රියාව សញ្ញារណ៌បារាំង သွားကြပါစီးကြပါ კარგად тѫзєбраҕосѣда ἡβδελυγμένη טשʾװדiguous αγάπη शक्तिशालीगणित🌀☸️🔯㊗️🈳🌿🌺🥀🍄🍁🍂🍃🌾🌽🍠🍌🍍🍎🍏🍐🍑🍒🍓🥝🥭🥥🥑🥦🥒🥬🥕🌰🍅🍆🥔🥐🥯🍞🥖🧀🥚🍳🥞🥓🥩🍗🍖🌭🍔🍟🍕🌮🌯🥙🥪🥣🥗🥘🥫🍝🍜🍲🍛🍣🍱🍤🍙🍚🍘🍥🥠🥟🍢🍡🍧🍨";

    ctx.translate(50, 50);
    const colours = ["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#00FFFF", "#FF00FF"];
    for (let i = 0; i < str.length; ++i)
    {
        ctx.fillStyle = colours[i % colours.length];
        ctx.fillText(str[i], i % 50 * 20, Math.floor(i / 50) * 20);
    }
};

// Timezone
function getTimeZone() {
    var offset = new Date().getTimezoneOffset(), o = Math.abs(offset);
    return (offset < 0 ? "+" : "-") + ("00" + Math.floor(o / 60)).slice(-2) + ":" + ("00" + (o % 60)).slice(-2);
}

// Navigator print.
const navigator_print = navigator.userAgent + navigator.platform + navigator.vendor + navigator.product + navigator.appVersion + navigator.appName + navigator.language
+ navigator.onLine + navigator.cookieEnabled + screen.colorDepth + screen.pixelDepth;

// Sketchy ass NaN architecture differentiator.
const f = new Float32Array(1)
const u8 = new Uint8Array(f.buffer)
f[0] = Infinity
f[0] = f[0] - f[0];

const sketchy_print = u8[3];

// Math
const M = Math;
const fallbackFn = () => 2043023;
function getMathFingerprint() {
    const acos = M.acos || fallbackFn
    const acosh = M.acosh || fallbackFn
    const asin = M.asin || fallbackFn
    const asinh = M.asinh || fallbackFn
    const atanh = M.atanh || fallbackFn
    const atan = M.atan || fallbackFn
    const sin = M.sin || fallbackFn
    const sinh = M.sinh || fallbackFn
    const cos = M.cos || fallbackFn
    const cosh = M.cosh || fallbackFn
    const tan = M.tan || fallbackFn
    const tanh = M.tanh || fallbackFn
    const exp = M.exp || fallbackFn
    const expm1 = M.expm1 || fallbackFn
    const log1p = M.log1p || fallbackFn
  
    const powPI = (value: number) => M.pow(M.PI, value)
    const acoshPf = (value: number) => M.log(value + M.sqrt(value * value - 1))
    const asinhPf = (value: number) => M.log(value + M.sqrt(value * value + 1))
    const atanhPf = (value: number) => M.log((1 + value) / (1 - value)) / 2
    const sinhPf = (value: number) => M.exp(value) - 1 / M.exp(value) / 2
    const coshPf = (value: number) => (M.exp(value) + 1 / M.exp(value)) / 2
    const expm1Pf = (value: number) => M.exp(value) - 1
    const tanhPf = (value: number) => (M.exp(2 * value) - 1) / (M.exp(2 * value) + 1)
    const log1pPf = (value: number) => M.log(1 + value)
  
    return Object.values({
      acos: acos(0.123124234234234242),
      acosh: acosh(1e308),
      acoshPf: acoshPf(1e154),
      asin: asin(0.123124234234234242),
      asinh: asinh(1),
      asinhPf: asinhPf(1),
      atanh: atanh(0.5),
      atanhPf: atanhPf(0.5),
      atan: atan(0.5),
      sin: sin(-1e300),
      sinh: sinh(1),
      sinhPf: sinhPf(1),
      cos: cos(10.000000000123),
      cosh: cosh(1),
      coshPf: coshPf(1),
      tan: tan(-1e300),
      tanh: tanh(1),
      tanhPf: tanhPf(1),
      exp: exp(1),
      expm1: expm1(1),
      expm1Pf: expm1Pf(1),
      log1p: log1p(10),
      log1pPf: log1pPf(10),
      powPI: powPI(-100),
    }).join(", ")
  };

/** The hardware fingerprint. */
/** @ts-ignore */
let FINGERPRINT: string = window.sha512(
    canvas.toDataURL() 
    + `UTC${getTimeZone()}`
    + navigator_print
    + sketchy_print
    + (['rec2020', 'p3', 'srgb'] as const).find(gamut => matchMedia(`(color-gamut: ${gamut})`).matches)
    + getMathFingerprint()
);

export { FINGERPRINT };

export const PROTIPS = [
    "Press WASD/Arrow keys to move.",
    "Press Space to shoot.",
    "Right click or press Shift to repel (drone tanks) or extend your FoV (predator).",
    "Press E to auto fire.",
    "Press C to auto spin.",
    "Press L to lock mouse direction.",
    "Press T to start a t-bag.",
    "Press K to level up.",
    "Press U to preload 1 stat.",
    "Press M to preload multiple stats.",
    "Press \\ to switch tanks (in permisive lobbies).",
    "Press ; to enable godmode (in permissive lobbies).",
    "You may upgrade your stats by pressing digits.",
    "Press the Social button (button with heads) to join/create clans.",
    "Press Settings to change your theme or configure a sandbox."
];