/** 2π */
export const TAU = 2 * Math.PI;

/** Constrains a value such that `value` is in the interval of [min, max]. */
export const constrain = (min: number, value: number, max: number) => Math.max(Math.min(value, max), min);


/** Linearly interpolates within the interval `[a, b]` given an interpolation factor `t`. */
export const lerp = (a: number, t: number, b: number) => a + (b - a) * t;
/** Linearly interpolates (and normalises) an angle within the interval `[a, b]` given an interpolation factor `t`. */
export const lerp_angle = (a: number, t: number, b: number) => {
    let value = a + (-((a - b + Math.PI * 3) % (TAU) - Math.PI)) * t;

    if (value > Math.PI) value -= TAU;
    if (value < -Math.PI) value += TAU;

    return value;
};

export const exponential_smoothing = (value: number, wanted: number, rate: number) => (value * (1 - constrain(0, rate, 1))) + (wanted * constrain(0, rate, 1));
export const timed_exponential_smoothing = (value: number, wanted: number, rate: number, dt: number) => exponential_smoothing(value, wanted, 1 - Math.pow(constrain(0, rate, 1), dt));

const DECAY_CONSTANT = 16;
export const exponential_decay = (a: number, b: number, dt: number) => b + (a - b) * Math.exp(-DECAY_CONSTANT * dt);


// export const exponential_smoothing = (value: number, wanted: number, rate: number) => (value * (1 - constrain(0, rate, 1))) + (wanted * constrain(0, rate, 1));
// export const timed_exponential_smoothing = (value: number, wanted: number, rate: number, dt: number, slow_factor: number = 0.6) => {
//     const adjusted_rate = Math.pow(constrain(0, rate, 1), dt * slow_factor);
//     return exponential_smoothing(value, wanted, 1 - adjusted_rate);
// };

export const fuzzy_equals = (a: number, b: number, epsilon: number = 0.001) => Math.abs(a - b) < epsilon;

export function score_format(score: number)
{
    if (score >= 1e9) return (score / 1e9).toFixed(1) + "b";
    else if (score >= 1e6) return (score / 1e6).toFixed(1) + "m";
    else if (score >= 1e3) return (score / 1e3).toFixed(1) + "k";
    else return score.toFixed(0);
};

export const aabb = (a: { x: number, y: number, width: number, height: number }, b: { x: number, y: number, width: number, height: number }) =>
{
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
};

export const normalise_angle = (a: number): number => ((a % TAU) + TAU) % TAU;

export const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// /** Timed exponential interpolation. */
// export function timed_exponential_smoothing(current: number, wanted: number, rate: number, dt: number): number
// {
//     return current * (1 - constrain(0, rate, 1) + wanted * constrain(0, rate, 1));
// };