import firebase from "../auth/firebase";
import Client from "../client";
import { IS_PROD, PROTIPS, SERVER_URLS } from "../const/consts";
import { OutgoingPacketHeader, RenderPhase } from "../const/enums";
import TankEntity from "../entity/tank_entity";
import { lerp } from "../utils/functions";
import PacketHandler from "./packets";
import SwiftStream from "./stream";

const { auth } = firebase;

const MAX_RETRIES: number = 5;

/** A class which represents the WebSocket connection between the client and the server. */
export default class WebSocketManager
{
    /** The WebSocket connection. */
    public polyfight_connection: WebSocket | null = null;

    /** The packet handler. */
    public packet_handler: PacketHandler = new PacketHandler(this);
    /** The client using this WebSocketManager. */
    public client: Client;

    /** Whether or not the connection has been established. */
    public connected: boolean = false;
    /** The number of retries which have been made for the connection. */
    private retries: number = 0;
    /** Whether or not the connection has failed. */
    public failed: boolean = false;

    /** The last timestamp when a ping was sent. */
    public last_ping: number = 0;

    /** The latency of the client. */
    public latency: number = 0;
    /** The target latency. */
    public target_latency: number = 0;

    /** The mspt of the server. */
    public mspt: number = 0;
    /** The target mspt of the client. */
    public target_mspt: number = 0;

    public in_1v1 = false;
    public should_reconnect = false;

    /** The cipher the client and server agree on. */
    public cipher: number = 0;

    /** The servers available for connection. */
    public servers: ({
        id: string,
        gamemode: string,
        region: string,
        player_count: number,
        private: boolean,
        host: string
    })[] = [];
    /** Whether or not all the servers loaded. */
    public servers_loaded: boolean = false;
    /** The latency of each fetch request. */
    public fetch_latency: Array<{ region: string, latency: number }> = [];
    /** The preferred region for requests. */
    public preferred_region: string = "nyc";

    public elo_changes = [[0, 0], [0, 0]];

    public get current_server()
    {
        return this.servers.find(server => server.id === window.location.hash.slice(1).split("?")[0]);
    }

    public get is_ranked()
    {
        return this.client.polyfight_elements.get_query_variable(window.location.hash.split("?")[1], "ranked") == "true";
    }

    public get is_host()
    {
        return auth.currentUser?.uid && this.current_server?.host == auth.currentUser?.uid;
    }

    public calculate_latency(): number
    {
        this.latency = lerp(this.latency, 0.1, this.target_latency);
        return this.latency;
    }

    public lerp_mspt(): number
    {
        this.mspt = lerp(this.mspt, 0.1, this.target_mspt);
        return this.mspt;
    }

    public constructor(client: Client)
    {
        this.client = client;
        this.find_servers();
    };

    public async find_servers()
    {
        this.servers = [];

        let used_urls: Array<string> = [];
        for (const [region, url] of Object.entries(SERVER_URLS))
        {
            if (used_urls.includes(url)) continue;
            used_urls.push(url);

            let start = performance.now();
            const response = await fetch(url.replace("wss", "https").replace("ws", "http") + "/servers");
            this.fetch_latency.push({ region: region, latency: performance.now() - start });

            const servers = await response.json();
                
            this.servers.push(...(servers.map((server: any) =>
            {
                server.region = region.toUpperCase();
                server.gamemode = (/([a-z])/g).test(server.gamemode) ? server.gamemode.replace(/([A-Z])/g, ' $1').trim() : server.gamemode;
                return server;
            })));
        }

        this.preferred_region = this.fetch_latency.sort((a, b) => a.latency - b.latency)[0].region;
        this.servers_loaded = true;

        /**
         * servers should be sorted with priorities:
         * - preferred region
         * - player count
         */
        this.servers.sort((a, b) =>
        {
            if (a.region === this.preferred_region && b.region !== this.preferred_region) return -1;
            if (a.region !== this.preferred_region && b.region === this.preferred_region) return 1;

            if (a.player_count > b.player_count) return -1;
            if (a.player_count < b.player_count) return 1;

            return 0;
        });
    }

    /** The event listener for when the connection is opened. */
    private on_open(): void
    {
        if (this.should_reconnect) {
            this.client.polyfight_elements.ranked.click();
            this.client.polyfight_elements.stats.click();
        }
        this.should_reconnect = false;

        this.client.polyfight_elements.connect_elements.style.display = "block";
        this.client.polyfight_elements.disconnect_elements.style.display = "none";
        
        if (this.polyfight_connection?.url.includes("/1v1?"))
        {

        }
        else
        {
            this.packet_handler.initial_packet = this.connected = true;
        }

        if (this.client.polyfight_elements.get_query_variable(window.location.hash.split("?")[1], "ranked") == "true")
        {
            this.client.polyfight_elements.clan_button.classList.add("disabled");
        }

        // this.packet_handler.parse_pong();
    };

    /** The event listener for when the connection has an error. */
    private on_error(error: Event): void
    {
        // this.notify_disconnected("Error occured. Attempting to reconnect to server...");

        // if (++this.retries <= MAX_RETRIES)
        // {
        //     this.polyfight_connection = new WebSocket(this.polyfight_connection!.url);
        //     this.polyfight_connection.binaryType = "arraybuffer";
        //     this.polyfight_connection.onopen = this.on_open.bind(this);
        //     this.polyfight_connection.onerror = this.on_error.bind(this);
        //     this.polyfight_connection.onmessage = this.on_message.bind(this);
        //     this.polyfight_connection.onclose = this.on_close.bind(this);
        // } 
        // else
        // {
        //     this.failed = true;
        //     this.notify_failed();
        // };
    };

    /** The event listener for when a message is received. */
    private on_message(message: MessageEvent): void
    {
        this.packet_handler.parse(message.data);
    };

    /** The event listener for when the connection is closed. */
    public on_close(event: CloseEvent, unexpected = true): void
    {
        if (event.code === 4069 && this.polyfight_connection?.url)
        {
            const id = event.reason;
            const url = (this.polyfight_connection.url.includes("wss") ? "wss://" : "ws://") +
                this.polyfight_connection.url.replace("wss://", "").replace("ws://", "").split("/1v1")[0] + `/scoring?id=${id}`;

            this.client.polyfight_elements.team.innerText = "Match found!";
            this.client.polyfight_elements.menu_scoring.style.display = "none";
            this.client.polyfight_elements.menu_1v1.style.display = "block";
            this.client.polyfight_elements.scoring.classList.remove("selected");
            this.client.polyfight_elements.play_button.classList.remove("disabled");
            this.client.polyfight_elements.play_button.innerText = "Play";
            this.client.polyfight_elements.ranked.classList.add("selected");

            window.location.hash = id;
            let region = "";
            for (const key of Object.keys(SERVER_URLS))
            {
                if (this.polyfight_connection.url.includes(SERVER_URLS[key]))
                {
                    region = key;
                    break;
                }
            }
            window.location.hash = id + `?region=${region}&ranked=true`;

            this.reconnect(url);
        }
        else if (unexpected)
        {
            if (this.should_reconnect) {
                this.client.polyfight_elements.reload_servers();
            }

            console.log("Connection closed.", this.polyfight_connection?.url);
            console.log(event);
            this.notify_disconnected(event.reason || "Connection closed.");
        }

        // this.polyfight_connection?.close();

        // this.failed = true;
        // this.notify_failed();
    };

    /** Notifies the client that the connection has been broken. */
    private notify_disconnected(reason: string): void
    {
        this.connected = false;
        this.client.polyfight_canvas.phase = RenderPhase.Home;
        this.client.entity = new TankEntity(this.client);

        this.client.polyfight_elements.container.classList.add("show");

        this.client.polyfight_canvas.minimap_canvas.style.display = "none";
        this.client.polyfight_elements.game_buttons.style.display = "none";
        this.client.polyfight_elements.clan_modal.style.opacity = "0";
        this.client.polyfight_elements.clan_modal.style.zIndex = "-2";

        this.client.polyfight_elements.disconnected_message.innerText = reason;
        this.client.polyfight_elements.disconnect_elements.style.display = "flex";
        this.client.polyfight_elements.connect_elements.style.display = "none";
    };
    
    /** Notifies the client that the connection has failed. */
    private notify_failed(): void
    {
        this.client.polyfight_elements.container.classList.add("show");

        this.client.polyfight_canvas.minimap_canvas.style.display = "none";
        this.client.polyfight_elements.disconnected_message.innerText = "Failed to connect to the server.";
        this.client.polyfight_elements.disconnect_elements.style.display = "flex";
        this.client.polyfight_elements.connect_elements.style.display = "none";
    };

    public reconnect(url: string): void
    {
        if (this.polyfight_connection?.readyState === 1)
        {
            this.polyfight_connection?.close();
        }
        
        if (this.client.polyfight_elements) this.notify_disconnected("Connecting to server...");
        
        this.polyfight_connection = new WebSocket(url + `&token=${auth.currentUser?.accessToken || "undefined"}`);
        // this.polyfight_connection = new WebSocket(url, undefined);
        this.polyfight_connection.binaryType = "arraybuffer";
        this.polyfight_connection.onopen = this.on_open.bind(this);
        this.polyfight_connection.onerror = this.on_error.bind(this);
        this.polyfight_connection.onmessage = this.on_message.bind(this);
        this.polyfight_connection.onclose = this.on_close.bind(this);
    }
};