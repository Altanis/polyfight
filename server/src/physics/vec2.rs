use std::ops::{
    Add,
    AddAssign,
    Mul,
    MulAssign,
    Sub,
    SubAssign,
};

pub fn fuzzy_compare(a: f32, b: f32, tolerance: f32) -> bool
{
    (a - b).abs() <= tolerance
}

/// A class representing a Vector2D.
#[derive(Debug, Default, Clone, Copy, PartialEq, PartialOrd)]
pub struct Vec2
{
    pub x: f32,
    pub y: f32,
}

impl Add for Vec2
{
    type Output = Self;

    fn add(self, other: Self) -> Self
    {
        Vec2 {
            x: self.x + other.x,
            y: self.y + other.y,
        }
    }
}

impl AddAssign for Vec2
{
    fn add_assign(&mut self, other: Self)
    {
        *self = Self {
            x: self.x + other.x,
            y: self.y + other.y,
        };
    }
}

impl Sub for Vec2
{
    type Output = Self;

    fn sub(self, other: Self) -> Self
    {
        Vec2 {
            x: self.x - other.x,
            y: self.y - other.y,
        }
    }
}

impl SubAssign for Vec2
{
    fn sub_assign(&mut self, other: Self)
    {
        *self = Self {
            x: self.x - other.x,
            y: self.y - other.y,
        };
    }
}

impl Mul<f32> for Vec2
{
    type Output = Self;

    fn mul(self, scalar: f32) -> Self
    {
        Vec2 {
            x: self.x * scalar,
            y: self.y * scalar,
        }
    }
}

impl MulAssign<f32> for Vec2
{
    fn mul_assign(&mut self, scalar: f32)
    {
        *self = Self {
            x: self.x * scalar,
            y: self.y * scalar,
        };
    }
}

impl Vec2
{
    /// Constructs the Vector2D with Cartesian coordinates
    pub fn new(x: f32, y: f32) -> Self
    {
        Vec2 { x, y }
    }

    /// Constructs the Vector2D with polar coordinates
    pub fn from_polar(r: f32, theta: f32) -> Self
    {
        Vec2 {
            x: r * theta.cos(),
            y: r * theta.sin(),
        }
    }

    /// Normalises the vector.
    pub fn normalise(&mut self) -> &Self
    {
        if self.is_zero(1e-1) {
            return self;
        }

        let magnitude: f32 = self.magnitude();
        if magnitude != 0.0 {
            *self *= 1.0 / magnitude;
        }

        self
    }

    /// Gets the dot product of the vector.
    pub fn dot(&self, other: Self) -> f32
    {
        self.x * other.x + self.y * other.y
    }

    /// Gets the cross product of the vector.
    pub fn cross(&self, other: Self) -> f32
    {
        self.x * other.y - self.y * other.x
    }

    /// Gets the magnitude (squared) of the vector.
    pub fn magnitude_squared(&self) -> f32
    {
        self.x * self.x + self.y * self.y
    }

    /// Gets the magnitude of the vector.
    pub fn magnitude(&self) -> f32
    {
        self.magnitude_squared().sqrt()
    }

    /// Gets the distance of the vector from another vector.
    pub fn distance(self, other: Self) -> f32
    {
        (other - self).magnitude()
    }

    /// Gets the distance squared of the vector from another vector.
    pub fn distance_squared(self, other: Self) -> f32
    {
        (other - self).magnitude_squared()
    }

    /// Gets an orthogonal vector.
    pub fn orthogonal(self) -> Vec2
    {
        *Vec2::new(-self.y, self.x).normalise()
    }

    /// Checks if the vector is zero-ish.
    pub fn is_zero(&self, tolerance: f32) -> bool
    {
        fuzzy_compare(self.x, 0.0, tolerance) && fuzzy_compare(self.y, 0.0, tolerance)
    }

    /// Gets the angle of the vector from a reference point.
    pub fn angle(&self, other: Option<Self>) -> f32
    {
        if let Some(vec) = other {
            f32::atan2(self.y - vec.y, self.x - vec.x)
        } else {
            f32::atan2(self.y, self.x)
        }
    }

    /// Rotates the vector to a new angle.
    pub fn rotate(&mut self, angle: f32) -> &Self
    {
        let magnitude: f32 = self.magnitude();
        *self = Self {
            x: magnitude * angle.cos(),
            y: magnitude * angle.sin(),
        };

        self
    }

    /// Sets the magnitude of the vector.
    pub fn set_magnitude(&mut self, magnitude: f32) -> &Self
    {
        self.normalise();
        *self *= magnitude;

        self
    }
}

#[derive(Debug, Clone, Copy)]
pub struct Ray
{
    pub origin: Vec2,
    pub direction: Vec2,
}

impl Ray
{
    pub fn new(origin: Vec2, direction: Vec2) -> Self
    {
        Ray { origin, direction }
    }
}

#[derive(Debug)]
pub struct Circle
{
    pub center: Vec2,
    pub radius: f32,
}

impl Circle
{
    pub fn new(center: Vec2, radius: f32) -> Self
    {
        Circle { center, radius }
    }

    pub fn intersects_ray(&self, ray: &Ray) -> bool
    {
        // Implementing ray-circle intersection
        let oc = Vec2 {
            x: ray.origin.x - self.center.x,
            y: ray.origin.y - self.center.y,
        };
        let a = ray.direction.x * ray.direction.x + ray.direction.y * ray.direction.y;
        let b = 2.0 * (oc.x * ray.direction.x + oc.y * ray.direction.y);
        let c = oc.x * oc.x + oc.y * oc.y - self.radius * self.radius;
        let discriminant = b * b - 4.0 * a * c;
        discriminant > 0.0
    }
}
