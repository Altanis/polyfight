import WebSocketManager from "./connection/websocket";
import TankEntity from "./entity/tank_entity";
import Canvas from "./rendering/canvas";
import Elements from "./rendering/elements";
import { lerp } from "./utils/functions";

/** A representation of the client. */
export default class Client
{
    /** The media assets the game will use. */
    public assets = 
    {
        /** The images the game will use. */
        images: 
        {
            home: new Image(0, 0)
        },
    };

    /** The canvas the client draws ON */
    public polyfight_canvas: Canvas = new Canvas(this);
    /** The entity the client is playing as. */
    public entity: TankEntity = new TankEntity(this);
    /** The websocket connection to the server. */
    public polyfight_connection: WebSocketManager = new WebSocketManager(this);
    /** The HTML elements the client handles. */
    public polyfight_elements: Elements = new Elements(this);

    /** The configuration of the game server the entity is playing in. */
    public game_server_config = 
    {
        arena_size: 0,
        wanted_shape_count: 0
    };

    public constructor()
    {
        /** Load the media assets. */
        this.assets.images.home.src = "/views/public/assets/images/background.png";
    };
};