import { BUILD_ID, THEME_CONFIG, IS_PROD, MAX_CLAN_LENGTH, MAX_MESSAGE_LENGTH, MAX_NAME_LENGTH } from "../const/consts";
import SwiftStream from "./stream";
import Client from "../client";
import WebSocketManager from "./websocket";
import { CensusProperties, DyingPhase, EntityType, FieldType, IncomingPacketHeader, Inputs, OutgoingPacketHeader, SpinType } from "../const/enums";
import BaseEntity from "../entity/base_entity";
import TankEntity from "../entity/tank_entity";
import ShapeEntity from "../entity/shape_entity";
import { constrain, fuzzy_equals, lerp, lerp_angle, normalise_angle } from "../utils/functions";
import ProjectileEntity from "../entity/projectile_entity";
import Vector from "../utils/vector";

/** A representation of a packet parser/sender. */
export default class PacketHandler
{
    /** The binary encoder/decoder. */
    public stream: SwiftStream;
    /** The WebSocket manager for the client. */
    public manager: WebSocketManager;

    public initial_packet: boolean = true;

    public constructor(manager: WebSocketManager)
    {
        this.manager = manager;
        this.stream = new SwiftStream(manager.cipher);
    };


    /** Sends the existing message in the stream. */
    private send(stream: SwiftStream, transcode = true): void
    {
        if (this.manager.polyfight_connection?.readyState == WebSocket.OPEN)
        {
            if (transcode) stream.transcode(stream.index);
            const buffer = stream.out();

            this.manager.polyfight_connection.send(buffer);
        }
    };

    /** 
     * Writes a SPAWN packet.
     * u8(0x0) vu(build_num) string(name)
    */
    public write_spawn(build_num: number, name: string, fingerprint: string): void
    {
        const stream = new SwiftStream(this.manager.cipher);

        stream.write_uint8(OutgoingPacketHeader.Spawn);
        stream.write_varuint(build_num);

        const buffer: ArrayBuffer = new TextEncoder().encode(name).buffer;

        let name_length = constrain(0, buffer.byteLength, MAX_NAME_LENGTH);
        stream.write_varuint(name_length);
        const buffer_view: Uint8Array = new Uint8Array(buffer);
        for (let i = 0; i < name_length; i++) 
            stream.buffer.setUint8(stream.index + i, buffer_view[i]);
        stream.index += buffer.byteLength;

        stream.write_string(fingerprint);

        let left = Math.floor(BUILD_ID / 2);
        for (let i = 0; i < left; ++i) stream.write_uint8((Math.random() * 256) | 0);
        
        stream.write_uint32(this.manager.cipher);

        let right = BUILD_ID - left;
        for (let i = 0; i < right; ++i) stream.write_uint8((Math.random() * 256) | 0);

        this.send(stream);

        window.localStorage.setItem("name", name);
    };

    /**
     * Writes an INPUT packet.
     * u8(0x1) vu(flags)
     */
    public write_input(flags: number, mouse: { x: number, y: number }): void
    {
        if (this.manager.client.entity.dying_phase) return;
        
        const stream = new SwiftStream(this.manager.cipher);

        stream.write_uint8(OutgoingPacketHeader.Input);
        stream.write_varuint(flags);
        stream.write_float32(mouse.x);
        stream.write_float32(mouse.y);

        this.send(stream);
    };

    /**
     * Writes a STAT packet.
     * u8(0x2) u8(stat_id)
     */
    public write_stat(stat_id: number): void
    {
        const stream = new SwiftStream(this.manager.cipher);

        stream.write_uint8(OutgoingPacketHeader.Stat);
        stream.write_uint8(stat_id);

        this.send(stream);
    }

    /** 
     * Writes an UPGRADES packet.
     * u8(0x3) u8(upgrade_id)
     * */
    public write_upgrade(upgrade_id: number): void
    {
        const stream = new SwiftStream(this.manager.cipher);

        stream.write_uint8(OutgoingPacketHeader.Upgrades);
        stream.write_uint8(upgrade_id);

        this.send(stream);
    };

    /**
     * Writes a CHAT packet.
     * u8(0x4) string(message)
     */
    public write_chat(message: string, force_null = false): void
    {
        message = message.trim();
        if (!force_null && message.length == 0) return;
        
        const stream = new SwiftStream(this.manager.cipher);

        stream.write_uint8(OutgoingPacketHeader.Chat);
        const buffer = new TextEncoder().encode(message).buffer;
        let message_length = constrain(0, buffer.byteLength, MAX_MESSAGE_LENGTH);
        stream.write_varuint(message_length);
        const buffer_view: Uint8Array = new Uint8Array(buffer);
        for (let i = 0; i < message_length; i++) 
            stream.buffer.setUint8(stream.index + i, buffer_view[i]);
        stream.index += buffer.byteLength;

        this.send(stream);
    };

    public write_type(): void {
        this.write_chat("", true);
    }

    /**
     * Writes a CLAN packet.
     */
    public write_clan(opcode: number, ...args: any[])
    {
        const stream = new SwiftStream(this.manager.cipher);
        stream.write_uint8(OutgoingPacketHeader.Clan);
        stream.write_uint8(opcode);

        switch (opcode)
        {
            case 0x0: // CLAN CREATION
            {
                const clan_name: string = args[0];

                const buffer = new TextEncoder().encode(clan_name).buffer;
                let message_length = constrain(0, buffer.byteLength, MAX_CLAN_LENGTH);
                stream.write_varuint(message_length);
                const buffer_view: Uint8Array = new Uint8Array(buffer);
                for (let i = 0; i < message_length; i++) 
                    stream.buffer.setUint8(stream.index + i, buffer_view[i]);
                stream.index += buffer.byteLength;

                break;
            }

            case 0x1: // CLAN JOIN
            {
                const clan_id: number = args[0];
                stream.write_uint8(clan_id);
                break;
            }

            case 0x2: // CLAN LEAVE
            {
                break;
            }

            case 0x3: // CLAN ACCEPT/DECLINE
            {
                const member_id: number = args[0];
                const accept: boolean = args[1];
                stream.write_uint32(member_id);
                stream.write_uint8(accept ? 1 : 0);
                break;
            }

            case 0x4: // CLAN KICK
            {
                const player_id: number = args[0];
                stream.write_uint32(player_id);
                break;
            }
        }

        this.send(stream);
    };

    /**
     * Writes an ARENA_UPDATE packet.
     */
    public write_arena_update(): void
    {
        const stream = new SwiftStream(this.manager.cipher);
        stream.write_uint8(OutgoingPacketHeader.ArenaUpdate);

        /** @ts-ignore */
        const arena_state = window.arena_state;

        stream.write_float32(arena_state.ARENA_SIZE);
        stream.write_uint32(arena_state.WANTED_SHAPE_COUNT);
        stream.write_uint8(0);
        // stream.write_uint8(arena_state.BOT_COUNT);
        stream.write_uint8(arena_state.ALLOW_AUTO_LEVEL_UP);
        stream.write_uint8(arena_state.ALLOW_TANK_SWITCH);
        stream.write_uint8(arena_state.ALLOW_GOD_MODE);
        stream.write_uint8(arena_state.LAST_MAN_STANDING);
        stream.write_uint8(arena_state.UNLISTED);

        this.send(stream);
    }

    /**
     * Writes a READY packet.
     */
    public write_ready(ready: boolean): void
    {
        const stream = new SwiftStream(this.manager.cipher);
        stream.write_uint8(OutgoingPacketHeader.Ready);
        stream.write_uint8(ready ? 1 : 0);

        this.send(stream);
    }

    /** Parses any incoming packet. */
    public parse(data: ArrayBuffer): void
    {
        this.stream = new SwiftStream(this.manager.cipher);
        this.stream.set_buffer(new DataView(data));

        if (this.stream.buffer.byteLength == 1 && this.stream.buffer.getUint8(0) == IncomingPacketHeader.Pong)
        {
            this.parse_pong();
            return;
        }

        if (!this.initial_packet) this.stream.transcode();
        this.initial_packet = false;

        const opcode = this.stream.read_uint8();
        switch (opcode)
        {
            case IncomingPacketHeader.Update: this.parse_update(); break;
            case IncomingPacketHeader.Stat: this.parse_stat(); break;
            case IncomingPacketHeader.Upgrades: this.parse_upgrades(); break;
            case IncomingPacketHeader.Notification: this.parse_notification(); break;
            case IncomingPacketHeader.ServerInfo: this.parse_server_info(); break;
            case IncomingPacketHeader.Cipher: this.parse_cipher(); break;
            case IncomingPacketHeader.EloChange: this.parse_elo_change(); break;
            // case 0xFF: this.parse_debug(); break;
            default: return (IS_PROD ? console.error("Invalid opcode received.", opcode) : undefined);
        };
    };

    /** 
     * Parses an UPDATE packet.
    */
    public parse_update(): void
    {
        this.manager.client.game_server_config.arena_size = this.stream.read_float32();
        this.manager.client.game_server_config.wanted_shape_count = this.stream.read_float32();

        const entity = this.manager.client.entity;
        const id = this.stream.read_uint32();

        this.manager.client.entity.id = id;

        const count = this.stream.read_uint8();
        for (let i = 0; i < count; i++)
        {
            const property = this.stream.read_uint8();
            entity.census_map.get(property)!(entity, this.stream);
        };

        const entity_count = this.stream.read_uint32();
        for (let i = 0; i < entity_count; ++i)
        {
            const id = this.stream.read_uint32();
            const entity_type = this.stream.read_uint8();

            let other = entity.surroundings.find(e => e.id == id);

            if (other === undefined)
            {
                let e: BaseEntity | undefined;
                switch (entity_type)
                {
                    case EntityType.Tank: e = new TankEntity(this.manager.client); break;
                    case EntityType.Shape: e = new ShapeEntity(this.manager.client); break;
                    case EntityType.Projectile: e = new ProjectileEntity(this.manager.client); break;
                    default: return (IS_PROD ? console.error("Invalid entity type received.", entity_type) : undefined);
                }

                e!.type = entity_type;
                e!.id = id;
                entity.surroundings.push(e!);
                other = e!;
            }
            else if (other.type != entity_type || other.dying_phase != DyingPhase.Alive)
            {
                let e: BaseEntity | undefined;
                switch (entity_type)
                {
                    case EntityType.Tank: e = new TankEntity(this.manager.client); break;
                    case EntityType.Shape: e = new ShapeEntity(this.manager.client); break;
                    case EntityType.Projectile: e = new ProjectileEntity(this.manager.client); break;
                    default: return (IS_PROD ? console.error("Invalid entity type received.", entity_type) : undefined);
                }

                e!.type = entity_type;
                e!.id = id;
                entity.surroundings[entity.surroundings.indexOf(other)] = e!;
                other = e!;
            }

            const count = this.stream.read_uint8();
            if (count == 0)
            {
                if (other.dying_phase != DyingPhase.Dying)
                {
                    other.dying_phase = DyingPhase.Dying;
                    other.target_radius = other.radius * (other.id == this.manager.client.entity.id ? 3.0 : 1.5);
                }
                else other.dying_phase = DyingPhase.Dead;
                continue;
            }
            else
            {
                other.updated = true;
                other.revive();
            };

            for (let i = 0; i < count; i++)
            {
                const property = this.stream.read_uint8();
                other.census_map.get(property)!(other, this.stream);
            };
        };

        for (const e of entity.surroundings)
        {
            if (!e.updated && e.dying_phase == DyingPhase.Alive)
            {
                e.target_radius = e.radius * (e.id == this.manager.client.entity.id ? 3.0 : 1.5);
                e.dying_phase = DyingPhase.Dying;
            }
        }

        entity.surroundings = entity.surroundings.filter(e => e.updated || (e.dying_phase == DyingPhase.Dying && (e.target_radius = e.radius * (e.id == this.manager.client.entity.id ? 3.0 : 1.5))));
        entity.surroundings.forEach(e => e.updated = false);

        const client = this.manager.client;

        let leader_direction = this.stream.read_float32();
        if (leader_direction == 0xc8)
        {
            client.polyfight_canvas.leader_direction = null;
        }
        else
        {
            client.polyfight_canvas.leader_direction = leader_direction;
        };

        const scoreboard_len = this.stream.read_uint8();

        const scoreboard = client.polyfight_canvas.scoreboard;
        const new_scoreboard = [];

        for (let i = 0; i < scoreboard_len; ++i)
        {
            const data_score = this.stream.read_float32();
            const name = this.stream.read_string();
            const id = this.stream.read_uint32();
            const entity_identity = this.stream.read_uint8();

            let score = data_score, target_score = data_score;

            let entry = scoreboard.find(e => e.id == id);
            if (entry !== undefined)
            {
                score = lerp(entry.score, 0.4, target_score);
                score = constrain(0, score, target_score);
            }

            new_scoreboard.push({ name, score, target_score, id, identity: entity_identity });
        };

        client.polyfight_canvas.scoreboard = new_scoreboard;

        const clans_length = this.stream.read_uint8();
        const clans = [];

        for (let i = 0; i < clans_length; ++i)
        {
            const id = this.stream.read_uint8();
            const name = this.stream.read_string();
            const owner = this.stream.read_uint32();

            const members_length = this.stream.read_uint32();
            const members = [];

            for (let j = 0; j < members_length; ++j)
            {
                const member_id = this.stream.read_uint32();
                const member_name = this.stream.read_string();
                
                const position_x = this.stream.read_float32();
                const position_y = this.stream.read_float32();
                const position = new Vector(position_x, position_y);

                let distressed = !!this.stream.read_uint8();
                let leaving: boolean | null = !!this.stream.read_uint8();

                let previous = client.polyfight_canvas.clans.find(e => e.id == id)?.members.find(e => e.id == member_id);
                if (previous != undefined)
                {
                    position.x = lerp(previous.position.x, 0.4, position.x);
                    position.y = lerp(previous.position.y, 0.4, position.y);

                    if (previous.leaving === null) leaving = null;
                    if (leaving === false) leaving = false;
                }

                members.push({ id: member_id, name: member_name, owner: member_id == owner, position, distressed, leaving });
            };

            const pending_members_length = this.stream.read_uint32();
            const pending_members = [];

            for (let j = 0; j < pending_members_length; ++j)
            {
                const member_id = this.stream.read_uint32();
                const member_name = this.stream.read_string();

                pending_members.push({ id: member_id, name: member_name });
            };

            clans.push({ id, name, owner, members, pending_members, trying_to_join: client.polyfight_canvas.clans[i]?.trying_to_join || false });
        }
        
        client.polyfight_canvas.clans = clans;
    };

    /**
     * Parses a STAT packet.
     * Format: u8(0x1) u8(available_stat_points) u8(stats_len) [u8(current_stat_investment) u8(max_stat_investment)]
     */
    public parse_stat(): void
    {
        const client = this.manager.client;
        const available_stat_points = this.stream.read_uint8();
        const stats_len = this.stream.read_uint8();

        client.polyfight_canvas.stats.available_stat_points = available_stat_points;
        for (const button of client.polyfight_canvas.stats_buttons)
        {
            if (!button) continue;
            button.disabled = !(available_stat_points > 0);
        }

        // todo: stats dont change when switching tanks
        for (let i = 0; i < stats_len; ++i)
        {
            const current_stat_investment = this.stream.read_uint8();
            const max_stat_investment = this.stream.read_uint8();

            client.polyfight_canvas.stats.stats_value[i] = current_stat_investment;
        }
    }

    /**
     * Parses an UPGRADES packet.
     * Format: u8(0x2) u8(available_stat_points) u8(stats_len) [u8(current_stat_investment) u8(max_stat_investment)]
     */
    public parse_upgrades(): void
    {
        const client = this.manager.client;
        const num_upgrades = this.stream.read_uint8();

        client.polyfight_canvas.upgrade_tanks.current_upgrades = [];

        for (let i = 0; i < num_upgrades; ++i)
        {
            const upgrade = this.stream.read_uint8();
            client.polyfight_canvas.upgrade_tanks.current_upgrades[i] = upgrade;
        }
    }

    /**
     * Parses a NOTIFICATION packet.
     * Format: u8(0x3) string(message) u8(r) u8(g) u8(b)
     */
    public parse_notification(): void
    {
        const message = this.stream.read_string();
        const r = this.stream.read_uint8();
        const g = this.stream.read_uint8();
        const b = this.stream.read_uint8();

        this.manager.client.polyfight_canvas.add_notification({ message, r, g, b });
        // this.manager.client.canvas.notification(message, r, g, b);
    };

    public parse_server_info(): void
    {
        const server_player_count = this.stream.read_uint32();
        const total_player_count = this.stream.read_uint32();
        const mspt = this.stream.read_float32();

        this.manager.client.polyfight_canvas.player_count = { server: server_player_count, global: total_player_count };
        this.manager.target_mspt = mspt;
    };

    public parse_cipher(): void
    {
        let left = Math.floor(BUILD_ID / 2);
        for (let i = 0; i < left; ++i) this.stream.read_uint8();
        this.manager.cipher = this.stream.read_uint32();
        let right = BUILD_ID - left;
        for (let i = 0; i < right; ++i) this.stream.read_uint8();

        const stream = new SwiftStream(this.manager.cipher);
        stream.write_uint8(OutgoingPacketHeader.Ping);

        this.send(stream, false);
        this.manager.last_ping = performance.now();
    }
    
    public parse_elo_change(): void
    {
        let self_old = this.stream.read_float32();
        let self_new = this.stream.read_float32();
        let other_old = this.stream.read_float32();
        let other_new = this.stream.read_float32();

        this.manager.elo_changes = [[self_old, self_new], [other_old, other_new]];
    }

    /** Parses a PONG packet. */
    public parse_pong(): void
    {
        // todo: clans need to show for both players

        let latency = performance.now() - this.manager.last_ping;
        this.manager.target_latency = latency;
        
        setTimeout(() =>
        {
            this.manager.last_ping = performance.now();

            const stream = new SwiftStream(this.manager.cipher);
            stream.write_uint8(OutgoingPacketHeader.Ping);
    
            this.send(stream, false);
        }, 500);
    };

    // public parse_debug(): void
    // {
    //     this.manager.client.entity.debuggers = [];
    //     while (this.stream.index < this.stream.buffer.byteLength)
    //     {
    //         const x = this.stream.read_float32();
    //         const y = this.stream.read_float32();
    //         const id = this.stream.read_uint32();
    //         this.manager.client.entity.debuggers.push({ x, y, id });
    //     }
    // }
};