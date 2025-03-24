/** The phase the canvas is on while rendering. */
export enum RenderPhase
{
    /** The canvas is rendering the homescreen. */
    Home,
    /** The canvas is rendering the game. */
    Game,
    /** The canvas is rendering the game while the player is dead. */
    Dead
};

/** An enum representing outgoing packets. */
export enum OutgoingPacketHeader
{
    Spawn,
    Input,
    Stat,
    Upgrades,
    Chat,
    Ping,
    Clan,
    ArenaUpdate,
    Ready
};

/** An enum representing incoming packets. */
export enum IncomingPacketHeader
{
    Update,
    Stat,
    Upgrades,
    Notification,
    ServerInfo,
    Cipher,
    EloChange,
    Pong
};

/** Every census property the server can send. */
export enum CensusProperties
{
   Position,
   Velocity,
   Angle,
   Radius,
   Health,
   MaxHealth,
   Alive,
   IdentityId,
   Ticks,
   Clan,

   // TANK ONLY
   Name,
   Fov,
   Score,
   Invincible,
   Invisible,
   Turrets,
   Message,
   Ready,
   
   // SHAPE ONLY
   ShapeType,
   Shiny,

   // PROJECTILE ONLY
   Owner,
   Turret,
   ProjectileType
};

/** An enum representing the field types the server can send. */
export enum FieldType
{
    Create,
    Update,
    Delete
};

/** The type of entity. */
export enum EntityType
{
    Generic = -1,
    Tank,
    Shape,
    Projectile
};

/** The type of shape. */
export enum ShapeType
{
    Unknown = -1,
    Square,
    Triangle,
    SmallCrasher,
    LargeCrasher,
    Pentagon,
    AlphaPentagon
};

/** The type of projectile. */
export enum ProjectileType
{
    Bullet,
    AutoBullet,
    Drone,
    Trap,
    NecromancerDrone,
    Minion,
    Railgun
};

/** The shiny type. */
export enum ShinyType
{
    Normal,
    Shiny,
    Mythical
}

/** An enum representing the "dying phase". */
export enum DyingPhase
{
    None = -1,
    Alive,
    Dying,
    Dead
};

/** An enum representing the stats a tank can upgrade. */
export enum UpgradeStats
{
    HealthRegen,
    MaxHealth,
    BodyDamage,
    ProjectileSpeed,
    ProjectilePenetration,
    ProjectileDamage,
    ProjectileReload,
    MovementSpeed,
    Fov,
    Sentinel,
};

export enum EntityIdentityIds
{
    Projectile = 0,
    Square = 1,
    Triangle = 2,
    SmallCrasher = 3,
    LargeCrasher = 4,
    Pentagon = 5,
    AlphaPentagon = 6,
    BasicTank = 7,
    Twin = 8,
    FlankGuard = 9,
    Sniper = 10,
    MachineGun = 11,
    TripleShot = 12,
    QuadTank = 13,
    TwinFlank = 14,
    Assassin = 15,
    Hunter = 16,
    Destroyer = 17,
    Gunner = 18,
    Triplet = 19,
    PentaShot = 20,
    SpreadShot = 21,
    OctoTank = 22,
    TripleTwin = 23,
    Ranger = 24,
    Stalker = 25,
    Predator = 26,
    Streamliner = 27,
    Sprayer = 28,
    Annihilator = 29,
    TriAngle = 30,
    Booster = 31,
    Fighter = 32,
    Smasher = 33,
    Landmine = 34,
    Spike = 35,
    MegaSmasher = 36,
    AutoGunner = 37,
    Overseer = 38,
    Overlord = 39,
    Manager = 40,
    Hybrid = 41,
    Trapper = 42,
    TriTrapper = 43,
    GunnerTrapper = 44,
    Overtrapper = 45,
    MegaTrapper = 46,
    AutoTrapper = 47,
    Battleship = 48,
    Necromancer = 49,
    Factory = 50,
    Spectator = 51,
    Railgun = 52
};

export enum SpinType
{
    None,
    Normal,
    Tbag
};

/** An enum representing config option types. */
export enum ConfigOptionTypes
{
    Colour,
    Number,
    Boolean,
    ConstantText,
    Header,
    Subheader
};

export enum TankCategories
{
    Destroyer,
    Drone,
    Factory,
    Smasher,
    Spammer,
    Trapper,
    Sniper,
    Fighter,
    Illegal
}

/** An enum representing inputs. */
export enum Inputs
{
    Shoot      = 0b1,
    Up         = 0b10,
    Down       = 0b100,
    Left       = 0b1000,
    Right      = 0b10000,
    Repel      = 0b100000,
    LevelUp    = 0b1000000,
    SwitchTank = 0b10000000,
    GodMode    = 0b100000000,
    Suicide    = 0b1000000000
};

export enum PlayerStatus {
    Player,
    Moderator,
    Developer
};

/** A map representing a mapping of keycodes to inputs. */
export const InputMap: Map<string, Inputs> = new Map(
    [
        ["ArrowUp", Inputs.Up],
        ["KeyW", Inputs.Up],
        ["ArrowDown", Inputs.Down],
        ["KeyS", Inputs.Down],
        ["ArrowLeft", Inputs.Left],
        ["KeyA", Inputs.Left],
        ["ArrowRight", Inputs.Right],
        ["KeyD", Inputs.Right],
        ["Space", Inputs.Shoot],
        ["KeyK", Inputs.LevelUp],
        ["ShiftLeft", Inputs.Repel],
        ["ShiftRight", Inputs.Repel],
        ["Backslash", Inputs.SwitchTank],
        ["Semicolon", Inputs.GodMode],
        ["KeyO", Inputs.Suicide]
    ]
);