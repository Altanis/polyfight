import { ASPEKT, BLAUKANONENKUGEL } from "../const/consts";

/** The maximum size of the buffer. */
const MAX_BUFFER_SIZE: number = 8192; // 2 ** 13

const CACHED_TEXT_DECODER: TextDecoder = new TextDecoder();
const CACHED_TEXT_ENCODER: TextEncoder = new TextEncoder();

function fnv_1a(data: Uint8Array): number
{
    let hash = 2576945811;

    for (let i = 0; i < data.length; i++)
    {
        hash ^= data[i] >>> 0;
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }

    return hash >>> 0;
};

function u32_to_le_bytes(value: number): Uint8Array
{
    return new Uint8Array([
        value & 0xFF,
        (value >>> 8) & 0xFF,
        (value >>> 16) & 0xFF,
        (value >>> 24) & 0xFF
    ]);
};

function bitwise_multiply(a: number, b: number)
{
    a = a >>> 0;
    b = b >>> 0;

    let result = 0;
    while (b > 0)
    {
        if (b & 1) result = bitwise_add(result, a);

        a = a << 1;
        b = b >>> 1;
    }

    return result >>> 0;
}

function bitwise_add(x: number, y: number)
{
    while (y !== 0)
    {
        let carry = x & y;
        x = x ^ y;
        y = carry << 1;
    }

    return x;
}

/** Encryption/decryption mechanism. */
class LCG
{
    private seed: number;
    private modulus: number;
    private multiplier: number;
    private increment: number;

    public constructor(cipher: number)
    {
        this.seed = fnv_1a(u32_to_le_bytes(cipher));
        this.modulus = 0x1000000;
        this.multiplier = this.seed >>> ASPEKT;
        this.increment = this.seed >>> BLAUKANONENKUGEL;
    };

    public next(): number
    {
        // this.seed = bitwise_add(bitwise_multiply(this.seed, this.multiplier), this.increment) & (this.modulus - 1);
        this.seed = (this.seed * this.multiplier) >>> 0;
        this.seed = (this.seed + this.increment) >>> 0;
        this.seed = this.seed & (this.modulus - 1);

        return this.seed;
    }
};


/** A representation of a binary encoder/decoder. */
export default class SwiftStream
{
    /** The buffer to read from/write to. */
    public buffer = new DataView(new ArrayBuffer(MAX_BUFFER_SIZE));
    /** The current position in the buffer. */
    public index: number = 0;
    
    /** The cipher of the LCG. */
    private cipher: number;
    /** The LCG. */
    private lcg: LCG;

    public constructor(cipher: number, buffer?: DataView)
    {
        if (buffer) this.buffer = buffer;

        this.cipher = cipher;
        this.lcg = new LCG(cipher);
    };

    /** Transcodes the buffer. */
    public transcode(length = this.buffer.byteLength): void
    {
        for (let i = 0; i < length; i++)
        {
            let byte: number = this.buffer.getUint8(i);
            byte ^= this.lcg.next();
            this.buffer.setUint8(i, byte);
        }
    };

    /** Reads a Uint8 type from the buffer. */
    public read_uint8(): number
    {
        return this.buffer.getUint8(this.index++);
    };

    /** Reads a Uint16 type from the buffer. */
    public read_uint16(): number
    {
        let value = this.buffer.getUint16(this.index);
        this.index += 2;

        return value;
    };

    /** Reads a Uint32 type from the buffer. */
    public read_uint32(): number
    {
        let value = this.buffer.getUint32(this.index);
        this.index += 4;

        return value;
    };

    /** Reads a Float32 type from the buffer. */
    public read_float32(): number
    {
        let value = this.buffer.getFloat32(this.index);
        this.index += 4;

        return value;
    };

    /** Reads a VarUint type from the buffer (specifically a LEB128). */
    public read_varuint(): number
    {
        let result: number = 0;
        let shift: number = 0;
        let byte: number;

        do
        {
            byte = this.read_uint8();
            result |= (byte & 0x7F) << shift;
            shift += 7;
        } while (byte & 0x80);

        return result;
    };

    /** Reads a string from the buffer. */
    public read_string(): string
    {
        const length: number = this.read_varuint();
        const string: string = CACHED_TEXT_DECODER.decode(this.buffer.buffer.slice(this.index, this.index + length));
        this.index += length;
        return string;
    };

    /** Writes a Uint8 type to the buffer. */
    public write_uint8(value: number): void
    {
        this.buffer.setUint8(this.index++, value);
    };

    /** Writes a Uint16 type to the buffer. */
    public write_uint16(value: number): void
    {
        this.buffer.setUint16(this.index, value);
        this.index += 2;
    };

    /** Writes a Uint32 type to the buffer. */
    public write_uint32(value: number): void
    {
        this.buffer.setUint32(this.index, value);
        this.index += 4;
    };

    /** Writes a Float32 type to the buffer. */
    public write_float32(value: number): void
    {
        this.buffer.setFloat32(this.index, value);
        this.index += 4;
    };

    /** Writes a VarUint type to the buffer (specifically a LEB128). */
    public write_varuint(value: number): void
    {
        do
        {
            let byte: number = value & 127;
            value >>= 7;

            if (value) byte |= 128;
            this.write_uint8(byte);
        } while (value);
    };

    /** Writes a string to the buffer. */
    public write_string(value: string): void
    {
        const buffer: ArrayBuffer = CACHED_TEXT_ENCODER.encode(value).buffer;
        this.write_varuint(buffer.byteLength);

        const buffer_view: Uint8Array = new Uint8Array(buffer);
        for (let i = 0; i < buffer.byteLength; i++) 
            this.buffer.setUint8(this.index + i, buffer_view[i]);

        this.index += buffer.byteLength;
    };

    /** Outputs the buffer as a Uint8Array, then resets it. */
    public out(): Uint8Array
    {
        const buffer: Uint8Array = new Uint8Array(this.buffer.buffer.slice(0, this.index));
        this.buffer = new DataView(new ArrayBuffer(MAX_BUFFER_SIZE));
        this.index = 0;

        return buffer;
    };

    /** Sets the buffer. */
    public set_buffer(buffer: DataView): void
    {
        this.buffer = buffer;
        this.index = 0;
    };
};