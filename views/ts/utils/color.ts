export default class Colour
{
    public static BLACK: Colour = Colour.from_rgb(0, 0, 0);
    public static WHITE: Colour = Colour.from_rgb(255, 255, 255);

    public static from_rgb(r: number, g: number, b: number): Colour
    {
        return new Colour(r << 16 | g << 8 | b << 0);
    }

    public static from_hex(hex: string): Colour
    {
        return new Colour(parseInt(hex, 16));
    }

    public static blend_colours(primary: Colour, secondary: Colour, factor: number)
    {
        const c = new Colour(primary.int);
        c.blend_with(factor, secondary);
        return c;
    }

    public get int()
    {
        return this.r << 16 | this.g << 8 | this.b << 0;
    }

    public get css()
    {
        return `rgb(${this.r}, ${this.g}, ${this.b})`;
    }

    private _r: number = 0;
    public get r(): number { return this._r };
    public set r(v: number) { this._r = v & 255; };

    private _g: number = 0;
    public get g(): number { return this._g };
    public set g(v: number) { this._g = v & 255; };

    private _b: number = 0;
    public get b(): number { return this._b };
    public set b(v: number) { this._b = v & 255; };

    public constructor(colour: number)
    {
        this.r = (colour >>> 16) & 255;
        this.g = (colour >>> 8) & 255;
        this.b = (colour >>> 0) & 255;
    }

    public blend_with(factor: number, colour: Colour): Colour
    {
        this.r = Math.round(colour.r * factor + this.r * (1 - factor));
        this.g = Math.round(colour.g * factor + this.g * (1 - factor));
        this.b = Math.round(colour.b * factor + this.b * (1 - factor));

        return this;
    }

    public grayscale(): Colour
    {
        const avg = (this.r + this.g + this.b) / 3;
        this.r = avg;
        this.g = avg;
        this.b = avg;

        return this;
    }

    public invert(): Colour
    {
        this.r = 255 - this.r;
        this.g = 255 - this.g;
        this.b = 255 - this.b;

        return this;
    }

    public clone(): Colour
    {
        return new Colour(this.int);
    }
}