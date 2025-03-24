pub const ASPEKT: u32 = 12;
pub const BLAUKANONENKUGEL: u32 = 15;

pub fn fnv_1a(data: &[u8]) -> u32
{
    let mut hash = 2576945811;

    for byte in data {
        hash ^= (*byte as u32);

        hash = hash.wrapping_add(
            (hash << 1)
                .wrapping_add(hash << 4)
                .wrapping_add(hash << 7)
                .wrapping_add(hash << 8)
                .wrapping_add(hash << 24),
        );
    }

    hash
}

#[derive(Clone)]
pub struct LCG
{
    seed: u32,
    modulus: u32,
    multiplier: u32,
    increment: u32,
}

impl LCG
{
    pub fn new(cipher: u32) -> LCG
    {
        LCG {
            seed: fnv_1a(&cipher.to_le_bytes()),
            modulus: 0x1000000,
            multiplier: fnv_1a(&cipher.to_le_bytes()).wrapping_shr(ASPEKT),
            increment: fnv_1a(&cipher.to_le_bytes()).wrapping_shr(BLAUKANONENKUGEL),
        }
    }

    pub fn next(&mut self) -> u32
    {
        self.seed = (self
            .seed
            .wrapping_mul(self.multiplier)
            .wrapping_add(self.increment))
            & (self.modulus - 1);
        self.seed
    }
}
