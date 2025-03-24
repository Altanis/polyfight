#[macro_export]
macro_rules! debug
{
    ($($arg:tt)*) =>
    (
        // if utils::config::PRODUCTION == false
        {
            println!("\x1B[34m[DEBUG] {:?}\x1B[39m", ($($arg)*))
        }
    )
}

#[macro_export]
macro_rules! error
{
    ($($arg:tt)*) =>
    (
        eprintln!("\x1B[31m[ERROR] {:?}\x1B[39m", ($($arg)*))
    )
}

#[macro_export]
macro_rules! printf
{
    ($($arg:tt)*) =>
    (
        println!("\x1B[34m[INFO] {:?}\x1B[39m", ($($arg)*))
    )
}

#[macro_export]
macro_rules! success
{
    ($($arg:tt)*) =>
    (
        println!("\x1B[32m[SUCCESS] {:?}\x1B[39m", ($($arg)*))
    )
}

#[macro_export]
macro_rules! warn
{
    ($($arg:tt)*) =>
    (
        println!("\x1B[33m[WARN] {:?}\x1B[39m", ($($arg)*))
    )
}

#[macro_export]
macro_rules! env {
    ($key:expr) => {
        std::fs::read_to_string("tokens.txt")
            .expect("Unable to read file.")
            .split('\n')
            .into_iter()
            .find(|&x| x.contains($key))
            .expect("Unable to find variable.")
            .split("= ")
            .nth(1)
            .expect("Could not find value for variable.")
    };
}

#[macro_export]
macro_rules! constrain {
    ($min:expr, $value:expr, $max:expr) => {
        if $value < $min {
            $min
        } else if $value > $max {
            $max
        } else {
            $value
        }
    };
}

/// Returns a random string of `n` characters.
#[macro_export]
macro_rules! randstr {
    ($a:expr) => {
        rand::thread_rng()
            .sample_iter(&rand::distributions::Alphanumeric)
            .map(char::from)
            .take(16)
            .collect::<String>()
    };
}

/// Returns a random integer in the interval [a, b], inclusive.
#[macro_export]
macro_rules! randi {
    ($a:expr, $b:expr) => {
        rand::thread_rng().gen_range($a..=$b)
    };
}

/// Returns a random float in the interval [a, b], inclusive.
#[macro_export]
macro_rules! randf {
    ($a:expr, $b:expr) => {
        rand::thread_rng().gen_range($a..=$b) as f32
    };
}

/// Normalises an angle.
#[macro_export]
macro_rules! normalise_angle {
    ($a:expr) => {
        (($a % std::f32::consts::TAU) + std::f32::consts::TAU) % std::f32::consts::TAU
    };
}

/// Lerps a value.
#[macro_export]
macro_rules! lerp {
    ($a:expr, $t:expr, $b:expr) => {
        $a + ($b - $a) * $t
    };
}

/// Lerps an angle.
#[macro_export]
macro_rules! lerp_angle
{
    ($a:expr, $t:expr, $b:expr) =>
    {
        {
            let mut value = $a + (-(($a - $b + std::f32::consts::PI * 3.0) % (std::f32::consts::TAU) - std::f32::consts::PI)) * $t;

            if (value > std::f32::consts::PI) {
                value -= std::f32::consts::TAU;
            }

            if (value < -std::f32::consts::PI) {
                value += std::f32::consts::TAU;
            }
    
            value
        }
    };
}

#[macro_export]
macro_rules! seconds_to_ticks {
    ($a:expr) => {
        (($a as u32) * (config::FPS as u32))
    };
}

#[macro_export]
macro_rules! is { ($(x:tt)+) => { if $(x)+ { true } else { false } } }
