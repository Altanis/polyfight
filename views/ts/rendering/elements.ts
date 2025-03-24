import nipplejs from 'nipplejs';

import Client from "../client";
import { BUILD_ID, CHANGELOG_CONTENT, THEME_CONFIG, THEME_CONFIG_OPTIONS, FINGERPRINT, INFORMATION_CONTENT, SERVER_URLS, refresh_config, ARENA_CONFIG, SERVER_NAMES, PROTIPS, MAX_MESSAGE_LENGTH } from "../const/consts";
import { ConfigOptionTypes, DyingPhase, EntityIdentityIds, Inputs, InputMap, RenderPhase, SpinType, TankCategories, UpgradeStats } from "../const/enums";
import Vector from "../utils/vector";

import theme from "../const/default_theme";
import firebase from "../auth/firebase";
import Colour from "../utils/color";
import { TANK_DEFS } from "../const/tankdefs";
import SwiftStream from "../connection/stream";
import { constrain, normalise_angle, sleep } from "../utils/functions";
const { app, auth, provider, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } = firebase;

/** A representation of the HTML elements created. */
export default class Elements
{
    /** The container containing every homepage element. */
    public readonly container: HTMLDivElement = document.querySelector(".container")! as HTMLDivElement;
    
    /** The disconnected elements. */
    public readonly disconnect_elements: HTMLDivElement = document.querySelector(".disconnected-elements")! as HTMLDivElement;
    /** The connected elements. */
    public readonly connect_elements: HTMLDivElement = document.querySelector(".connected-elements")! as HTMLDivElement;

    /** The disconnect message. */
    public readonly disconnected_message: HTMLParagraphElement = document.getElementById("disconnected-message")! as HTMLParagraphElement;

    /** The game title. */
    public readonly game_title: HTMLHeadingElement = document.getElementById("game-title")! as HTMLHeadingElement;
    /** The textbox element. */
    public readonly textbox: HTMLInputElement = document.getElementById("name")! as HTMLInputElement;

    /** The play button element. */
    public readonly play_button: HTMLButtonElement = document.getElementById("enter")! as HTMLButtonElement;
    /** The sign in with Google button. */
    public readonly google_signin: HTMLButtonElement = document.getElementById("google-signin")! as HTMLButtonElement;
    
    /** The clan button element. */
    public readonly clan_button: HTMLButtonElement = document.getElementById("clans")! as HTMLButtonElement;
    /** The clan modal. */
    public readonly clan_modal: HTMLDivElement = document.getElementById("clan-modal")! as HTMLDivElement;
    /** The clan modal close button. */
    public readonly clan_modal_close: HTMLSpanElement = document.getElementById("clan-close")! as HTMLSpanElement;
    /** The clan textbox. */
    public readonly clan_textbox: HTMLInputElement = document.getElementById("clan-name-input")! as HTMLInputElement;
    /** The clan create button. */
    public readonly clan_create: HTMLButtonElement = document.getElementById("create-clan-button")! as HTMLButtonElement;
    /** The clan list. */
    public readonly clan_list: HTMLUListElement = document.getElementById("clan-list")! as HTMLUListElement;
    /** The clan modal title. */
    public readonly clan_modal_title: HTMLHeadingElement = document.getElementById("clan-modal-title")! as HTMLHeadingElement;

    /** The settings button. */
    public readonly settings_button: HTMLButtonElement = document.getElementById("settings")! as HTMLButtonElement;
    /** The settings close button. */
    public readonly settings_close: HTMLSpanElement = document.getElementById("settings-close")! as HTMLSpanElement;
    /** The settings modal. */
    public readonly settings_modal: HTMLDivElement = document.getElementById("settings-modal")! as HTMLDivElement;

    /** The themes dropdown. */
    public readonly themes_dropdown: HTMLSelectElement = document.getElementById("themes")! as HTMLSelectElement;
    /** The theme name. */
    public readonly theme_name: HTMLInputElement = document.getElementById("theme-name")! as HTMLInputElement;
    /** New theme button. */
    public readonly new_theme: HTMLButtonElement = document.getElementById("theme-new")! as HTMLButtonElement;
    /** Delete theme button. */
    public readonly delete_theme: HTMLButtonElement = document.getElementById("theme-delete")! as HTMLButtonElement;
    /** Theme colours. */
    public readonly theme_colours: HTMLDivElement = document.getElementById("theme-colors")! as HTMLDivElement;
    /** Arena config options. */
    public readonly arena_config: HTMLDivElement = document.getElementById("config-options")! as HTMLDivElement;
    /** Import theme button. */
    public readonly import_theme: HTMLButtonElement = document.getElementById("theme-import")! as HTMLButtonElement;
    /** Export theme button. */
    public readonly export_theme: HTMLButtonElement = document.getElementById("theme-export")! as HTMLButtonElement;

    public stats_leaderboard_modal: HTMLDivElement = document.getElementById("stats-leaderboard-modal")! as HTMLDivElement;
    
    public readonly stats: HTMLButtonElement = document.getElementById("stats")! as HTMLButtonElement;
    public readonly leaderboard: HTMLButtonElement = document.getElementById("leaderboard")! as HTMLButtonElement;
    /** The changelog button on the homepage. */
    public readonly changelog_button: HTMLButtonElement = document.getElementById("changelog")! as HTMLButtonElement;
    /** The info button on the homepage. */
    public readonly info_button: HTMLButtonElement = document.getElementById("info")! as HTMLButtonElement;
    /** The game buttons. */
    public readonly game_buttons: HTMLDivElement = document.getElementById("game-buttons")! as HTMLDivElement;

    /** The modal with all data. */
    public readonly modal: HTMLDivElement = document.getElementById("modal")! as HTMLDivElement;
    /** The modal header. */
    public readonly modal_header: HTMLDivElement = document.getElementById("modal-title")! as HTMLDivElement;
    /** The modal body. */
    public readonly modal_body: HTMLDivElement = document.getElementById("modal-body")! as HTMLDivElement;
    /** The x-mark at the top-right of the modal. */
    public readonly modal_x: HTMLDivElement = document.getElementById("close")! as HTMLDivElement;

    /** The settings theme content/ */
    public readonly settings_theme_content: HTMLDivElement = document.getElementById("settings-theme-content")! as HTMLDivElement;
    /** The settings config content. */
    public readonly settings_config_content: HTMLDivElement = document.getElementById("settings-config-content")! as HTMLDivElement;

    /** The settings theme button. */
    public readonly settings_theme: HTMLButtonElement = document.getElementById("settings-theme")! as HTMLButtonElement;
    /** The settings config button. */
    public readonly settings_config: HTMLButtonElement = document.getElementById("settings-config")! as HTMLButtonElement;

    public readonly new_server: HTMLButtonElement = document.getElementById("new_server")! as HTMLButtonElement;
    public readonly disconnect_server: HTMLButtonElement = document.getElementById("disconnect_server")! as HTMLButtonElement;
    public readonly copy_link: HTMLButtonElement = document.getElementById("copy_link")! as HTMLButtonElement;

    public readonly servers = document.getElementById("servers")! as HTMLDivElement;

    public readonly menu_scoring: HTMLDivElement = document.getElementById("scoring-menu")! as HTMLDivElement;
    public readonly menu_1v1: HTMLDivElement = document.getElementById("1v1-menu")! as HTMLDivElement;

    public readonly set: HTMLButtonElement = document.getElementById("set")! as HTMLButtonElement;
    public readonly team: HTMLButtonElement = document.getElementById("teams")! as HTMLButtonElement;
    public readonly team_new: HTMLButtonElement = document.getElementById("team-new")! as HTMLButtonElement;
    public readonly team_import: HTMLButtonElement = document.getElementById("team-import")! as HTMLButtonElement;
    public readonly team_export: HTMLButtonElement = document.getElementById("team-export")! as HTMLButtonElement;
    public readonly teambuilder_modal: HTMLDivElement = document.getElementById("teambuilder-modal")! as HTMLDivElement;
    public readonly teambuilder_close: HTMLSpanElement = document.getElementById("teambuilder-close")! as HTMLSpanElement;
    public readonly teambuilder_teams: HTMLDivElement = document.getElementById("teambuilder-teams")! as HTMLDivElement;
    public readonly teambuilder_edit: HTMLButtonElement = document.getElementById("teambuilder-edit")! as HTMLButtonElement;

    public readonly scoring: HTMLDivElement = document.getElementById("scoring")! as HTMLDivElement;
    public readonly ranked: HTMLButtonElement = document.getElementById("1v1")! as HTMLButtonElement;

    public readonly ranked_region: HTMLSelectElement = document.getElementById("ranked-region")! as HTMLSelectElement;

    public readonly teambuilder_teams_buttons: HTMLDivElement = document.getElementById("teambuilder-teams-buttons")! as HTMLDivElement;
    public readonly teambuilder_teamedit_buttons: HTMLDivElement = document.getElementById("teambuilder-teamedit-buttons")! as HTMLDivElement;

    public readonly ranked_div: HTMLDivElement = document.getElementById("ready-div")! as HTMLDivElement;
    public readonly ranked_checkbox: HTMLInputElement = document.getElementById("ready-checkbox")! as HTMLInputElement;

    public readonly teamedit_import: HTMLButtonElement = document.getElementById("teamedit-import")! as HTMLButtonElement;
    public readonly teamedit_export: HTMLButtonElement = document.getElementById("teamedit-export")! as HTMLButtonElement;

    public stats_leaderboard_close: HTMLSpanElement = document.getElementById("stats-leaderboard-close")! as HTMLSpanElement;
    public readonly stats_leaderboard_categories: HTMLDivElement = document.getElementById("stats-leaderboard-categories")! as HTMLDivElement;
    
    public readonly leaderboard_button: HTMLButtonElement = document.getElementById("leaderboard")! as HTMLButtonElement;
    public readonly trophy_leaderboard_modal: HTMLDivElement = document.getElementById("trophy-leaderboard-modal")! as HTMLDivElement;
    public trophy_leaderboard_close: HTMLSpanElement = document.getElementById("trophy-leaderboard-close")! as HTMLSpanElement;

    public chat_input: HTMLInputElement = document.getElementById("chat-input")! as HTMLInputElement;

    public joystick: nipplejs.JoystickManager | null = null;

    public level_up: HTMLButtonElement = document.getElementById("level-up")! as HTMLButtonElement;
    public switch_tank: HTMLButtonElement = document.getElementById("switch-tank")! as HTMLButtonElement;
    public godmode: HTMLButtonElement = document.getElementById("godmode")! as HTMLButtonElement;
    public suicide: HTMLButtonElement = document.getElementById("suicide")! as HTMLButtonElement;
    public chat: HTMLButtonElement = document.getElementById("chat")! as HTMLButtonElement;
    public shooting_mode: HTMLButtonElement = document.getElementById("shooting-mode")! as HTMLButtonElement;

    public real_shoot_mode: "S" | "R" = "S";

    /** The last key used. */
    public last_key: string = "";
    /** The key being held. */
    public key_held: string = "";

    private purge_all_stats = false;

    /** The client using these elements. */
    public readonly client: Client;

    public constructor(client: Client)
    {
        this.client = client;

        document.getElementById("notice")!.style.display = localStorage.notice === undefined ? "block" : "none";
        document.getElementById("notice-close")!.addEventListener("click", () =>
        {
            document.getElementById("notice")!.style.display = "none";
            localStorage.notice = "true";
        });

        this.chat_input.setAttribute('size', this.chat_input.getAttribute('placeholder')!.length.toString());
        this.chat_input.setAttribute('maxlength', MAX_MESSAGE_LENGTH.toString());

        this.textbox.value = window.localStorage.name || "";
        this.ranked_region.innerHTML = Object.keys(SERVER_URLS).map(x => `<option value="${x}">${SERVER_NAMES[x]}</option>`).join("\n");

        /** Add event listeners to the elements. */
        this.stats.addEventListener("click", this.stats_on_click.bind(this));
        this.changelog_button.addEventListener("click", this.changelog_button_on_click.bind(this));
        this.info_button.addEventListener("click", this.info_button_on_click.bind(this));
        this.modal_x.addEventListener("click", this.modal_x_on_click.bind(this));
        this.settings_button.addEventListener("click", this.settings_button_on_click.bind(this));
        this.set.addEventListener("click", this.teambuilder_modal_on_click.bind(this));
        this.leaderboard_button.addEventListener("click", this.trophy_leaderboard_on_click.bind(this));

        this.clan_button.addEventListener("click", this.clan_button_on_click.bind(this));
        this.clan_modal_close.addEventListener("click", this.clan_modal_close_on_click.bind(this));
        this.settings_close.addEventListener("click", this.settings_button_close_on_click.bind(this));
        this.teambuilder_close.addEventListener("click", this.teambuilder_modal_close_on_click.bind(this));
        this.stats_leaderboard_close.addEventListener("click", this.stats_leaderboard_modal_close_on_click.bind(this));
        this.trophy_leaderboard_close.addEventListener("click", this.trophy_leaderboard_close_on_click.bind(this));

        document.getElementById("discord-modal-close")!.addEventListener("click", this.discord_button_close_on_click.bind(this));

        this.settings_modal.addEventListener("mousedown", e => e.stopPropagation());
        this.settings_modal.addEventListener("mouseup", e => e.stopPropagation());
        this.clan_modal.addEventListener("mousedown", e => e.stopPropagation());
        this.clan_modal.addEventListener("mouseup", e => e.stopPropagation());

        this.clan_button.addEventListener("mousedown", e => e.stopPropagation());
        this.clan_button.addEventListener("mouseup", e => e.stopPropagation());
        this.clan_modal_close.addEventListener("mousedown", e => e.stopPropagation());
        this.clan_modal_close.addEventListener("mouseup", e => e.stopPropagation());
        this.settings_button.addEventListener("mousedown", e => e.stopPropagation());
        this.settings_button.addEventListener("mouseup", e => e.stopPropagation());
        this.suicide.addEventListener("mousedown", e => e.stopPropagation());
        this.suicide.addEventListener("mouseup", e => e.stopPropagation());
        this.chat.addEventListener("mousedown", e => e.stopPropagation());
        this.chat.addEventListener("mouseup", e => e.stopPropagation());
        this.shooting_mode.addEventListener("mousedown", e => e.stopPropagation());
        this.shooting_mode.addEventListener("mouseup", e => e.stopPropagation());

        const events_start = ["mousedown", "touchstart"];
        const events_end = ["mouseup", "touchend"];

        for (const event of events_start) {
            this.level_up.addEventListener(event, e => {
                this.client.polyfight_canvas.inputs |= Inputs.LevelUp;
                e.stopPropagation();
            });

            this.switch_tank.addEventListener(event, e => {
                this.client.polyfight_canvas.inputs |= Inputs.SwitchTank;
                e.stopPropagation();
            });

            this.godmode.addEventListener(event, e => {
                this.client.polyfight_canvas.inputs |= Inputs.GodMode;
                e.stopPropagation();
            });
        }

        for (const event of events_end) {
            this.level_up.addEventListener(event, e => {
                this.client.polyfight_canvas.inputs &= ~Inputs.LevelUp;
                e.stopPropagation();
            });
    
            this.switch_tank.addEventListener(event, e => {
                this.client.polyfight_canvas.inputs &= ~Inputs.SwitchTank;
                e.stopPropagation();
            });
    
            this.godmode.addEventListener(event, e => {
                this.client.polyfight_canvas.inputs &= ~Inputs.GodMode;
                e.stopPropagation();
            });
        }

        this.chat.addEventListener("click", e => {
            this.client.polyfight_canvas.chat_information.force_open = this.client.polyfight_canvas.chat_information.typing = !this.client.polyfight_canvas.chat_information.typing;
            if (!this.client.polyfight_canvas.chat_information.typing)
            {
                if (this.client.polyfight_elements.chat_input.value.length > 0) this.client.polyfight_connection.packet_handler.write_chat(this.client.polyfight_elements.chat_input.value);
                else {
                    this.client.polyfight_connection.packet_handler.write_type();
                }

                this.client.polyfight_elements.chat_input.value = "";
            } else {
                this.client.polyfight_connection.packet_handler.write_type();
            }

            this.chat_input.value = "";
            this.chat_input.style.display = this.client.polyfight_canvas.chat_information.typing ? "block" : "none";
            this.chat_input.focus();
        });

        this.suicide.addEventListener("click", e => {
            this.client.polyfight_canvas.inputs |= Inputs.Suicide;
        });

        this.shooting_mode.addEventListener("click", () => {
            this.real_shoot_mode = this.shooting_mode.innerText == "S" ? "R" : "S";
            this.client.polyfight_canvas.add_notification({ message: `Shooting Mode: ${this.real_shoot_mode == "R" ? "Repel" : "Shoot"}`, r: 0, g: 0, b: 0 })
            this.shooting_mode.innerText = this.real_shoot_mode;
        });

        this.teamedit_import.addEventListener("click", () =>
        {
            const team = prompt("Paste the team data here:");
            if (!team) return;

            try
            {
                const parsed = JSON.parse(team);
                if (!Array.isArray(parsed.tanks) || parsed.tanks.length !== 6) throw new Error("Invalid team data!");

                /** @ts-ignore */
                window.teams_state.teams[window.teams_state.team_idx] = parsed;
                /** @ts-ignore */
                localStorage.teams = JSON.stringify(window.teams_state);
                refresh_current_teams();
            }
            catch (er)
            {
                alert("Invalid team data!");
            }
        });

        this.teamedit_export.addEventListener("click", () =>
        {
            /** @ts-ignore */
            const team = window.teams_state.teams[window.teams_state.team_idx];
            prompt("Copy the text below to export your theme!", JSON.stringify(team));
        });


        this.ranked_checkbox.addEventListener("change", () =>
        {
            const value = this.ranked_checkbox.checked;
            this.client.polyfight_connection.packet_handler.write_ready(value);
        });

        this.team_new.addEventListener("click", () =>
        {
            refresh_current_teams();
            /** @ts-ignore */
            const teams_state = window.teams_state;
            
            const team = { name: `Team #${teams_state.teams.length + 1}`, tanks: new Array(6).fill({ name: "Basic Tank", build: "0/0/0/0/0/0/0/0/0" }) };
            teams_state.team_idx = teams_state.teams.push(team) - 1;
            localStorage.teams = JSON.stringify(teams_state);

            this.teambuilder_teams.style.display = "none";
            this.teambuilder_teams_buttons.style.display = "none";
            this.teambuilder_edit.style.display = "";
            this.teambuilder_teamedit_buttons.style.display = "";

            refresh_current_teams();
        });

        this.team_export.addEventListener("click", () =>
        {
            /** @ts-ignore */
            const team = window.teams_state;
            prompt("Copy the text below to export your team!", JSON.stringify(team));
        });

        this.team_import.addEventListener("click", () =>
        {
            const team = prompt("Paste the team data here:");
            if (!team) return;

            try
            {
                const parsed = JSON.parse(team);
                if (!Array.isArray(parsed.teams) && parsed.teams.find((team: any) => team.tanks.length != 6) != undefined) throw new Error("Invalid team data!");

                /** @ts-ignore */
                window.teams_state = parsed;
                /** @ts-ignore */
                localStorage.teams = JSON.stringify(window.teams_state);
                refresh_current_teams();
            }
            catch (er)
            {
                alert("Invalid team data!");
            }
        });

        this.teambuilder_modal.addEventListener("wheel", (e) => e.stopPropagation());

        this.settings_theme.addEventListener("click", () =>
        {
            this.settings_theme.classList.add("selected");
            this.settings_config.classList.remove("selected");
            this.settings_theme_content.style.display = "block";
            this.settings_config_content.style.display = "none";

            this.settings_config.style.display = this.client.polyfight_connection.is_host ? "block" : "none";
        });

        this.settings_config.addEventListener("click", () =>
        {
            this.settings_theme.classList.remove("selected");
            this.settings_config.classList.add("selected");
            this.settings_theme_content.style.display = "none";
            this.settings_config_content.style.display = "block";

            this.settings_config.style.display = this.client.polyfight_connection.is_host ? "block" : "none";
        });

        this.scoring.addEventListener("click", () =>
        {
            if (!this.scoring.classList.contains("selected"))
            {
                this.disconnect_server.click();
            }
            
            this.play_button.innerText = `Play as ${auth.currentUser.displayName || "guest"}`;

            this.scoring.classList.add("selected");
            this.ranked.classList.remove("selected");
            this.menu_scoring.style.display = "block";
            this.menu_1v1.style.display = "none";
        });

        this.new_server.addEventListener("click", async () =>
        {
            if (this.new_server.classList.contains("disabled")) return;
            
            /**
             * Multiple Options:
             * - Region Selection
             * - Public/Private
             */

            /** @ts-ignore */
            const result = await window.Swal.fire(
            {
                title: "Server Information",
                icon: "info",
                html: `
                <div style="display: flex; justify-content: center; align-items: center; flex-direction: column;">
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%">
                        <span>Region:</span>
                        <select style="color: black;" id="region-selector">
                            ${Object.keys(SERVER_URLS).map(x => `<option value="${x}">${SERVER_NAMES[x]}</option>`).join("\n")}
                        </select>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                        <span>Unlisted?</span>
                        <input type="checkbox" id="privacy-checkbox" />
                    </div>
                </div>
                `,
                confirmButtonText: "OK",
                showCloseButton: true,
                showCancelButton: true,
                cancelButtonText: "Cancel",
            });
            
            if (!result.isConfirmed) return;

            const region = (document.getElementById("region-selector") as HTMLSelectElement).options[(document.getElementById("region-selector") as HTMLSelectElement).selectedIndex].value;
            const isPrivate = (document.getElementById("privacy-checkbox") as HTMLInputElement).checked;

            /** @ts-ignore */
            let url = SERVER_URLS[region];
            url = url.replace("wss", "https").replace("ws", "http") + `/create_server?private=${isPrivate}`;

            const server_info = await (await fetch(url,
            {
                credentials: "include",
            })).text();

            try
            {
                const server = JSON.parse(server_info);
                /** @ts-ignore */
                window.arena_state["UNLISTED"] = server.private;

                this.client.polyfight_connection.servers.push({ ...server, region });
                window.location.hash = server.id + `?region=${region}`;
                this.reload_servers();
                refresh_current_arena();

                this.client.entity.first_server_spawn = true;

                this.copy_link.click();
            }
            catch (er)
            {
                /** @ts-ignore */
                window.Swal.fire({ icon: "error", title: "Error", text: server_info });
                return;
            }

            // fetch()
        });

        this.disconnect_server.addEventListener("click", async () =>
        {
            window.location.hash = "";
            await this.client.polyfight_connection.find_servers();
            this.reload_servers();
            this.client.entity.first_server_spawn = true;
        });

        this.copy_link.addEventListener("click", () =>
        {
            const id = window.location.hash.slice(1).split("?")[0] || this.client.polyfight_connection.polyfight_connection?.url.split("/")[0].split("?")[0];
            if (!id) return;

            /** @ts-ignore */
            window.Swal.fire(
            {
                title: "Copy the link below to share it with your friends!",
                icon: "info",
                confirmButtonText: "Copy",
                showCancelButton: false,
                showCloseButton: true,
                input: "text",
                inputValue: window.location.origin + `/#${id}?region=${this.client.polyfight_connection.current_server?.region.toLowerCase()}`,
                inputAttributes:
                {
                    readonly: true,
                    style: "text-align: center;"
                }
            })
            .then((result: any) =>
            {
                if (result.isConfirmed)
                {
                    navigator.clipboard.writeText(window.location.origin + `/#${id}?region=${this.client.polyfight_connection.current_server?.region.toLowerCase()}`);
                    /** @ts-ignore */
                    window.Swal.fire({ icon: "success", title: "Link copied to clipboard!" });
                }
            });
        });

        function rgbToHex(r: number, g: number, b: number) {
            return "#" + r.toString(16).padStart(2, "0") + g.toString(16).padStart(2, "0") + b.toString(16).padStart(2, "0");
        }          

        function hexToRgb(hex: string) {
            var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? `rgb(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)})` : null;
        }

        function generate_default_theme(name: string): { [key: string]: any }
        {
            const theme: { [key: string]: any } = { name };

            for (const option of THEME_CONFIG_OPTIONS)
            {
                let value;
                if (option.default.constructor === Array)
                {
                    value = option.default.map((x: any) => x instanceof Colour ? x.css : x);
                };

                theme[option.name] = value || (option.default instanceof Colour ? option.default.css : option.default);
            }

            return theme;
        };
        
        function parse_diep_style_theme(theme: ({ id?: number; value: any; cmd?: string })[]): { [key: string]: any }
        {
            /** @ts-ignore */
            const parsed: { [key: string]: any } = generate_default_theme(theme[0].theme.name);
            for (const colour of theme)
            {
                /** @ts-ignore */
                if (colour.theme) continue;

                /**
                 * net_replace_color 0 0x555555	Smasher and Dominator Bases
net_replace_color 1 0x999999	Barrels, Spawners, Launchers and Auto Turrets
net_replace_color 2 0x00B2E1	Body (You)
net_replace_color 3 0x00B2E1	Blue Team
net_replace_color 4 0xF14E54	Red Team
net_replace_color 5 0xBE7FF5	Purple Team
net_replace_color 5 0xC390D4	Purple Team (Makes purple team use its original first color)
net_replace_color 5 0xE77FF5	Purple Team (Makes purple team use its original second color)
net_replace_color 6 0x00E16E	Green Team
net_replace_color 6 0xD68165	Green Team (Making Green Team Brown, like it was formerly)
net_replace_color 7 0x8AFF69	Shiny Polygons (Green Square, Green Triangle, Green Pentagon)
net_replace_color 8 0xFFE869	Square
net_replace_color 9 0xFC7677	Triangle
net_replace_color 10 0x768DFC	Pentagon
net_replace_color 11 0xF177DD	Crashers
net_replace_color 12 0xFFE869	Arena Closers/Neutral Dominators/Defender Ammo
net_replace_color 12 0xA0A0A0	Neutral Team (Makes neutral team use its original color)
net_replace_color 13 0x43FF91	Scoreboard
net_replace_color 14 0xBBBBBB	Maze Walls
net_replace_color 15 0xF14E54	Others (FFA)
net_replace_color 16 0xFCC376	Summoned Squares (Necromancer and Summoner)
net_replace_color 17 0xC0C0C0	Fallen Bosses, Sleeping Arena Closers
                 */
                switch (colour.id)
                {
                    // case 0: continue; // not present
                    case 1: parsed["TURRET_FILL"] = hexToRgb(`#${colour.value}`); break;
                    case 2: parsed["PLAYER_FILL"] = hexToRgb(`#${colour.value}`); break;
                    // case 3: parsed["BLUE_FILL"] = colour.value; break;
                    // case 4: parsed["RED_FILL"] = colour.value; break;
                    // case 5: parsed["PURPLE_FILL"] = colour.value; break;
                    // case 6: parsed["GREEN_FILL"] = colour.value; break;
                    case 7: parsed["SHINY_FILL"] = hexToRgb(`#${colour.value}`); break;
                    case 8: parsed["SQUARE_FILL"] = hexToRgb(`#${colour.value}`); break;
                    case 9: parsed["TRIANGLE_FILL"] = hexToRgb(`#${colour.value}`); break;
                    case 10: parsed["PENTAGON_FILL"] = hexToRgb(`#${colour.value}`); break;
                    case 11: parsed["CRASHER_FILL"] = hexToRgb(`#${colour.value}`); break;
                    // case 12: parsed["DOMINATOR_FILL"] = colour.value; break;
                    // case 13: parsed["SCORE_BAR_FILL"] = colour.value; break;
                    // case 14: parsed["WALL_FILL"] = colour.value; break;
                    case 15: parsed["ENEMY_FILL"] = hexToRgb(`#${colour.value}`); break;
                    // case 16: parsed["SUMMONER_FILL"] = colour.value; break;
                    // case 17: parsed["BOSS_FILL"] = colour.value; break;
                }

                switch (colour.cmd)
                {
                    case "ren_xp_bar_fill_color": parsed["XP_BAR_FILL"] = hexToRgb(`#${colour.value}`); break;
                    case "ren_score_bar_fill_color": parsed["SCORE_BAR_FILL"] = hexToRgb(`#${colour.value}`); break;
                    case "ren_bar_background_color":
                    {
                        parsed["XP_BAR_BACKGROUND"] = parsed["SCORE_BAR_BACKGROUND"] = hexToRgb(`#${colour.value}`);
                        break;
                    }
                    case "stroke_soft_color_intensity": parsed["STROKE_INTENSITY"] = +colour.value; break;
                    case "ren_grid_color": parsed["GRID"] = hexToRgb(`#${colour.value}`); break;
                    case "ren_health_background_color": parsed["HEALTH_BAR_BACKGROUND"] = hexToRgb(`#${colour.value}`); break;
                    case "ren_health_fill_color":
                    {
                        parsed["LOW_HEALTH_BAR"] = parsed["MEDIUM_HEALTH_BAR"] = parsed["HIGH_HEALTH_BAR"] = hexToRgb(`#${colour.value}`); break;
                    }
                    case "ren_background_color": parsed["INBOUNDS_FILL"] = hexToRgb(`#${colour.value}`); break;
                    case "ren_border_color":
                    {
                        parsed["OUTBOUNDS"] = hexToRgb(`#${colour.value}`); break;
                    }
                    case "border_color_alpha": parsed["OUTBOUNDS_OPACITY"] = +colour.value; break;
                    case "ren_minimap_background_color": parsed["MINIMAP_BACKGROUND"] = hexToRgb(`#${colour.value}`); break;
                    case "ren_minimap_border_color": parsed["MINIMAP_BORDER"] = hexToRgb(`#${colour.value}`); break;
                    case "grid_base_alpha": parsed["GRID_ALPHA"] = +colour.value; break;
                    case "ui_replace_colors":
                    {
                        const values = colour.value.map((x: string) => hexToRgb(`#${x}`));
                        parsed["UPGRADES"] = [...values, hexToRgb("#2C2EDF")];
                    }
                }
            }

            parsed["INBOUNDS_OUTLINE"] = parsed["OUTBOUNDS"];

            return parsed;
        }

        if (!window.localStorage.getItem("themes"))
        {
            // console.log(theme.theme);
            window.localStorage.setItem("themes", JSON.stringify(theme.theme));
            window.localStorage.setItem("theme_index", "0");
        }

        const themes = JSON.parse(window.localStorage.getItem("themes")!);
        for (let i = 0; i < themes.length; ++i)
        {
            const theme = themes[i];

            const theme_keys = Object.keys(theme);
            const unknown_keys = THEME_CONFIG_OPTIONS.map(x => x.name).filter(x => !theme_keys.includes(x));

            for (const key of unknown_keys)
            {
                let value = THEME_CONFIG_OPTIONS.find(x => x.name == key)!.default;
                if (value instanceof Colour) theme[key] = value.css;
                else theme[key] = value;
            }

            const ordered = THEME_CONFIG_OPTIONS.map(x => x.name).reduce(
                (obj: any, key) => { 
                  obj[key] = theme[key];
                  return obj;
                }, 
                {}
            );
            ordered.name = theme.name;

            themes[i] = ordered;

            const option = document.createElement("option");
            option.style.color = "black";
            option.value = theme.name;
            option.text = theme.name;
            this.themes_dropdown.add(option);
        }

        localStorage.setItem("themes", JSON.stringify(themes));

        this.themes_dropdown.selectedIndex = parseInt(window.localStorage.getItem("theme_index") || "0");
        /** @ts-ignore */
        let old_name = this.theme_name.value = this.themes_dropdown.children[this.themes_dropdown.selectedIndex].value;

        /** @ts-ignore */
        window.theme_state = themes[this.themes_dropdown.selectedIndex];

        const refresh_current_theme = () =>
        {
            this.theme_colours.innerHTML = "";
            /** @ts-ignore */
            window.theme_state = JSON.parse(window.localStorage.getItem("themes")!)[this.themes_dropdown.selectedIndex];

            /** @ts-ignore */
            for (const [key, value] of Object.entries(window.theme_state))
            {
                if (key == "name" || key.endsWith("_STROKE")) continue;

                const option = THEME_CONFIG_OPTIONS.find(x => x.name == key);

                const entry = document.createElement("div"); 
                entry.id = "color-entry";

                const span = document.createElement("span");
                span.classList.add("entry-name");
                span.innerText = option?.prettified_name || key;

                entry.appendChild(span);

                const input = document.createElement("input");

                if (option!.default.constructor === Array)
                {
                    for (let i = 0; i < (value as any[]).length; ++i)
                    {
                        const element = (value as any[])[i];

                        if (element.startsWith("rgb"))
                        {
                            const cp_wrapper = document.createElement("div");
                            cp_wrapper.classList.add("cp-wrapper");
        
                            const input = document.createElement("input");

                            input.type = "color";
                            input.classList.add("color-input");
                            /** @ts-ignore */
                            const [r, g, b] = element.match(/\d+/g)!.map(Number);
                            input.value = rgbToHex(r, g, b);
        
                            input.addEventListener("focusout", e => {
                                /** @ts-ignore */
                                window.theme_state[key][i] = hexToRgb(input.value);
                                const themes = JSON.parse(window.localStorage.getItem("themes")!);
                                /** @ts-ignore */
                                themes[this.themes_dropdown.selectedIndex] = window.theme_state;
                                window.localStorage.setItem("themes", JSON.stringify(themes));

                                refresh_current_theme();
                            });
        
                            cp_wrapper.appendChild(input);
                            entry.appendChild(cp_wrapper);
                        }
                        else if (option!.type == ConfigOptionTypes.ConstantText)
                        {
                            const span: HTMLSpanElement = document.createElement("span");
                            span.innerText = value as string;
                            entry.appendChild(span);
                        }
                        else if (option!.type == ConfigOptionTypes.Boolean)
                        {
                            const input = document.createElement("input");
                            input.type = "checkbox";
                            /** @ts-ignore */
                            input.checked = element;
        
                            input.addEventListener("change", () => {
                                /** @ts-ignore */
                                window.theme_state[key][i] = input.checked;
                                const themes = JSON.parse(window.localStorage.getItem("themes")!);
                                /** @ts-ignore */
                                themes[this.themes_dropdown.selectedIndex] = window.theme_state;
                                window.localStorage.setItem("themes", JSON.stringify(themes));

                                refresh_current_theme();
                            });
        
                            entry.appendChild(input);
                        }
                        else if (option!.type == ConfigOptionTypes.Number)
                        {
                            const input = document.createElement("input");

                            input.style.width = "150px";
                            input.type = "range";
                            /** @ts-ignore */
                            input.min = option!.min;
                            /** @ts-ignore */
                            input.max = option!.max;
                            /** @ts-ignore */
                            input.step = option!.step;
                            /** @ts-ignore */
                            input.value = element;
        
                            span.innerText += ` [${element}]`;
        
                            input.addEventListener("change", () => {
                                /** @ts-ignore */
                                window.theme_state[key][i] = parseFloat(input.value);
                                span.innerText = key + ` [${input.value}]`;
                                const themes = JSON.parse(window.localStorage.getItem("themes")!);
                                /** @ts-ignore */
                                themes[this.themes_dropdown.selectedIndex] = window.theme_state;
                                window.localStorage.setItem("themes", JSON.stringify(themes));

                                refresh_current_theme();
                            });
        
                            entry.appendChild(input);
                        }
                    }
                }
                else if (option!.type == ConfigOptionTypes.ConstantText)
                {
                    const span: HTMLSpanElement = document.createElement("span");
                    span.innerText = value as string;
                    entry.appendChild(span);
                }
                else if (option!.default instanceof Colour)
                {
                    const cp_wrapper = document.createElement("div");
                    cp_wrapper.classList.add("cp-wrapper");

                    input.type = "color";
                    input.classList.add("color-input");
                    /** @ts-ignore */
                    const [r, g, b] = value.match(/\d+/g)!.map(Number);
                    input.value = rgbToHex(r, g, b);

                    input.addEventListener("focusout", e => {
                        /** @ts-ignore */
                        window.theme_state[key] = hexToRgb(input.value);
                        const themes = JSON.parse(window.localStorage.getItem("themes")!);
                        /** @ts-ignore */
                        themes[this.themes_dropdown.selectedIndex] = window.theme_state;
                        window.localStorage.setItem("themes", JSON.stringify(themes));

                        refresh_current_theme();
                    });

                    cp_wrapper.appendChild(input);
                    entry.appendChild(cp_wrapper);
                }
                else if (option!.type == ConfigOptionTypes.Boolean || [true, false].includes(option!.default as boolean))
                {
                    const input = document.createElement("input");
                    input.type = "checkbox";
                    /** @ts-ignore */
                    input.checked = value;

                    input.addEventListener("change", () => {
                        /** @ts-ignore */
                        window.theme_state[key] = input.checked;
                        const themes = JSON.parse(window.localStorage.getItem("themes")!);
                        /** @ts-ignore */
                        themes[this.themes_dropdown.selectedIndex] = window.theme_state;
                        window.localStorage.setItem("themes", JSON.stringify(themes));

                        refresh_current_theme();
                    });

                    entry.appendChild(input);
                }
                else if (option!.type == ConfigOptionTypes.Number)
                {
                    input.style.width = "150px";
                    input.type = "range";
                    /** @ts-ignore */
                    input.min = option!.min;
                    /** @ts-ignore */
                    input.max = option!.max;
                    /** @ts-ignore */
                    input.step = option!.step;
                    /** @ts-ignore */
                    input.value = value;

                    span.innerText += ` [${value}]`;

                    input.addEventListener("change", () => {
                        /** @ts-ignore */
                        window.theme_state[key] = parseFloat(input.value);
                        span.innerText = key + ` [${input.value}]`;
                        const themes = JSON.parse(window.localStorage.getItem("themes")!);
                        /** @ts-ignore */
                        themes[this.themes_dropdown.selectedIndex] = window.theme_state;
                        window.localStorage.setItem("themes", JSON.stringify(themes));

                        refresh_current_theme();
                    });

                    entry.appendChild(input);
                }


                this.theme_colours.appendChild(entry);
            }

            /** @ts-ignore */
            this.theme_name.value = window.theme_state.name;
            /** @ts-ignore */
            this.themes_dropdown.children[this.themes_dropdown.selectedIndex].value = window.theme_state.name;

            /** @ts-ignore */
            document.body.style.backgroundColor = window.theme_state.INBOUNDS_FILL;

            refresh_config();
            this.client.polyfight_canvas.generate_spritesheet();
        };

        /** @ts-ignore */
        window.arena_state = ARENA_CONFIG.reduce((obj, x) => { obj[x.name] = x.default; return obj; }, {});

        const refresh_current_arena = () =>
        {
            this.client.polyfight_connection.packet_handler.write_arena_update();
            this.arena_config.innerHTML = "";

            for (const option of ARENA_CONFIG)
            {
                if (option.type == ConfigOptionTypes.Header || option.type == ConfigOptionTypes.Subheader)
                {
                    const entry = document.createElement("span");
                    entry.id = option.type == ConfigOptionTypes.Header ? "config-header" : "config-subheader";
                    entry.innerText = option.prettified_name || (option.default as string);

                    this.arena_config.appendChild(entry);
                }
                else
                {
                    const entry = document.createElement("div");
                    entry.id = "config-entry";
    
                    const span = document.createElement("span");
                    span.classList.add("entry-name");
                    span.innerText = option.prettified_name;
    
                    entry.appendChild(span);
    
                    const input = document.createElement("input");
                    input.style.width = "150px";
    
                    if (option.type == ConfigOptionTypes.ConstantText)
                    {
                        const span: HTMLSpanElement = document.createElement("span");
                        span.innerText = option.default as unknown as string;
                        entry.appendChild(span);
                    }
                    else if (option.type == ConfigOptionTypes.Colour)
                    {
                        const cp_wrapper = document.createElement("div");
                        cp_wrapper.classList.add("cp-wrapper");
    
                        input.type = "color";
                        input.classList.add("color-input");
                        /** @ts-ignore */
                        const [r, g, b] = option.default.match(/\d+/g)!.map(Number);
                        input.value = rgbToHex(r, g, b);
    
                        input.addEventListener("focusout", e => {
                            /** @ts-ignore */
                            window.arena_state[option.name] = hexToRgb(input.value);
                            refresh_current_arena();
                        });
    
                        cp_wrapper.appendChild(input);
                        entry.appendChild(cp_wrapper);
                    }
                    else if (option.type == ConfigOptionTypes.Boolean)
                    {
                        input.type = "checkbox";
                        /** @ts-ignore */
                        input.checked = window.arena_state[option.name];
    
                        input.addEventListener("change", () => {
                            /** @ts-ignore */
                            window.arena_state[option.name] = input.checked;
                            refresh_current_arena();
                        });
    
                        entry.appendChild(input);
                    }
                    else if (option.type == ConfigOptionTypes.Number)
                    {
                        input.type = "range";
                        /** @ts-ignore */
                        input.min = option.min;
                        /** @ts-ignore */
                        input.max = option.max;
                        /** @ts-ignore */
                        input.step = option.step;
                        /** @ts-ignore */
                        input.value = window.arena_state[option.name];
                        /** @ts-ignore */
                        span.innerText += ` [${window.arena_state[option.name] = input.value}]`;
    
                        input.addEventListener("change", () => {
                            /** @ts-ignore */
                            window.arena_state[option.name] = parseFloat(input.value);
                            span.innerText = option.name + ` [${input.value}]`;
                            refresh_current_arena();
                        });
    
                        entry.appendChild(input);
                    }
    
                    this.arena_config.appendChild(entry);
                }
            }
        };

        /** @ts-ignore */
        window.teams_state = {};
        
        /** @ts-ignore */
        const refresh_current_teams = window.refresh_current_teams = () =>
        {
            if (!localStorage.teams)
            {
                const teams = { name: "Default Team [click to edit]", tanks: new Array(6).fill({ name: "Basic Tank", build: "0/0/0/0/0/0/0/0/0" }) };
                localStorage.teams = JSON.stringify({ team_idx: 0, teams: [teams] });
            }
            /** @ts-ignore */
            const teams_state = window.teams_state = JSON.parse(localStorage.teams || "{}");

            /** @ts-ignore */
            const spritesheet = window.spritesheet;

            const selected_team = teams_state.teams[teams_state.team_idx];
            this.set.innerHTML = `
            <b>${selected_team.name}</b>
            <div id="tanks">
                ${selected_team.tanks.map((t: any) => `<img src="${spritesheet}#${t.name}" height="60" width="60" />`).join("\n")}
            </div>
            `.trim();

            const teambox_html = [];

            for (let i = 0; i < teams_state.teams.length; ++i)
            {
                const team = teams_state.teams[i];

                teambox_html.push(`
                    <div class="teambox${i == teams_state.team_idx ? (" selected") : ""}" id="teambox-${i}"
                        onmouseover="document.getElementById('teambox-icons-${i}').style.display = 'flex';" 
                        onmouseout="document.getElementById('teambox-icons-${i}').style.display = 'none';"
                    >
                        <b>${team.name}</b>
                        <div class="teambox-icons" id="teambox-icons-${i}">
                            <button class="teambox-icon" id="teambox-select">
                                <i class="fa-solid fa-check" style="text-align: center;"></i>
                            </button>
                            <button class="teambox-icon" id="teambox-delete">
                                <i class="fa-solid fa-trash" style="text-align: center;"></i>
                            </button>
                            <button class="teambox-icon" id="teambox-edit">
                                <i class="fa-solid fa-pencil" style="text-align: center;"></i>
                            </button>
                        </div>
                        <div id="tanks">
                            ${team.tanks.map((t: any) => `<img src="${spritesheet}#${t.name}" height="60" width="60" />`).join("\n")}
                        </div>
                    </div>
                `.trim());
            }

            this.teambuilder_teams.innerHTML = teambox_html.join("\n");

            for (let i = 0; i < this.teambuilder_teams.children.length; ++i)
            {
                const team = this.teambuilder_teams.children[i];
                
                team.addEventListener("click", () =>
                {
                    teams_state.team_idx = Array.from(this.teambuilder_teams.children).indexOf(team);
                    localStorage.teams = JSON.stringify(teams_state);
                    refresh_current_teams();
                });

                const icons = team.children[1];
                const [select, del, edit] = icons.children;

                select.addEventListener("click", (event) =>
                {
                    event.stopPropagation();
                    teams_state.team_idx = Array.from(this.teambuilder_teams.children).indexOf(team);
                    localStorage.teams = JSON.stringify(teams_state);
                    refresh_current_teams();
                });

                del.addEventListener("click", (event) =>
                {
                    event.stopPropagation();
                    if (teams_state.teams.length == 1) return alert("You cannot delete your last team.");

                    const result = confirm("Are you sure you want to delete this team?");
                    if (!result) return;

                    teams_state.teams.splice(Array.from(this.teambuilder_teams.children).indexOf(team), 1);
                    if (teams_state.team_idx >= teams_state.teams.length) teams_state.team_idx = teams_state.teams.length - 1;
                    localStorage.teams = JSON.stringify(teams_state);
                    refresh_current_teams();
                });

                edit.addEventListener("click", (event) =>
                {                    
                    event.stopPropagation();

                    teams_state.team_idx = i;
                    localStorage.teams = JSON.stringify(teams_state);

                    this.teambuilder_teams.style.display = "none";
                    this.teambuilder_teams_buttons.style.display = "none";
                    this.teambuilder_edit.style.display = "";
                    this.teambuilder_teamedit_buttons.style.display = "";

                    refresh_current_teams();
                });

                (() =>
                {
                    const team = teams_state.teams[teams_state.team_idx];

                    const datalist = `
                    <datalist id="tank-name-input-list">
                        ${TANK_DEFS.filter((t: any) => t.category != TankCategories.Illegal).map((x: any) => `<option value="${x.name}" />`).join("\n")}
                    </datalist>
                    `.trim();
    
                    const build_entries_html: Array<string> = [];
                    for (let j = 0; j < team.tanks.length; ++j)
                    {
                        const tank = team.tanks[j];
                        const build = tank.build.split("/").map((x: string) => +x);
                        const tankdef = TANK_DEFS.find((t: any) => t.name == tank.name);
                        const used_stats = build.reduce((a: number, b: number) => a + b);
    
                        build_entries_html.push(`
                            <div class="build-entry">
                                <span class="stroke">x${33 - used_stats}</span>
                                ${tankdef?.max_stats.map((stat: any, k: number) => (
                                    stat == 0 ? "" :
                                    `<div class="stat-entry">
                                        <div class="stat-buttons">
                                            <button class="remove-stat" onclick="(() => {
                                                const i = ${teams_state.team_idx};
                                                const j = ${j};
                                                const k = ${k};
                                                
                                                const build = window.teams_state.teams[i].tanks[j].build.split('/');
                                                const newDigit = Math.min( Math.max(0, (+build[k] - 1)), ${stat} ).toString();
                                                build[k] = newDigit;

                                                window.teams_state.teams[i].tanks[j].build = build.join('/');
                                                localStorage.teams = JSON.stringify(window.teams_state);
    
                                                window.refresh_current_teams();
                                            })();">-</button>
                                            
                                            ${(33 - used_stats) > 0 ? `<button class="add-stat" onclick="(() => {
                                                const i = ${teams_state.team_idx};
                                                const j = ${j};
                                                const k = ${k};
                
                                                const build = window.teams_state.teams[i].tanks[j].build.split('/');

                                                const newDigit = Math.min( Math.max(0, (+build[k] + 1)), ${stat} ).toString();
                                                build[k] = newDigit;
                                                
                                                window.teams_state.teams[i].tanks[j].build = build.join('/');
                                                localStorage.teams = JSON.stringify(window.teams_state);
    
                                                window.refresh_current_teams();
                                            })();">+</button>`: ""}
                                        </div>
                                        <div class="progress-bar-wrapper">
                                            <div style="background: ${THEME_CONFIG.UPGRADES[k].css}; height: 100%; width: ${build[k] / stat * 100}%; transition: all ease 0.3s;"></div>
                                            <span class="progress-bar-text stroke">${UpgradeStats[k].replace(/([A-Z])/g, ' $1').trim() + ` [${build[k]}]`}</span>
                                        </div>
                                    </div>`
                                )).join("\n")}
                            </div>
                        `.trim());
                    }
    
                    let team_editor = `
                    <input id="team-name-input" type="text" placeholder="Enter team name..." maxlength="12" value="${team.name}" onfocusout="(() => {
                        const input = document.getElementById('team-name-input');
                        window.teams_state.teams[${teams_state.team_idx}].name = input.value;
                        localStorage.teams = JSON.stringify(window.teams_state);
                        window.refresh_current_teams();
                    })()">
                    
                    <div class="team-tanks">
                        ${team.tanks.map((tank: any, j: number) => (
                            `<div class="team-tank-entry">
                                <div style="display: flex; flex-direction: column; justify-content: center; align-items: center;">
                                    <span style="color: ${THEME_CONFIG.UPGRADES[TANK_DEFS.find((t: any) => t.name == tank.name)!.category].css}"> 
                                        ${TankCategories[TANK_DEFS.find((t: any) => t.name == tank.name)!.category]} Category
                                    </span>
                                    ${/** @ts-ignore */ ""}
                                    <img src="${window.spritesheet || "assets/images/spritesheet.svg"}#${tank.name}" height="200" width="200">
                                    <input id="tni-${j}" class="tank-name-input" list="tank-name-input-list" type="text" placeholder="Enter tank name..." maxlength="12" value="${tank.name}" oninput="((e) => {
                                        const input = document.getElementById('tni-${j}');
                                        const tanks = [${TANK_DEFS.filter((t: any) => t.category != TankCategories.Illegal).map((x: any) => x.name).map(x => `\'${x}\'`).join(", ")}];
                                        const tank = tanks.find(x => x.trim().toLowerCase() == input.value.trim().toLowerCase());
                                        if (!tank) return;
                                    })()" onfocusout="(() => {
                                        const input = document.getElementById('tni-${j}');
                                        const tanks = [${TANK_DEFS.filter((t: any) => t.category != TankCategories.Illegal).map((x: any) => x.name).map(x => `\'${x}\'`).join(", ")}];
                                        const tank = tanks.find(x => x.trim().toLowerCase() == input.value.trim().toLowerCase());
                                        if (!tank)
                                        {
                                            input.value = window.teams_state.teams[${teams_state.team_idx}].tanks[${j}].name;
                                            return;
                                        }

                                        window.teams_state.teams[${teams_state.team_idx}].tanks[${j}].name = tank;
                                        window.teams_state.teams[${teams_state.team_idx}].tanks[${j}].build = '0/0/0/0/0/0/0/0/0';
                                        localStorage.teams = JSON.stringify(window.teams_state);
                                        window.refresh_current_teams();
                                    })()">
                                    ${datalist}
                                </div>
    
                                ${build_entries_html[j]}
                            </div>`
                        )).join("\n")}
                    </div>
                    `.trim();
    
                    this.teambuilder_edit.innerHTML = team_editor;
                })();
            }
        };

        refresh_current_theme();
        refresh_current_arena();
        refresh_current_teams();

        this.new_theme.addEventListener("click", () =>
        {
            const themes = JSON.parse(window.localStorage.getItem("themes")!);
            const theme = generate_default_theme("Theme " + (themes.length + 1));
            themes.push(theme);

            const option = document.createElement("option");
            option.style.color = "black";
            option.value = option.text = theme.name;
            this.themes_dropdown.add(option);

            window.localStorage.setItem("themes", JSON.stringify(themes));
            this.themes_dropdown.selectedIndex = this.themes_dropdown.length - 1;
            window.localStorage.setItem("theme_index", this.themes_dropdown.selectedIndex.toString());
            this.theme_name.value = theme.name;

            refresh_current_theme();
        });


        this.theme_name.addEventListener("keyup", () =>
        {
            if (this.theme_name.value.length == 0) this.theme_name.value = old_name;

            const themes = JSON.parse(window.localStorage.getItem("themes")!);
            const theme = themes[this.themes_dropdown.selectedIndex];
            const option = this.themes_dropdown.children[this.themes_dropdown.selectedIndex] as HTMLOptionElement;

            option.value = option.text = theme.name = this.theme_name.value;

            window.localStorage.setItem("themes", JSON.stringify(themes));
            old_name = this.theme_name.value;
        });

        this.themes_dropdown.addEventListener("change", (event) =>
        {
            const themes = JSON.parse(window.localStorage.getItem("themes")!);
            const theme = themes[this.themes_dropdown.selectedIndex];

            this.theme_name.value = theme.name;
            window.localStorage.setItem("theme_index", this.themes_dropdown.selectedIndex.toString());
            refresh_current_theme();

            // for (const option of CONFIG_OPTIONS)
            // {
            //     if (option.name == "name") continue;
            //     const element = document.getElementById(option.name)! as HTMLInputElement;
            //     if (element.type == "color") element.value = theme[option.name];
            //     else element.value = theme[option.name];
            // }
        });

        this.export_theme.addEventListener("click", () =>
        {
            /** @ts-ignore */
            window.Swal.fire({
                icon: "info",
                title: "Export Theme",
                text: "Copy this theme to your clipboard:",
                input: "text",
                /** @ts-ignore */
                inputValue: JSON.stringify(window.theme_state),
                showCancelButton: false,
                confirmButtonText: "Copy",
                inputAttributes: {
                    readonly: true,
                    style: "text-align: center;"
                }
            })
            .then((result: any) => {
                if (result.isConfirmed)
                {
                    /** @ts-ignore */
                    navigator.clipboard.writeText(JSON.stringify(window.theme_state));
                    /** @ts-ignore */
                    window.Swal.fire("Copied!", "The theme has been copied to your clipboard.", "success");
                }
            });
        });

        this.import_theme.addEventListener("click", async () =>
        {
            /** @ts-ignore */
            const { value: theme } = await window.Swal.fire(
            {
                icon: "info",
                title: "Import Theme",
                text: "Paste the theme you want to import here:",
                input: "text",
                showCancelButton: true,
                confirmButtonText: "Import",
                inputValidator(value: string)
                {
                    try
                    {
                        if (JSON.parse(value) == null) return "Invalid JSON.";
                    } 
                    catch (error)
                    {
                        return "Invalid JSON.";
                    }
                }
            });

            if (theme == null) return;

            try
            {
                const parsed = JSON.parse(theme);

                if (parsed[0]?.theme)
                {
                    const themes = JSON.parse(window.localStorage.getItem("themes")!);
                    parsed.name = this.theme_name.value;
                    themes[this.themes_dropdown.selectedIndex] = parse_diep_style_theme(parsed);
                    window.localStorage.setItem("themes", JSON.stringify(themes));
                }
                else
                {
                    const themes = JSON.parse(window.localStorage.getItem("themes")!);
                    themes[this.themes_dropdown.selectedIndex] = parsed;
                    window.localStorage.setItem("themes", JSON.stringify(themes));
                }

                this.theme_name.value = parsed.name;
                refresh_current_theme();
            } 
            catch (error)
            {
                alert("Invalid theme.");
            }
        });

        this.delete_theme.addEventListener("click", () =>
        {
            if (this.themes_dropdown.length == 1) return alert("You cannot delete your last theme.");

            let result = confirm("Are you sure you want to delete this theme? This action cannot be undone.");
            if (!result) return;

            const themes = JSON.parse(window.localStorage.getItem("themes")!);
            themes.splice(this.themes_dropdown.selectedIndex, 1);
            window.localStorage.setItem("themes", JSON.stringify(themes));

            this.themes_dropdown.remove(this.themes_dropdown.selectedIndex);
            this.themes_dropdown.selectedIndex = 0;
            window.localStorage.setItem("theme_index", "0");

            old_name = this.theme_name.value = themes[0].name;

            refresh_current_theme();
        });

        this.clan_textbox.addEventListener("keydown", (event: KeyboardEvent) =>
        {
            if (event.key == "Enter" && this.clan_textbox.value.length > 0)
            {
                this.client.polyfight_connection.packet_handler.write_clan(0, this.clan_textbox.value);
                this.clan_textbox.value = "";
            };
        });

        this.clan_create.addEventListener("click", () =>
        {
            if (this.clan_create.innerText.includes("Create") && this.clan_textbox.value.length > 0)
            {
                this.client.polyfight_connection.packet_handler.write_clan(0, this.clan_textbox.value);
                this.clan_textbox.value = "";
            }
            else if (this.clan_create.innerText.includes("Leave"))
            {
                this.client.polyfight_connection.packet_handler.write_clan(2);
            };
        });

        this.google_signin.addEventListener("click", () =>
        {
            if (this.google_signin.innerText == "Sign out")
            {
                signOut(auth)
                    .then(() => (this.google_signin.innerText = "Sign in with Google"))
                    .catch((error: any) => alert("Uh oh! Something went wrong. " + error.message + ` [${error.code}]`));
            }
            else
            {
                signInWithPopup(auth, provider)
                    .catch((error: any) => alert("Uh oh! Something went wrong. " + error.message + ` [${error.code}]`));
            }
        });

        let initial = false;
        onAuthStateChanged(auth, async (user: any) =>
        {
            if (!initial)
            {
                this.reload_servers();
                initial = true;
            }

            if (user)
            {
                document.cookie = `token=${await user.getIdToken()}; expires=Fri, 31 Dec 9999 23:59:59 GMT; path=/;`;

                this.new_server.classList.remove("disabled");
                // delete this.new_server.dataset.tooltip;
                this.new_server.onclick = null;
                this.ranked.onclick = this.ranked_onclick.bind(this, false);

                this.clan_button.classList.remove("disabled");
                this.google_signin.innerText = "Sign out";
                this.play_button.innerText = "Play as " + user.displayName;


                fetch(`${SERVER_URLS[this.client.polyfight_connection.preferred_region].replace("wss", "https").replace("ws", "http")}/is_registered`,
                {
                    method: "GET",
                    credentials: "include"
                })
                    .then(async r =>
                    {
                        if (r.status == 400)
                        {
                            const message = await r.text();

                            /** @ts-ignore */
                            await window.Swal.fire({
                                icon: "error",
                                title: "Error",
                                text: message
                            });
                        }
                        else if (r.status == 404)
                        {
                            await this.choose_name();
                        }
                    })
            }
            else
            {
                document.cookie = "";

                this.new_server.classList.add("disabled");
                // this.new_server.dataset.tooltip = "Log into Google to create a new server.";
                this.new_server.onclick = this.new_server_on_click.bind(this);
                this.ranked.onclick = this.ranked_onclick.bind(this, true);

                this.clan_button.classList.remove("disabled");
                // this.clan_button.classList.add("disabled");
                this.google_signin.innerText = "Sign in with Google";
                this.play_button.innerText = "Play as guest";
            };
        });

        this.client.polyfight_canvas.minimap_canvas.addEventListener("click", () =>
        {
            this.client.polyfight_connection.packet_handler.write_clan(5);
        });

        if (!window.localStorage.getItem("has_visited"))
        {
            window.localStorage.setItem("has_visited", "1");
            this.info_button_on_click();
        }

        if (!localStorage.has_seen_trailer) {
            localStorage.has_seen_trailer = true;
            this.discord_button_on_click();
        }
        
        window.addEventListener("beforeunload", (e: BeforeUnloadEvent) => {
            const confirmationMessage = "Are you sure you want to leave? You will lose your progress.";
        
            (e || window.event).returnValue = confirmationMessage;
            return confirmationMessage;
        });
        
        window.addEventListener("contextmenu", (event: MouseEvent) => event.preventDefault());
        window.addEventListener("mousemove", (event: MouseEvent) =>
        {
            let is_zoom = this.client.entity.identity_id == EntityIdentityIds.Predator && ((this.client.polyfight_canvas.inputs & Inputs.Repel) == Inputs.Repel);

            if (this.client.polyfight_canvas.auto_spin == SpinType.None && this.client.entity.identity.rotators === undefined && !this.client.polyfight_canvas.lock_mouse)
            {
                this.client.polyfight_canvas.mouse.x = event.clientX * window.devicePixelRatio - (this.client.polyfight_canvas.canvas.width / 2);
                this.client.polyfight_canvas.mouse.y = event.clientY * window.devicePixelRatio - (this.client.polyfight_canvas.canvas.height / 2);

                const canvas_transform = this.client.polyfight_canvas.canvas_transform;
                const absolute_position = new Vector(canvas_transform.a * this.client.entity.position.x + canvas_transform.e, canvas_transform.d * this.client.entity.position.y + canvas_transform.f);

                if (is_zoom)
                {   
                    // this.client.canvas.mouse.x -= absolute_position.x;
                    // this.client.canvas.mouse.y -= absolute_position.y;
                }

                const translated_mouse = this.client.polyfight_canvas.mouse.clone.add(new Vector(this.client.polyfight_canvas.canvas.width / 2, this.client.polyfight_canvas.canvas.height / 2));
                const inverse_transform = this.client.polyfight_canvas.canvas_transform.inverse();
                const mouse = new Vector(inverse_transform.a * translated_mouse.x + inverse_transform.e, inverse_transform.d * translated_mouse.y + inverse_transform.f);

                this.client.entity.target_angle = this.client.entity.angle = mouse.angle(this.client.entity.position);
            }

            
            // Stats buttons.
            let x = event.clientX - this.client.polyfight_canvas.stats_canvas.getBoundingClientRect().left;
            let y = event.clientY - this.client.polyfight_canvas.stats_canvas.getBoundingClientRect().top;

            // check if mouse is hovering over the canvas
            if (x < 0 || x > this.client.polyfight_canvas.stats_canvas.width || y < 0 || y > this.client.polyfight_canvas.stats_canvas.height)
            {
                this.client.polyfight_canvas.stats.target_opacity = 1;
            }
            else
            {
                this.client.polyfight_canvas.stats.target_opacity = 0;
            };

            const buttons = this.client.polyfight_canvas.stats_buttons;
            let hovering = false;

            for (const button of buttons)
            {
                if (!button || button.disabled) continue;

                let translated_x = x - button.x;
                let translated_y = y - button.y;

                if (translated_x > 0 && translated_x < button.width && translated_y > 0 && translated_y < button.height)
                {
                    button.hovered = true; hovering = true;
                    this.client.polyfight_canvas.stats_canvas.style.cursor = "pointer";
                    return;
                } else button.hovered = false;
            }

            // Upgrade tank buttons.
            if (this.client.polyfight_canvas.upgrade_tanks.current_upgrades.length != 0)
            {
                let u_hover = false;
                let ux = event.clientX - this.client.polyfight_canvas.upgrade_tanks_canvas.getBoundingClientRect().left;
                let uy = event.clientY - this.client.polyfight_canvas.upgrade_tanks_canvas.getBoundingClientRect().top;
    
                const upgrade_buttons = this.client.polyfight_canvas.upgrade_tanks_buttons;
                for (let i = 0; i < upgrade_buttons.length; ++i)
                {
                    let button = upgrade_buttons[i];
                    if (button.disabled || this.client.polyfight_canvas.upgrade_tanks.current_upgrades[i] === undefined) continue;
    
                    let translated_x = ux - button.x;
                    let translated_y = uy - button.y;
    
                    if (translated_x > 0 && translated_x < button.width && translated_y > 0 && translated_y < button.height)
                    {
                        u_hover = true; button.hovered = true;
                        this.client.polyfight_canvas.upgrade_tanks_canvas.style.cursor = "pointer";
                        return;
                    } else button.hovered = false;
                };
                
                // Dismiss upgrades button.
                if (this.client.polyfight_canvas.upgrade_tanks.current_upgrades.length != 0 || this.client.polyfight_canvas.upgrade_tanks.dismissed)
                {
                    let dismiss_button = this.client.polyfight_canvas.upgrade_tanks_close_button;
                    if (dismiss_button === null) return;

                    let translated_x = ux - dismiss_button.x;
                    let translated_y = uy - dismiss_button.y;

                    if (translated_x > 0 && translated_x < dismiss_button.width && translated_y > 0 && translated_y < dismiss_button.height)
                    {
                        dismiss_button.hovered = true;
                        this.client.polyfight_canvas.upgrade_tanks_canvas.style.cursor = "pointer";
                        return;
                    } else dismiss_button.hovered = false;
                }

                if (!u_hover) this.client.polyfight_canvas.upgrade_tanks_canvas.style.cursor = "default";
            } else this.client.polyfight_canvas.upgrade_tanks_canvas.style.cursor = "default";

            // Death screen buttons.
            let dx = event.clientX - this.client.polyfight_canvas.canvas.getBoundingClientRect().left; // todo not compliant with dpr
            let dy = event.clientY - this.client.polyfight_canvas.canvas.getBoundingClientRect().top;

            const death_buttons = this.client.polyfight_canvas.death_buttons;
            if (death_buttons.length == 0) {
                document.body.style.cursor = this.client.polyfight_canvas.canvas.style.cursor = "default";
            }

            for (const button of death_buttons)
            {
                if (!button || button.disabled) continue;

                let translated_x = dx - button.x;
                let translated_y = dy - button.y;

                if (translated_x > 0 && translated_x < button.width && translated_y > 0 && translated_y < button.height)
                {
                    button.hovered = true; hovering = true;
                    document.body.style.cursor = this.client.polyfight_canvas.canvas.style.cursor = "pointer";
                    return;
                } else { 
                    button.hovered = false;
                    document.body.style.cursor = this.client.polyfight_canvas.canvas.style.cursor = "default";
                }
            }

            if (!hovering) this.client.polyfight_canvas.stats_canvas.style.cursor = "default";
        });

        this.client.polyfight_canvas.stats_canvas.addEventListener("mousedown", (event: MouseEvent) =>
        {
            if (event.button != 0) return;

            let x = event.clientX - this.client.polyfight_canvas.stats_canvas.getBoundingClientRect().left;
            let y = event.clientY - this.client.polyfight_canvas.stats_canvas.getBoundingClientRect().top;

            const buttons = this.client.polyfight_canvas.stats_buttons;
            let button_clicked = false;
            for (let idx = 0; idx < buttons.length; ++idx)
            {
                let button = buttons[idx];
                if (!button || button.disabled) continue;

                let translated_x = x - button.x;
                let translated_y = y - button.y;

                if (translated_x > 0 && translated_x < button.width && translated_y > 0 && translated_y < button.height)
                {
                    event.stopPropagation();

                    button.clicked = true;
                    button_clicked = true;
                    this.purge_all_stats = false;

                    if (this.client.polyfight_canvas.stats.available_stat_points == 0)
                    {
                        if (this.last_key == "KeyM")
                        {
                            const len = this.client.polyfight_canvas.stats.preloaded_stats.filter(x => x == idx).length;
                            for (let i = this.client.polyfight_canvas.stats.stats_value[idx] + len; i < this.client.polyfight_canvas.stats.max_stats_value[idx]; ++i)
                            {
                                if (this.client.polyfight_canvas.stats.max_stat_points < this.client.polyfight_canvas.stats.stats_value.reduce((a, b) => a + b, 0) + this.client.polyfight_canvas.stats.preloaded_stats.length) break;
                                this.client.polyfight_canvas.stats.preloaded_stats.push(idx);
                            }
                        }
                        else if (this.last_key == "KeyU")
                        {
                            const len = this.client.polyfight_canvas.stats.preloaded_stats.filter(x => x == idx).length;
                            if (this.client.polyfight_canvas.stats.stats_value[idx] + len < this.client.polyfight_canvas.stats.max_stats_value[idx])
                            {
                                if (this.client.polyfight_canvas.stats.max_stat_points < this.client.polyfight_canvas.stats.stats_value.reduce((a, b) => a + b, 0) + this.client.polyfight_canvas.stats.preloaded_stats.length) return;
                                this.client.polyfight_canvas.stats.preloaded_stats.push(idx);
                            }
                        }
                    } else button.click();
                    return;
                };
            };
        });

        this.client.polyfight_canvas.upgrade_tanks_canvas.addEventListener("mousedown", (event: MouseEvent) =>
        {
            if (this.client.polyfight_canvas.upgrade_tanks.current_upgrades.length != 0)
            {
                if (event.button != 0) return;
                // event.stopImmediatePropagation();

                // Upgrade tank buttons.
                let ux = event.clientX - this.client.polyfight_canvas.upgrade_tanks_canvas.getBoundingClientRect().left;
                let uy = event.clientY - this.client.polyfight_canvas.upgrade_tanks_canvas.getBoundingClientRect().top;
    
                const upgrade_buttons = this.client.polyfight_canvas.upgrade_tanks_buttons;
                for (let i = 0; i < upgrade_buttons.length; ++i)
                {
                    let button = upgrade_buttons[i];
                    if (button.disabled || this.client.polyfight_canvas.upgrade_tanks.current_upgrades[i] === undefined) continue;
    
                    let translated_x = ux - button.x;
                    let translated_y = uy - button.y;
    
                    if (translated_x > 0 && translated_x < button.width && translated_y > 0 && translated_y < button.height)
                    {
                        event.stopPropagation();
                        button.clicked = true;
                        button.click();
                        break;
                    };
                };
            }

            if (this.client.polyfight_canvas.upgrade_tanks.current_upgrades.length != 0 || this.client.polyfight_canvas.upgrade_tanks.dismissed)
            {
                if (event.button != 0) return;
                // event.stopImmediatePropagation();

                let ux = event.clientX - this.client.polyfight_canvas.upgrade_tanks_canvas.getBoundingClientRect().left;
                let uy = event.clientY - this.client.polyfight_canvas.upgrade_tanks_canvas.getBoundingClientRect().top;

                // Dismiss upgrades button.
                let dismiss_button = this.client.polyfight_canvas.upgrade_tanks_close_button!;
                if (dismiss_button === null) return;

                let translated_x = ux - dismiss_button.x;
                let translated_y = uy - dismiss_button.y;

                if (translated_x > 0 && translated_x < dismiss_button.width && translated_y > 0 && translated_y < dismiss_button.height)
                {
                    event.stopPropagation();
                    dismiss_button.clicked = true;
                    dismiss_button.click();
                }
            }
        });

        window.addEventListener("mousedown", (event: MouseEvent) =>
        {
            // if (event.button != 0) return;
            
            // Death screen buttons.
            let dx = event.clientX - this.client.polyfight_canvas.canvas.getBoundingClientRect().left;
            let dy = event.clientY - this.client.polyfight_canvas.canvas.getBoundingClientRect().top;

            const death_buttons = this.client.polyfight_canvas.death_buttons;
            for (const button of death_buttons)
            {
                if (!button || button.disabled) continue;

                let translated_x = dx - button.x;
                let translated_y = dy - button.y;

                if (translated_x > 0 && translated_x < button.width && translated_y > 0 && translated_y < button.height)
                {
                    button.clicked = true;
                    button.click();
                    return;
                };
            }

            if (this.client.entity.dying_phase == DyingPhase.Alive)
            {
                if (event.button == 0) this.client.polyfight_canvas.inputs |= Inputs.Shoot;
                if (event.button == 2)
                {
                    this.client.polyfight_canvas.inputs |= Inputs.Repel;
                    if (this.client.entity.identity_id == EntityIdentityIds.Predator)
                    {
                        this.client.entity.zoom_translation = this.client.entity.angle;
                        this.client.polyfight_canvas.zoom_pos = this.client.entity.position.clone;
                    }
                }
            }
        });

        this.client.polyfight_canvas.stats_canvas.addEventListener("mouseup", (event: MouseEvent) =>
        {
            if (event.button != 0) return;
            // event.stopImmediatePropagation();

            // Stats buttons.
            let x = event.clientX - this.client.polyfight_canvas.stats_canvas.getBoundingClientRect().left;
            let y = event.clientY - this.client.polyfight_canvas.stats_canvas.getBoundingClientRect().top;

            const buttons = this.client.polyfight_canvas.stats_buttons;
            for (const button of buttons)
            {
                if (!button || button.disabled) continue;

                let translated_x = x - button.x;
                let translated_y = y - button.y;

                if (translated_x > 0 && translated_x < button.width && translated_y > 0 && translated_y < button.height)
                {
                    event.stopPropagation();
                    button.clicked = false;
                    return;
                };
            }; 
        });

        this.client.polyfight_canvas.upgrade_tanks_canvas.addEventListener("mouseup", (event: MouseEvent) =>
        {
            // Upgrade tank buttons.
            if (this.client.polyfight_canvas.upgrade_tanks.current_upgrades.length != 0)
            {
                if (event.button != 0) return;
                // event.stopImmediatePropagation();

                let ux = event.clientX - this.client.polyfight_canvas.upgrade_tanks_canvas.getBoundingClientRect().left;
                let uy = event.clientY - this.client.polyfight_canvas.upgrade_tanks_canvas.getBoundingClientRect().top;
    
                const upgrade_buttons = this.client.polyfight_canvas.upgrade_tanks_buttons;
                for (let i = 0; i < upgrade_buttons.length; ++i)
                {
                    let button = upgrade_buttons[i];
                    if (button.disabled || this.client.polyfight_canvas.upgrade_tanks.current_upgrades[i] === undefined) continue;
    
                    let translated_x = ux - button.x;
                    let translated_y = uy - button.y;
    
                    if (translated_x > 0 && translated_x < button.width && translated_y > 0 && translated_y < button.height)
                    {
                        event.stopPropagation();
                        button.clicked = false;
                        return;
                    };
                };
            }
        });

        window.addEventListener("mouseup", (event: MouseEvent) =>
        {
            // Death screen buttons.
            let dx = event.clientX - this.client.polyfight_canvas.canvas.getBoundingClientRect().left;
            let dy = event.clientY - this.client.polyfight_canvas.canvas.getBoundingClientRect().top;

            const death_buttons = this.client.polyfight_canvas.death_buttons;
            for (const button of death_buttons)
            {
                if (!button || button.disabled) continue;

                let translated_x = dx - button.x;
                let translated_y = dy - button.y;

                if (translated_x > 0 && translated_x < button.width && translated_y > 0 && translated_y < button.height)
                {
                    button.clicked = false;
                    return;
                };
            }

            if (event.button == 0) this.client.polyfight_canvas.inputs = this.client.polyfight_canvas.inputs & ~Inputs.Shoot;
            if (event.button == 2)
            {
                this.client.polyfight_canvas.inputs = this.client.polyfight_canvas.inputs & ~Inputs.Repel;
                if (this.client.entity.identity_id == EntityIdentityIds.Predator)
                {
                    // this.client.entity.zoom_translation = 0.0;
                    this.client.polyfight_canvas.zoom_pos = new Vector(0, 0);
                }
            };
        });

        window.addEventListener("touchstart", async (event: TouchEvent) => {
            this.client.polyfight_canvas.is_mobile = true;
        });

        window.addEventListener("wheel", (event: WheelEvent) =>
        {
            if (this.stats_leaderboard_modal.style.zIndex == "9" || this.trophy_leaderboard_modal.style.zIndex == "9") return;

            if (this.client.entity.identity_id != EntityIdentityIds.Spectator)
            {
                this.client.entity.desired_fov = -1;
                return;
            };
            
            if (this.client.entity.desired_fov == -1) this.client.entity.desired_fov = this.client.entity.target_fov;
            
            if (event.deltaY < 0) this.client.entity.desired_fov /= 1.1;
            else if (event.deltaY > 0) this.client.entity.desired_fov *= 1.1;
        });

        this.chat_input.addEventListener("keydown", (event: KeyboardEvent) => {
            if (event.key == "Enter")
            {
                this.client.polyfight_canvas.chat_information.force_open = this.client.polyfight_canvas.chat_information.typing = !this.client.polyfight_canvas.chat_information.typing;

                if (this.client.polyfight_elements.chat_input.value.length > 0) this.client.polyfight_connection.packet_handler.write_chat(this.client.polyfight_elements.chat_input.value);
                else {
                    this.client.polyfight_connection.packet_handler.write_type();
                }

                this.chat_input.value = "";
                this.chat_input.style.display = "none";
            }
        });

        window.addEventListener("keydown", (event: KeyboardEvent) =>
        {
            if (event.key == "Escape")
            {
                this.modal_x_on_click();
                this.clan_modal_close_on_click();
                this.settings_button_close_on_click();
                this.teambuilder_modal_close_on_click();
                this.stats_leaderboard_modal_close_on_click();
                this.trophy_leaderboard_close_on_click();
                this.discord_button_close_on_click();
                this.client.polyfight_canvas.chat_information.typing = false;
                this.client.polyfight_canvas.chat_information.force_open = false;

                if (this.chat_input.style.display == "block") {
                    this.chat_input.style.display = "none";
                    this.client.polyfight_connection.packet_handler.write_type();
                }
            }

            if (document.activeElement == this.clan_textbox || document.activeElement == this.chat_input) return;

            // if (this.client.polyfight_canvas.chat_information.typing)
            // {
            //     if (event.key.length == 1)
            //     {
            //         this.client.entity.message += event.key;
            //         return;
            //     }
            //     else
            //     {
            //         if (event.code == "Space") { this.client.entity.message += " "; return; }
            //         else if (event.code == "Backspace") { this.client.entity.message = this.client.entity.message.slice(0, -1); return; }
            //     }
            // }

            if (this.settings_modal.style.zIndex == "9") return;

            if (event.code == "KeyE" && this.client.entity.dying_phase == DyingPhase.Alive)
            {
                this.client.polyfight_canvas.auto_fire = !this.client.polyfight_canvas.auto_fire;
                this.client.polyfight_canvas.add_notification({ message: this.client.polyfight_canvas.auto_fire ? "Auto Fire: ON" : "Auto Fire: OFF", r: 0, g: 0, b: 255 });
            }
            else if (event.code == "KeyC" && this.client.entity.dying_phase == DyingPhase.Alive)
            {
                if (this.client.polyfight_canvas.auto_spin == SpinType.Normal) this.client.polyfight_canvas.auto_spin = SpinType.None;
                else this.client.polyfight_canvas.auto_spin = SpinType.Normal;

                this.client.polyfight_canvas.add_notification({ message: this.client.polyfight_canvas.auto_spin ? "Auto Spin: ON" : "Auto Spin: OFF", r: 0, g: 0, b: 255 });
            }
            else if (event.code == "KeyL" && this.client.entity.dying_phase == DyingPhase.Alive)
            {
                this.client.polyfight_canvas.lock_mouse = !this.client.polyfight_canvas.lock_mouse;
                this.client.polyfight_canvas.add_notification({ message: this.client.polyfight_canvas.lock_mouse ? "Mouse Lock: ON" : "Mouse Lock: OFF", r: 0, g: 0, b: 255 });
            }
            else if (event.code == "KeyT" && this.client.entity.dying_phase == DyingPhase.Alive)
            {
                if (this.client.polyfight_canvas.auto_spin == SpinType.Tbag) this.client.polyfight_canvas.auto_spin = SpinType.None;
                else this.client.polyfight_canvas.auto_spin = SpinType.Tbag;

                this.client.polyfight_canvas.add_notification({ message: this.client.polyfight_canvas.auto_spin ? "T-Bag: ON" : "T-Bag: OFF", r: 0, g: 0, b: 255 });
            }
            else if (event.key == "Enter")
            {
                if (this.client.entity.dying_phase == DyingPhase.Dead || this.client.entity.dying_phase == DyingPhase.None)
                {
                    if (this.container.classList.contains("show") && this.teambuilder_modal.style.zIndex != "9" && this.stats_leaderboard_modal.style.zIndex != "9")
                    {
                        this.play_button.click();
                    }
                    else
                    {
                        this.client.entity.dying_phase = DyingPhase.None;
                        this.container.classList.add("show");
                         this.client.polyfight_canvas.minimap_canvas.style.display = "none";
                        this.client.polyfight_canvas.death_buttons = [];
                    }
                }
                else if (this.client.entity.dying_phase == DyingPhase.Alive)
                {
                    this.client.polyfight_canvas.chat_information.force_open = this.client.polyfight_canvas.chat_information.typing = !this.client.polyfight_canvas.chat_information.typing;
                    if (!this.client.polyfight_canvas.chat_information.typing)
                    {
                        if (this.client.polyfight_elements.chat_input.value.length > 0) this.client.polyfight_connection.packet_handler.write_chat(this.client.polyfight_elements.chat_input.value);
                        else {
                            this.client.polyfight_connection.packet_handler.write_type();
                        }

                        this.client.polyfight_elements.chat_input.value = "";
                    } else {
                        this.client.polyfight_connection.packet_handler.write_type();
                    }

                    this.chat_input.value = "";
                    this.chat_input.style.display = this.client.polyfight_canvas.chat_information.typing ? "block" : "none";
                    this.chat_input.focus();
                }
            }
            else if (event.code == "KeyM" || event.code == "KeyU")
            {
                this.client.polyfight_canvas.stats_buttons.forEach(button => {
                    if (button) button.disabled = false;
                });

                if (event.code == "KeyU" && this.last_key != "KeyU")
                {
                    this.purge_all_stats = true;
                }
            }

            if (event.code.includes("Digit"))
            {
                this.purge_all_stats = false;

                const index = parseInt(event.code[event.code.length - 1]) - 1;
                if (index >= 0 && index < this.client.polyfight_canvas.stats_buttons.length)
                {
                    const button = this.client.polyfight_canvas.stats_buttons[index];
                    if (!button?.disabled)
                    {
                        if (this.last_key == "KeyM")
                        {
                            const len = this.client.polyfight_canvas.stats.preloaded_stats.filter(x => x == index).length;

                            for (let i = this.client.polyfight_canvas.stats.stats_value[index] + len; i < this.client.polyfight_canvas.stats.max_stats_value[index]; ++i)
                            {
                                if (this.client.polyfight_canvas.stats.available_stat_points > 0) button.click();
                                if (this.client.polyfight_canvas.stats.max_stat_points < this.client.polyfight_canvas.stats.stats_value.reduce((a, b) => a + b, 0) + this.client.polyfight_canvas.stats.preloaded_stats.length) break;

                                else this.client.polyfight_canvas.stats.preloaded_stats.push(index);
                            }
                        }
                        else if (this.last_key == "KeyU")
                        {
                            const len = this.client.polyfight_canvas.stats.preloaded_stats.filter(x => x == index).length;
                            if (this.client.polyfight_canvas.stats.stats_value[index] + len < this.client.polyfight_canvas.stats.max_stats_value[index])
                            {
                                if (this.client.polyfight_canvas.stats.max_stat_points < this.client.polyfight_canvas.stats.stats_value.reduce((a, b) => a + b, 0) + this.client.polyfight_canvas.stats.preloaded_stats.length) return;
                                this.client.polyfight_canvas.stats.preloaded_stats.push(index);
                            }
                        } else button.click();
                    }
                };
            } else this.last_key = this.key_held = event.code;

            let key_value: Inputs | undefined;
            if ((key_value = InputMap.get(event.code)) != undefined)
            {
                this.client.polyfight_canvas.inputs |= key_value!;
                if (key_value == Inputs.Repel && this.client.entity.identity_id == EntityIdentityIds.Predator)
                {
                    this.client.entity.zoom_translation = this.client.entity.angle;
                    this.client.polyfight_canvas.zoom_pos = this.client.entity.position.clone;
                }
            };
        });

        window.addEventListener("keyup", (event: KeyboardEvent) =>
        {
            if (["KeyU", "KeyM"].includes(event.code))
            {
                this.client.polyfight_canvas.stats.target_opacity = 1;
                this.last_key = this.key_held = "";
                this.client.polyfight_canvas.stats_buttons.forEach(button => {
                    if (button) {
                        button.disabled = this.client.polyfight_canvas.stats.available_stat_points == 0;
                    }
                });
                if (this.purge_all_stats)
                {
                    this.client.polyfight_canvas.stats.preloaded_stats = [];
                    this.purge_all_stats = false;
                }
            }

            let key_value: Inputs | undefined;
            if ((key_value = InputMap.get(event.code)) != undefined)
            {
                this.client.polyfight_canvas.inputs = this.client.polyfight_canvas.inputs & ~key_value!;
                if (key_value == Inputs.Repel && this.client.entity.identity_id == EntityIdentityIds.Predator)
                {
                    // this.client.entity.zoom_translation = 0.0;
                    this.client.polyfight_canvas.zoom_pos = new Vector(0, 0);
                }
            };
        });

        this.textbox.addEventListener("keydown", (event: KeyboardEvent) =>
        {
            if (event.key == "Enter") this.play_button.click();
        });

        this.play_button.addEventListener("click", () =>
        {
            if (this.play_button.classList.contains("disabled")) return;

            this.ranked_div.style.display = this.get_query_variable(window.location.hash.split("?")[1], "ranked") == "true" ? "block" : "none";

            if (this.textbox.value.length > 0)
            {
                if (this.scoring.classList.contains("selected") || this.team.innerText == "Match found!")
                {
                    this.client.polyfight_connection.packet_handler.write_spawn(BUILD_ID, this.textbox.value, FINGERPRINT);
                }
                else
                {
                    const region = this.ranked_region.value;
                    const url = SERVER_URLS[region.toLowerCase()] + "/1v1?id=null";
                    
                    const tanks: any[] = [];
                    /** @ts-ignore */
                    const current_team = window.teams_state.teams[window.teams_state.team_idx];

                    for (const tank of current_team.tanks)
                    {
                        tanks.push(
                        {
                            identity: TANK_DEFS.indexOf(TANK_DEFS.find(x => x.name == tank.name) || TANK_DEFS[0]),
                            build: tank.build.split("/").map((x: number) => +x)
                        });
                    }

                    this.client.polyfight_connection.reconnect(url);
                    localStorage.setItem("name", this.textbox.value);

                    this.team.innerText = "Finding opponent...";
                    this.play_button.classList.add("disabled");

                    this.client.polyfight_connection.polyfight_connection!.addEventListener("open", () =>
                    {
                        const stream = new SwiftStream(0);

                        for (const tank of tanks)
                        {
                            stream.write_uint8(tank.identity);
                            for (const build of tank.build) stream.write_uint8(build);
                        }

                        this.client.polyfight_connection.polyfight_connection!.send(stream.out());
                    });
                }

                this.textbox.value = window.localStorage.name || "";
            };
        });

        /** @ts-ignore */
        window.choose_name = this.choose_name.bind(this);
    };

    public fire_joystick_events(): void {
        if (this.client.polyfight_canvas.is_mobile) {
            let mouse = new Vector(0, 0);

            this.joystick!.on('move', (evt, data) => {
                if (this.client.entity.dying_phase != DyingPhase.Alive) return;

                // const joysticks = this.joystick!.ids.map(id => this.joystick!.get(id)).map(joystick => ({ 
                    // id: joystick.identifier, 
                    // is_left: joystick.position.x < window.innerWidth / 2 
                // }));

                // const left_joysticks = joysticks.filter(joystick => joystick.is_left);
                // const right_joysticks = joysticks.filter(joystick => !joystick.is_left);

                if (data.position.x < window.innerWidth / 2) {
                    let inputFlags = {
                        Left: false,
                        Right: false,
                        Up: false,
                        Down: false
                    };
    
                    let angle = data.angle.degree;
    
                    if (angle >= 22.5 && angle < 67.5) {
                        inputFlags.Up = true;
                        inputFlags.Right = true;
                    } else if (angle >= 67.5 && angle < 112.5) {
                        inputFlags.Up = true;
                    } else if (angle >= 112.5 && angle < 157.5) {
                        inputFlags.Up = true;
                        inputFlags.Left = true;
                    } else if (angle >= 157.5 && angle < 202.5) {
                        inputFlags.Left = true;
                    } else if (angle >= 202.5 && angle < 247.5) {
                        inputFlags.Down = true;
                        inputFlags.Left = true;
                    } else if (angle >= 247.5 && angle < 292.5) {
                        inputFlags.Down = true;
                    } else if (angle >= 292.5 && angle < 337.5) {
                        inputFlags.Down = true;
                        inputFlags.Right = true;
                    } else {
                        inputFlags.Right = true;
                    }
    
                    for (const [key, val] of Object.entries(inputFlags)) {
                        if (val) this.client.polyfight_canvas.inputs |= Inputs[key as keyof typeof inputFlags];
                        else this.client.polyfight_canvas.inputs &= ~Inputs[key as keyof typeof inputFlags];
                    }
                } else {
                    this.client.polyfight_canvas.inputs |= Inputs.Shoot;
                    if (this.real_shoot_mode == "R") {
                        this.client.polyfight_canvas.inputs |= Inputs.Repel;
                    }
                
                    let angle = data.angle.radian;
                    if (angle < -Math.PI) angle += Math.PI * 2;
                    if (angle > Math.PI) angle -= Math.PI * 2;
                    angle *= -1;
    
                    this.client.polyfight_canvas.mouse.x = data.raw.distance * 5 * Math.cos(angle);
                    this.client.polyfight_canvas.mouse.y = data.raw.distance * 5 * Math.sin(angle);
    
                    this.client.polyfight_canvas.mouse.add(mouse);
    
                    this.client.polyfight_canvas.mouse.x = constrain(-this.client.polyfight_canvas.canvas.width / 2, this.client.polyfight_canvas.mouse.x, this.client.polyfight_canvas.canvas.width / 2);
                    this.client.polyfight_canvas.mouse.y = constrain(-this.client.polyfight_canvas.canvas.height / 2, this.client.polyfight_canvas.mouse.y, this.client.polyfight_canvas.canvas.height / 2);
    
                    this.client.entity.target_angle = this.client.entity.angle = this.client.polyfight_canvas.mouse.angle();
                }
            });

            this.joystick!.on('end', (evt, data) => {
                if (this.client.entity.dying_phase != DyingPhase.Alive) return;

                if (data.position.x < window.innerWidth / 2) {
                    this.client.polyfight_canvas.inputs &= ~(Inputs.Left | Inputs.Right | Inputs.Up | Inputs.Down);
                } else {
                    this.client.polyfight_canvas.inputs &= ~(Inputs.Shoot | Inputs.Repel);
                    mouse = this.client.polyfight_canvas.mouse.clone;
                }
            });
        }
    };

    private async choose_name(title = "Enter the name you want associated with your 1v1 account. This name may be changed.")
    {
        /** @ts-ignore */
        const name = await window.Swal.fire({
            icon: "info",
            title,
            input: "text",
            inputAttributes: {
                maxlength: "18"
            },
            inputValidator: (value: string) => {
                if (!value) return "You must enter a name.";
            }
        });

        fetch(`${SERVER_URLS[this.client.polyfight_connection.preferred_region].replace("wss", "https").replace("ws", "http")}/register`,
        {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: name.value })
        })
        .then(async r =>
            {
                if (r.status == 400)
                {
                    const message = await r.text();

                    /** @ts-ignore */
                    await window.Swal.fire({
                        icon: "error",
                        title: "Error",
                        text: message
                    });
                }
                else if (r.status == 409) await this.choose_name("That name is already taken. Please choose another.");
                else if (r.status == 500) await this.choose_name("An error occurred. Please try again.");
                else if (r.status == 200)
                {
                    /** @ts-ignore */
                    await window.Swal.fire({
                        icon: "success",
                        title: "Success",
                        text: "You have successfully registered."
                    });
                }
            });
    }

    public get_query_variable(query: string, variable: string): string
    {
        if (!query) return "";
        
        var vars = query.split('&');
        for (var i = 0; i < vars.length; i++) {
            var pair = vars[i].split('=');
            if (decodeURIComponent(pair[0]) == variable) {
                return decodeURIComponent(pair[1]);
            }
        }

        return "";
    }

    public reload_servers(): void
    {
        this.servers.innerHTML = "";

        const interval = setInterval(async () =>
        {
            if (!this.client.polyfight_connection.servers_loaded) return;

            if (window.location.hash)
            {
                const id = window.location.hash.slice(1).split("?")[0];
                
                const span = document.createElement("span");
                span.textContent = "Connecting to server...";
                span.style.fontSize = "1.5rem";
                span.style.margin = "5px";

                this.servers.appendChild(span);

                const region = this.get_query_variable(window.location.hash.slice(1).split("?")[1], "region");
                /** @ts-ignore */
                if (!SERVER_URLS[region])
                {
                    /** @ts-ignore */
                    window.Swal.fire({ icon: "error", title: "Invalid region", text: "The region in your link is invalid." });
                    window.location.hash = "";
                    this.servers.removeChild(span);
                    await this.client.polyfight_connection.find_servers();
                    this.reload_servers();
                    this.client.entity.first_server_spawn = true;
                    return;
                }

                /** @ts-ignore */
                this.client.polyfight_connection.reconnect(SERVER_URLS[region] + `/scoring?id=${id}`); // TODO remove hardcoding of SERVER_URLS
                this.client.polyfight_connection.polyfight_connection?.addEventListener("error", async () =>
                {
                    /** @ts-ignore */
                    await window.Swal.fire({ icon: "error", title: "Invalid ID", text: "The ID you entered is invalid, the lobby is full, or you are not allowed to join." });
                    window.location.hash = "";
                    this.servers.removeChild(span);
                    await this.client.polyfight_connection.find_servers();
                    this.reload_servers();
                    this.client.entity.first_server_spawn = true;
                });

                this.client.polyfight_connection.polyfight_connection?.addEventListener("open", () =>
                {
                    if (this.get_query_variable(window.location.hash.slice(1).split("?")[1], "ranked") == "true")
                    {
                        this.client.polyfight_elements.play_button.innerText = "Play";
                        this.team.innerText = "Match found!";
                        this.menu_scoring.style.display = "none";
                        this.menu_1v1.style.display = "block";
                        this.scoring.classList.remove("selected");
                        this.ranked.classList.add("selected");
                        this.play_button.classList.remove("disabled");
                        this.clan_button.classList.add("disabled");
                    } else span.textContent = "Connected to server!";
                });

                clearInterval(interval);
            }
            else
            {
                let already_selected = false;
                for (let i = 0; i < this.client.polyfight_connection.servers.length; i++)
                {
                    let server = this.client.polyfight_connection.servers[i];

                    const entry = document.createElement("div");
                    entry.id = "server-entry";
    
                    const name = document.createElement("span");
                    name.textContent = server.gamemode;
    
                    const players = document.createElement("span");
                    players.textContent = `${server.player_count} players`;
    
                    const region = document.createElement("span");
                    region.textContent = server.region;
    
                    entry.appendChild(name);
                    entry.appendChild(players);
                    entry.appendChild(region);
    
                    entry.addEventListener("click", async () =>
                    {
                        const selected = this.client.polyfight_connection.servers[i];
                        let force_id = "";

                        if (force_id === "PANIC!") return;
    
                        const previously_selected = this.servers.querySelector("#server-entry.selected");
                        if (previously_selected) previously_selected.classList.remove("selected");
    
                        entry.classList.add("selected");
    
                        this.client.polyfight_connection.reconnect(
                            /** @ts-ignore */
                            SERVER_URLS[selected.region.toLowerCase()] + `/scoring?id=${force_id || selected.id}`
                        );
    
                        this.client.polyfight_connection.polyfight_connection?.addEventListener("error", async () =>
                        {
                            /** @ts-ignore */
                            await window.Swal.fire({ icon: "error", title: "Invalid ID", text: "The ID you entered is invalid, the lobby is full, or you are not allowed to join." });
                            window.location.hash = "";
                            await this.client.polyfight_connection.find_servers();
                            this.reload_servers();
                            this.client.entity.first_server_spawn = true;
                        });

                        window.location.hash = (force_id || selected.id) + "?region=" + selected.region.toLowerCase(); 
                        this.client.entity.first_server_spawn = true;
                    });
    
                    if (!already_selected)
                    {
                        already_selected = true;
                        entry.click();
                    }
    
                    this.servers.appendChild(entry);
                }

                clearInterval(interval);
            }
        }, 100);
    }

    private stats_on_click(): void
    {
        if (this.trophy_leaderboard_modal.style.zIndex == "9") this.trophy_leaderboard_close_on_click();

        this.stats_leaderboard_modal.style.zIndex = "9";
        this.stats_leaderboard_modal.style.opacity = "1";
        
        /** @ts-ignore */
        const fetch_data = window.fetch_data = async (identifier = auth.currentUser.uid) =>
        {
            this.stats_leaderboard_categories.innerHTML = "<span class='stroke' style='font-size: 36px;'>Loading, please wait...</span>";

            await fetch(`${SERVER_URLS[this.client.polyfight_connection.preferred_region].replace("wss", "https").replace("ws", "http")}/get_player_info`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ identifier, category: identifier == auth.currentUser.uid ? "uid" : "name" })
            })
                .then(r =>
                {
                    if (r.status == 200) return r.json();
                    else
                    {
                        this.stats_leaderboard_modal.innerHTML = `
                            <span id="stats-leaderboard-close" style="padding-right: 15px;">X</span>

                            <div id="stats-leaderboard-categories">
                                <span class="stroke" style="font-size: 36px;">Unable to look up user.</span>
                            </div>

                            <div style="display: flex; flex-direction: column; justify-content: center; align-items: center;">
                                <div style="display: flex; flex-direction: row; justify-content: center; align-items: center;">
                                    <input 
                                        type="text"
                                        id="stats-leaderboard-search" placeholder="Search for a player..." 
                                        style="width: 300px; height: 30px; font-size: 18px; padding: 5px; margin: 10px; border-radius: 5px;"
                                        onkeydown="if (event.key == 'Enter') window.fetch_data(document.getElementById('stats-leaderboard-search').value);"
                                    >
                                    <button 
                                        id="stats-leaderboard-search-button" 
                                        style="font-size: 18px; padding: 5px; margin: 10px; background-color: #00FF00; border: 3px solid rgba(0, 0, 0, 0.3); border-radius: 5px;"
                                        onclick="window.fetch_data(document.getElementById('stats-leaderboard-search').value);"
                                    >
                                        Search
                                    </button>
                                </div>
                                <span class="stroke" style="font-size: 18px;">Showing results for <span style="color: #3b82f6; text-decoration: underline;">${identifier}</span></span>
                            </div>
                        `.trim();
                    }
                })
                .then((data: any) =>
                {
                    // this.stats_leaderboard_categories.innerHTML = `
                    // <div class="stats-leaderboard-category">
                    //     <div style="text-align: center; display: flex; flex-direction: column;">
                    //         <span class="lb-category-header stroke">Drone Category</span>
                    //         <span class="stroke" style="font-size: 18px;">ELO: 1500 ± 350 (volatility 0.06)</span>
                    //     </div>
    
                    //     <div style="display: flex; justify-content: center; align-items: center;">
                    //         <img src="assets/images/spritesheet.svg#Overlord" height="60" width="60">
                    //         <img src="assets/images/spritesheet.svg#Overseer" height="60" width="60">
                    //     </div>
                    // </div>
                    // `.trim();
    
                    if (data === undefined) return;
    
                    this.stats_leaderboard_modal.innerHTML = 
                    `
                    <span id="stats-leaderboard-close" style="padding-right: 15px;">X</span>
    
                    <div id="stats-leaderboard-categories">
                        ${data.elo.map(({ rating, deviation, volatility }: any, i: number) =>
                        {
                            rating = Math.round(rating);

                            const category_name = TankCategories[i];
                            const color = THEME_CONFIG.UPGRADES[i].css;
                            const tanks = TANK_DEFS.filter(x => x.category == i);
    
                            return `
                            <div class="stats-leaderboard-category" style="background-color: ${color}">
                                <div style="text-align: center; display: flex; flex-direction: column;">
                                    <span class="lb-category-header stroke">${category_name} Category</span>
                                    <span class="stroke" style="font-size: 18px;">ELO: ${rating}</span>
                                </div>
    
                                <div style="display: flex; justify-content: center; align-items: center;">
                                    ${/** @ts-ignore */ ""}
                                    ${tanks.map(({ name }: any) => `<img src="${window.spritesheet}#${name}" height="60" width="60" style="flex: 1 1 30%; height: 60px; width: 60px; object-fit: contain;">`).join("\n")}
                                </div>
                            </div>
                            `.trim();
                        }).join("\n")}
                    </div>
    
                    <p style="text-align: center; font-size: 36px;" class="stroke">Average ELO: <span style="color: #22FF00; text-decoration: underline;">${Math.round(data.elo.reduce((sum: number, item: any) => sum + item.rating, 0) / data.elo.length)}</span></π>
    
                    <div style="display: flex; flex-direction: column; justify-content: center; align-items: center;">
                        <div style="display: flex; flex-direction: row; justify-content: center; align-items: center;">
                            <input 
                                type="text"
                                id="stats-leaderboard-search" placeholder="Search for a player..." 
                                style="width: 300px; height: 30px; font-size: 18px; padding: 5px; margin: 10px; border-radius: 5px;"
                                onkeydown="if (event.key == 'Enter') window.fetch_data(document.getElementById('stats-leaderboard-search').value);"
                            >
                            <button 
                                id="stats-leaderboard-search-button" 
                                style="font-size: 18px; padding: 5px; margin: 10px; background-color: #00FF00; border: 3px solid rgba(0, 0, 0, 0.3); border-radius: 5px;"
                                onclick="window.fetch_data(document.getElementById('stats-leaderboard-search').value);"
                            >
                                Search
                            </button>
                        </div>
                        <span class="stroke" style="font-size: 18px;">Showing results for <span style="color: #3b82f6; text-decoration: underline;">${data.name}</span></span>
                        <p>
                            Want to change your name?
                            <a href="javascript:void(0);" onclick="window.choose_name();" style="color: #3b82f6; text-decoration: underline;">
                                Click here
                            </a>
                        </p>
                    </div>
                    `.trim();
                });

            this.stats_leaderboard_close = document.getElementById("stats-leaderboard-close")!;
            this.stats_leaderboard_close.addEventListener("click", this.stats_leaderboard_modal_close_on_click.bind(this));
        }

        fetch_data();
    };

    private trophy_leaderboard_on_click(): void
    {
        if (this.stats_leaderboard_modal.style.zIndex == "9") this.stats_leaderboard_modal_close_on_click();

        this.trophy_leaderboard_modal.style.zIndex = "9";
        this.trophy_leaderboard_modal.style.opacity = "1";

        fetch(`${SERVER_URLS[this.client.polyfight_connection.preferred_region].replace("wss", "https").replace("ws", "http")}/leaderboard`)
            .then(r => r.json())
            .then((data: any) =>
            {
                this.trophy_leaderboard_modal.innerHTML = 
                `
                <span id="trophy-leaderboard-close" style="padding-right: 15px;">X</span>

                <div id="trophy-leaderboard-categories">
                    ${data.map((category: any, i: number) =>
                    {
                        const category_name = TankCategories[i] == "Illegal" ? "Generalist" : TankCategories[i];
                        const color = THEME_CONFIG.UPGRADES[i].css;

                        return `
                        <div class="trophy-leaderboard-category" style="background-color: ${color};">
                            <div style="text-align: center; display: flex; flex-direction: column;">
                                <p class="lb-category-header stroke" style="text-align: center;">${category_name} Category</p>
                                <div style="display: flex; flex-direction: column; justify-content: center; align-items: center;">
                                    ${category.map((d: any, j: number) => `<span class="stroke" style="padding: 0 2px 0 2px;">${j + 1}. ${d.name == "" ? "——" : d.name} (${d.name == "" ? "N/A" : Math.round(d.elo)})</span>`).join("\n")}
                                </div>
                            </div>
                        </div>
                        `.trim();
                    }).join("\n")}
                </div>

                <p class="stroke" style="text-align: center; font-size: 24px;">Please allow up to 5 minutes for the leaderboard to update.</p>
                `.trim();
            });

        this.trophy_leaderboard_close = document.getElementById("trophy-leaderboard-close")!;
        this.trophy_leaderboard_close.addEventListener("click", this.trophy_leaderboard_close_on_click.bind(this));
    }

    /** The event listener for when the button is clicked. */
    private changelog_button_on_click(): void
    {
        window.localStorage.setItem("changelog_last_build_checked", BUILD_ID.toString());
        this.modal_header.innerHTML = "Changelog";
        this.modal_body.innerHTML = CHANGELOG_CONTENT;

        if (this.modal.style.zIndex == "-1") this.modal_x_on_click();
        else
        {
            this.modal.style.zIndex = "9";
            this.modal.style.opacity = "1";
        };
    };

    private discord_button_on_click(): void
    {
        const discord_modal = document.getElementById("discord-modal")!;
        if (discord_modal.style.zIndex == "9") discord_modal.style.zIndex = "-1";
        else
        {
            discord_modal.style.zIndex = "9";
            discord_modal.style.opacity = "1";
        };
    };

    private discord_button_close_on_click(): void
    {
        const discord_modal = document.getElementById("discord-modal")!;
        discord_modal.style.opacity = "0";
        discord_modal.style.zIndex = "-1";
    }

    /** The event listener for when the button is clicked. */
    private info_button_on_click(): void
    {
        this.modal_header.innerHTML = "Information";
        this.modal_body.innerHTML = INFORMATION_CONTENT;

        if (this.modal.style.zIndex == "-1") this.modal_x_on_click();
        else
        {
            this.modal.style.zIndex = "9";
            this.modal.style.opacity = "1";
        };
    };

    private settings_button_on_click(): void
    {
        this.settings_theme.classList.add("selected");
        this.settings_config.classList.remove("selected");
        this.settings_theme_content.style.display = "block";
        this.settings_config_content.style.display = "none";
        this.settings_config.style.display = this.client.polyfight_connection.is_host ? "block" : "none";

        this.settings_modal.style.zIndex = "9";
        this.settings_modal.style.opacity = "1";
    };

    private clan_button_on_click(): void
    {
        /*const user = auth.currentUser;
        if (user == null)
        {
            this.client.polyfight_canvas.add_notification({ message: "You must be signed in via Google to join a clan.", r: 255, g: 0, b: 0 });
            return;
        }
        else */if (this.clan_button.classList.contains("disabled"))
        {
            this.client.polyfight_canvas.add_notification({ message: "Clans are not available in this gamemode.", r: 255, g: 0, b: 0 });
            return;
        }

        if (this.clan_modal.style.zIndex == "-1") this.clan_modal_close_on_click();
        else
        {
            this.clan_modal.style.zIndex = "9";
            this.clan_modal.style.opacity = "1";
        };
    };

    private clan_modal_close_on_click(): void
    {
        this.clan_modal.style.opacity = "0";
        this.clan_modal.style.zIndex = "-2";
    };

    private settings_button_close_on_click(): void
    {
        this.settings_modal.style.opacity = "0";
        this.settings_modal.style.zIndex = "-2";
    };

    /** The event listener for when the x-mark is clicked. */
    private modal_x_on_click(): void
    {
        this.modal.style.opacity = "0";
        this.modal.style.zIndex = "-2";
    };

    private teambuilder_modal_on_click(): void
    {
        if (this.teambuilder_modal.style.zIndex == "-1") this.teambuilder_modal_close_on_click();
        else
        {
            this.teambuilder_teams.style.display = "";
            this.teambuilder_teams_buttons.style.display = "";
            this.teambuilder_edit.style.display = "none";
            this.teambuilder_teamedit_buttons.style.display = "none";

            this.teambuilder_modal.style.zIndex = "9";
            this.teambuilder_modal.style.opacity = "1";

            /** @ts-ignore */
            document.getElementById(`teambox-${window.teams_state.team_idx}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        };
    }

    private teambuilder_modal_close_on_click(): void
    {
        this.teambuilder_teams.style.display = "";
        this.teambuilder_teams_buttons.style.display = "";
        this.teambuilder_edit.style.display = "none";
        this.teambuilder_teamedit_buttons.style.display = "none";

        this.teambuilder_modal.style.opacity = "0";
        this.teambuilder_modal.style.zIndex = "-2";
    };

    private stats_leaderboard_modal_close_on_click(): void
    {
        this.stats_leaderboard_modal.style.opacity = "0";
        this.stats_leaderboard_modal.style.zIndex = "-2";
    }

    private trophy_leaderboard_close_on_click(): void
    {
        this.trophy_leaderboard_modal.style.opacity = "0";
        this.trophy_leaderboard_modal.style.zIndex = "-2";
    }

    private new_server_on_click(): void
    {
        this.client.polyfight_canvas.add_notification({ message: "Log into Google to create a new server.", r: 255, g: 0, b: 0 });
    };

    private ranked_onclick(disabled: boolean): void
    {
        if (disabled)
        {
            this.client.polyfight_canvas.add_notification({ message: "Log into Google to play in 1v1 modes.", r: 255, g: 0, b: 0 });
        }
        else
        {
            window.location.hash = "";
            
            if (this.client.polyfight_connection.polyfight_connection)
                this.client.polyfight_connection.polyfight_connection.onclose = null;

            this.client.polyfight_connection.polyfight_connection?.close();
            this.client.polyfight_canvas.add_notification({ message: "You have been disconnected from the scoring server.", r: 255, g: 0, b: 0 });

            if (!localStorage.has_1v1ed)
            {
                localStorage.has_1v1ed = 1;

                this.modal_header.innerHTML = "1v1 Rules";
                this.modal_body.innerHTML = `
                <b>How to Play</b>
                <ul>
                    <li>You will be able to select a team of six tanks with builds by clicking on your team.</li>
                    <li>You can open the teambuilder menu by pressing on the button on the homescreen.</li>
                    <li>You can type in a tank you want to use, and fill out a build form.</li>
                    <li>Press Begin Matchmaking to be matched with an opponent.</li>
                    <li>You will be matched with a player of similar skill level.</li>
                    <li>You must press the Ready checkbox to start. Automatic losses will occur if you stall.</li>
                    <li>When you die, you will move onto the next tank you've chosen in your team. When you run out of tanks, you lose the 1v1.</li>
                    <li>The leaderboard will show the score in the 1v1. The first player to reach 6 on the leaderboard wins.</li>
                </ul>
                <div class="line"></div>
                <b>Rankings</b>
                <ul>
                    <li>Rankings are based on the ELO system.</li>
                    <li>The ELO system is a method for calculating the relative skill levels of players in two-player games.</li>
                    <li>Each tank is placed in a tank category.</li>
                    <li>When dying in a 1v1, you lose ELO. When killing your opponent, you gain ELO. ELO changes are shown on death.</li>
                    <li>Buttons on the homescreen can show your ELO breakdown and also show a top 10 leaderboard per category.</li>
                 </ul>
                `.trim();
    
                this.modal.style.zIndex = "9";
                this.modal.style.opacity = "1";
            }

            this.play_button.innerText = "Begin Matchmaking";

            this.scoring.classList.remove("selected");
            this.ranked.classList.add("selected");
            this.menu_scoring.style.display = "none";
            this.menu_1v1.style.display = "block";
        }
    }
};