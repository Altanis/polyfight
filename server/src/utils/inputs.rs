use crate::connection::packets::Inputs;

#[derive(Debug, Clone)]
pub struct InputFlags {
    /// The associated flag value.
    pub flags: u32,
}

impl InputFlags {
    pub fn new(flags: u32) -> InputFlags {
        InputFlags { flags }
    }

    pub fn is_set(&self, flag: Inputs) -> bool {
        self.flags & flag as u32 == flag as u32
        // self.flags & flag as u32 == 0
    }

    pub fn set_flag(&mut self, flag: Inputs) {
        self.flags |= flag as u32;
    }

    pub fn clear_flag(&mut self, flag: Inputs) {
        self.flags &= !(flag as u32);
    }
}