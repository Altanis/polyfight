use std::collections::HashSet;

use crate::game::{
    entity::base_entity::{
        GenericEntity,
        GenericEntityHelpers,
    },
    server::GameServer,
};

use super::{
    collision,
    vec2::Vec2,
};

#[derive(Debug, Clone, Default)]
struct Entry(Vec<u32>);

#[derive(Debug, Clone, Default)]
struct Map(Vec<(u32, u32)>);

/// An extremely optimized fixed-size hash table implementation.
#[derive(Debug, Clone)]
pub struct Table<T: Default + Clone>
{
    entries: Vec<T>,
    capacity: usize,
}

impl<T: Default + Clone> Table<T>
{
    /// Create a new table with `size` entries.
    pub fn new(size: usize) -> Self
    {
        let capacity = (size * 1000).next_power_of_two() + 1;
        let entries = vec![T::default(); capacity];
        Self { entries, capacity }
    }

    /// Get entry number.
    pub fn count(&self) -> usize
    {
        self.entries.len()
    }

    #[inline(always)]
    fn index(&self, idx: u64) -> usize
    {
        (hash_u64(idx) % self.entries.len() as u64) as usize
    }

    /// Get a mutable reference to an entry from a 2D key.
    #[inline(always)]
    pub fn get_vector_mut(&mut self, x: u32, y: u32) -> &mut T
    {
        let idx = self.index(vector_hash(x, y));
        unsafe { self.entries.get_unchecked_mut(idx) }
    }

    /// Get a reference to an entry from a 2D key.
    #[inline(always)]
    pub fn get_vector(&self, x: u32, y: u32) -> &T
    {
        let idx = self.index(vector_hash(x, y));
        unsafe { self.entries.get_unchecked(idx) }
    }

    /// Get a reference to an entry from a scalar key.
    #[inline(always)]
    pub fn get_scalar(&self, s: u32) -> &T
    {
        let idx = self.index(hash_u64(s as u64));
        unsafe { self.entries.get_unchecked(idx) }
    }

    /// Get a mutable reference to an entry from a scalar key.
    #[inline(always)]
    pub fn get_scalar_mut(&mut self, s: u32) -> &mut T
    {
        let idx = self.index(hash_u64(s as u64));
        unsafe { self.entries.get_unchecked_mut(idx) }
    }

    /// Clear the table.
    pub fn clear(&mut self)
    {
        self.entries.clear();
        self.entries.resize(self.capacity, T::default());
    }
}

/// Spatial hash grid implementation.
#[derive(Debug, Clone)]
pub struct SpatialHashGrid
{
    grid: Table<Entry>,
    maps: Table<Map>,
    shift: u32,
}

impl SpatialHashGrid
{
    /// Create a new grid with a fixed bucket size and cell size.
    pub fn new(size: usize, shift: u32) -> Self
    {
        Self {
            grid: Table::new(size),
            maps: Table::new(size),
            shift,
        }
    }

    /// Get size of internal tables.
    pub fn count(&self) -> usize
    {
        self.grid.count()
    }

    /// Insert an entity.
    pub fn insert(&mut self, id: u32, position: Vec2, radius: f32)
    {
        let dimensions = radius * 2.0;

        let sx = (position.x as u32) >> self.shift;
        let sy = (position.y as u32) >> self.shift;
        let ex = ((position.x + dimensions) as u32) >> self.shift;
        let ey = ((position.y + dimensions) as u32) >> self.shift;

        let is_ideal = sx == ex && sy == ey;

        let map = self.maps.get_scalar_mut(id);
        for y in sy..=ey {
            for x in sx..=ex {
                let cell = self.grid.get_vector_mut(x, y);
                map.0.push((x, y));
                cell.0.push(id | ((is_ideal as u32) << 31));
            }
        }
    }

    /// Delete an entity by ID.
    pub fn delete(&mut self, id: u32)
    {
        let map = self.maps.get_scalar(id);
        for &(x, y) in map.0.iter() {
            let cell = self.grid.get_vector_mut(x, y);
            let index = cell.0.iter().position(|x| (*x & !(1 << 31)) == id).unwrap();
            cell.0.remove(index);
        }

        self.maps.get_scalar_mut(id).0.clear();
    }

    /// Retrieve entities in a circular region.
    pub fn query_radius(&self, entity_id: u32, position: Vec2, radius: f32) -> Vec<u32>
    {
        let mut result: Vec<u32> = Vec::new();

        let dimensions = radius * 2.0;

        let sx = (position.x as u32) >> self.shift;
        let sy = (position.y as u32) >> self.shift;
        let ex = ((position.x + dimensions) as u32) >> self.shift;
        let ey = ((position.y + dimensions) as u32) >> self.shift;

        let is_ideal = sx == ex && sy == ey;

        for y in sy..=ey {
            for x in sx..=ex {
                let region = self.grid.get_vector(x, y);
                for id in region.0.iter() {
                    // there CANNOT be duplicates if we are only checking a single cell.
                    // we do not have to deduplicate an ID if it is known to only occupy a single
                    // cell.
                    if (*id & !(1 << 31)) == entity_id {
                        continue;
                    }

                    if id & (1 << 31) != 0 || is_ideal {
                        result.push(*id & !(1 << 31));
                    } else if !result.contains(id) && *id != entity_id {
                        result.push(*id);
                    }
                }
            }
        }

        result
    }

    /// Retrieve entities in a rectangular region.
    pub fn query_rect(&self, entity_id: u32, position: Vec2, width: f32, height: f32) -> Vec<u32>
    {
        let mut result: Vec<u32> = Vec::new();

        let sx = (position.x as u32) >> self.shift;
        let sy = (position.y as u32) >> self.shift;
        let ex = ((position.x + width) as u32) >> self.shift;
        let ey = ((position.y + height) as u32) >> self.shift;

        let is_ideal = sx == ex && sy == ey;

        for y in sy..=ey {
            for x in sx..=ex {
                let region = self.grid.get_vector(x, y);
                for id in region.0.iter() {
                    // there CANNOT be duplicates if we are only checking a single cell.
                    // we do not have to deduplicate an ID if it is known to only occupy a single
                    // cell.
                    if (*id & !(1 << 31)) == entity_id {
                        continue;
                    }

                    if id & (1 << 31) != 0 || is_ideal {
                        result.push(*id & !(1 << 31));
                    } else if !result.contains(id) && *id != entity_id {
                        result.push(*id);
                    }
                }
            }
        }

        result
    }

    /// Performs collision detection on every cell.
    // pub fn query_all(&self, entities: &mut Vec<Option<GenericEntity>>)
    // {
    //     for cell in self.grid.entries.iter()
    //     {
    //         let length = cell.0.len();
    //         if length < 2 { continue; }

    //         for i in 0..length {
    //             for j in i + 1..length {
    //                 let entity1 = cell.0[i] & !(1 << 31);
    //                 let entity2 = cell.0[j] & !(1 << 31);

    //                 if let Some(mut e1) = entities[entity1 as usize].take()
    //                 {
    //                     if let Some(mut e2) = entities[entity2 as usize].take()
    //                     {
    //                         if collision::detect_collision(e1.get_mut_base_entity(),
    // e2.get_mut_base_entity())                         {
    //                             e1.handle_collision(&mut e2);
    //                             e2.handle_collision(&mut e1);
    //                         }

    //                         entities[entity1 as usize] = Some(e1);
    //                         entities[entity2 as usize] = Some(e2);
    //                     }
    //                 }
    //             }
    //         }
    //     }
    // }

    /// Reinsert an entity into the grid.
    pub fn reinsert(&mut self, id: u32, position: Vec2, radius: f32)
    {
        self.delete(id);
        self.insert(id, position, radius)
    }

    /// Clear the grid.
    pub fn clear(&mut self)
    {
        self.grid.clear();
        self.maps.clear();
    }
}

#[inline]
fn vector_hash(x: u32, y: u32) -> u64
{
    ((x as u64) << 32) | y as u64
}

/// Identity hash for now
#[inline]
fn hash_u64(seed: u64) -> u64
{
    seed
}
