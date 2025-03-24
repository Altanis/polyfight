use bytes::BytesMut;

use crate::{
    connection::crypto::LCG,
    debug,
    utils,
};

/// A struct which acts as a binary encoder/decoder.
#[derive(Clone)]
pub struct SwiftStream
{
    /// The data.
    pub data: BytesMut,
    /// The LCG which encrypts/decrypts the data.
    pub lcg: LCG,
}

impl SwiftStream
{
    pub fn new(cipher: u32) -> Self
    {
        SwiftStream {
            data: BytesMut::new(),
            lcg: LCG::new(cipher),
        }
    }

    pub fn with_capacity(capacity: usize, cipher: u32) -> Self
    {
        SwiftStream {
            data: BytesMut::with_capacity(capacity),
            lcg: LCG::new(cipher),
        }
    }

    pub fn from_bytes(data: BytesMut, cipher: u32) -> Self
    {
        SwiftStream {
            data,
            lcg: LCG::new(cipher),
        }
    }

    pub fn transcode(&mut self)
    {
        self.data
            .iter_mut()
            .for_each(|byte| *byte = (((*byte as u32) ^ self.lcg.next()) as u8));
    }

    pub fn read_u8(&mut self) -> Result<u8, ()>
    {
        if self.data.len() < 1 {
            Err(())
        } else {
            Ok(self.data.split_to(1).first().copied().unwrap())
        }
    }

    pub fn read_u16(&mut self) -> Result<u16, ()>
    {
        if self.data.len() < 2 {
            Err(())
        } else {
            let mut bytes: [u8; 2] = [0; 2];
            bytes.copy_from_slice(&self.data.split_to(2));
            Ok(u16::from_be_bytes(bytes))
        }
    }

    pub fn read_u32(&mut self) -> Result<u32, ()>
    {
        if self.data.len() < 4 {
            Err(())
        } else {
            let mut bytes: [u8; 4] = [0; 4];
            bytes.copy_from_slice(&self.data.split_to(4));
            Ok(u32::from_be_bytes(bytes))
        }
    }

    pub fn read_f32(&mut self) -> Result<f32, ()>
    {
        if self.data.len() < 4 {
            Err(())
        } else {
            let mut bytes: [u8; 4] = [0; 4];
            bytes.copy_from_slice(&self.data.split_to(4));
            Ok(f32::from_be_bytes(bytes))
        }
    }

    pub fn read_varuint(&mut self) -> Result<u32, ()>
    {
        let mut result: u32 = 0;
        let mut shift: u32 = 0;
        loop {
            let byte: u8 = self.read_u8()?;
            result |= ((byte & 0x7F) as u32) << shift;
            shift += 7;
            if byte & 0x80 == 0 {
                break;
            }
        }

        Ok(result)
    }

    pub fn read_string(&mut self, strlen: usize) -> Result<String, ()>
    {
        let mut string: String = String::with_capacity(strlen);

        if self.data.len() >= strlen {
            if let Ok(utf8) = std::str::from_utf8(&self.data.split_to(strlen)) {
                string.push_str(utf8);
            } else {
                return Err(());
            }

            Ok(string)
        } else {
            Err(())
        }
    }

    pub fn read_string_safe(
        &mut self,
        max_string_size: u32,
        equality: bool,
        expect_value: bool,
    ) -> Result<String, bool>
    {
        let length = match self.read_varuint() {
            Ok(v) => {
                if (expect_value && v == 0)
                    || (if equality {
                        v != max_string_size
                    } else {
                        v > max_string_size
                    })
                {
                    // dbg!("Length read failed.", v);
                    return Err(true);
                } else {
                    v
                }
            }
            Err(_) => return Err(true),
        };

        match self.read_string(length as usize) {
            Ok(v) => Ok(v),
            Err(_) => Err(true),
        }
    }

    pub fn write_u8(&mut self, value: u8)
    {
        self.data.extend_from_slice(&value.to_be_bytes());
    }

    pub fn write_u16(&mut self, value: u16)
    {
        self.data.extend_from_slice(&value.to_be_bytes());
    }

    pub fn write_u32(&mut self, value: u32)
    {
        self.data.extend_from_slice(&value.to_be_bytes());
    }

    pub fn write_f32(&mut self, value: f32)
    {
        self.data.extend_from_slice(&value.to_be_bytes());
    }

    pub fn write_varuint(&mut self, value: u32)
    {
        let mut value: u32 = value;
        loop {
            let mut byte: u8 = (value & 0x7F) as u8;
            value >>= 7;

            if value != 0 {
                byte |= 0x80;
            }

            self.write_u8(byte);
            if value == 0 {
                break;
            }
        }
    }

    pub fn write_string(&mut self, value: &str)
    {
        self.write_varuint(value.len() as u32);
        self.data.extend_from_slice(value.as_bytes());
    }

    pub fn backspace(&mut self, amount: usize)
    {
        let current_len = self.data.len();

        if amount <= current_len {
            self.data.truncate(current_len - amount);
        }
    }

    pub fn borrow_data(&self) -> &BytesMut
    {
        &self.data
    }

    pub fn move_data(self) -> BytesMut
    {
        self.data
    }
}
