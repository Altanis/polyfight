use axum::{
    body::Body,
    extract::{
        self,
        ws::{
            CloseFrame,
            Message,
            WebSocket,
        },
        ConnectInfo,
        Query,
        Request,
        State,
        WebSocketUpgrade,
    },
    middleware::Next,
    response::{
        IntoResponse,
        Response,
    },
    Json,
    Router,
};
use axum_extra::{
    extract::{
        cookie::Cookie,
        CookieJar,
    },
    headers::{
        Upgrade,
        UserAgent,
    },
    TypedHeader,
};
use bichannel::Channel;
use bytes::Bytes;
use futures_util::{
    stream::SplitSink,
    Future,
    SinkExt,
};
use hyper::{
    HeaderMap,
    StatusCode,
};
use rand::Rng;
use skillratings::glicko2::Glicko2Rating;
use std::{
    borrow::Borrow,
    cell::RefCell,
    collections::{
        BTreeSet,
        HashMap,
    },
    error::Error,
    net::{
        IpAddr,
        SocketAddr,
    },
    pin::Pin,
    rc::Rc,
    sync::{
        atomic::AtomicU32,
        Arc,
        Mutex,
    },
    time::{
        Duration,
        Instant,
    },
};
use strum::EnumCount;
use tokio::sync::Mutex as AsyncMutex;

use crate::{
    connection::{
        apis::{
            get_token_information,
            DatabaseContext,
            LeaderboardEntry,
            ProxyDetector,
            UserData,
        },
        packets::{
            Inputs,
            UpgradeStats,
        },
        wss::{
            self,
            PlayerConnection,
            WebSocketClient,
        },
    },
    debug,
    error,
    game::{
        self,
        entity::{
            base_entity::{
                GenericEntity,
                GenericEntityHelpers,
            },
            components::entity_identity::{
                get_score_from_level,
                EntityIdentity,
                EntityIdentityIds,
                TankCategories,
            },
            shape_entity::{
                ShapeEntity,
                ShapeType,
            },
            tank_entity::{
                self,
                TankEntity,
            },
        },
        server::{
            ArenaState,
            GameMode,
            GameServer,
            GameServerConfig,
        },
    },
    physics::vec2::Vec2,
    randf,
    randstr,
    seconds_to_ticks,
    utils::{
        self,
        config::{
            self,
            BLACKLISTED_HEADER_ORDERS,
            DISCONNECT_TIMEOUT,
            PRODUCTION,
        },
        timed_mutex::AsyncTimedLock,
    },
};

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct TankInfo
{
    pub identity: EntityIdentityIds,
    pub build: [u8; UpgradeStats::COUNT],
}

#[derive(PartialEq, Debug, Clone)]
pub struct RankedRequest
{
    pub tanks: [TankInfo; 6],
    pub score_1v1: i32,
    pub identity_idx: i32,
    pub user_data: UserData,
}

/// A struct representing the WebSocket Server.
pub struct WebSocketServer
{
    /// A vector of every scoringg websocket client.
    pub ws_clients: HashMap<isize, WebSocketClient>,
    /// The ticks the websocket server has done.
    pub ticks: usize,
    /// An upwards counter for the WebSocket client ID.
    pub counter: isize,
    /// The database context.
    pub db: DatabaseContext,
    /// A vector of every ranked WebSocket client waiting for a match.
    pub ranked_clients: Arc<AsyncMutex<HashMap<String, SplitSink<WebSocket, Message>>>>,
    /// A vector of ranked requests.
    pub ranked_requests: HashMap<String, RankedRequest>,
}

/// A struct representing the servers in one struct.
pub struct Server
{
    pub ws_server: WebSocketServer,
    pub game_servers: HashMap<String, GameServer>,
}

#[derive(serde::Deserialize)]
struct RequestQueryParams
{
    id: String,
    token: String,
}

#[derive(serde::Serialize, Debug)]
struct ServerInfo
{
    pub id: String,
    pub gamemode: String,
    pub player_count: u32,
    pub private: bool,
    pub host: Option<String>,
}

impl WebSocketServer
{
    pub async fn new() -> Self
    {
        Self {
            ws_clients: HashMap::with_capacity(100),
            counter: 0,
            ticks: 0,
            db: DatabaseContext::new(),
            ranked_clients: Arc::new(AsyncMutex::new(HashMap::with_capacity(20))),
            ranked_requests: HashMap::with_capacity(20),
        }
    }

    pub async fn tick(&mut self, game_servers: &mut HashMap<String, GameServer>)
    {
        self.ticks += 1;

        let mut deletions: Vec<String> = Vec::new();

        for (uid, request) in self.ranked_requests.iter() {
            if deletions.contains(uid) {
                continue;
            }

            let mut avg_elo = 0.0;
            for tank in request.tanks.iter() {
                let entity_identity: EntityIdentity = tank.identity.try_into().unwrap();
                avg_elo += request.user_data.elo[entity_identity.category as usize].rating;
            }
            avg_elo /= 6.0;

            let (mut other_uid, mut other_elo) = (String::new(), 0.0);

            for (uid2, request2) in self.ranked_requests.iter() {
                let mut opp_elo = 0.0;
                for tank in request.tanks.iter() {
                    let entity_identity: EntityIdentity = tank.identity.try_into().unwrap();
                    opp_elo += request2.user_data.elo[entity_identity.category as usize].rating;
                }
                opp_elo /= 6.0;

                if uid != uid2 && ((avg_elo - opp_elo).abs() < other_elo || other_elo == 0.0) {
                    other_elo = opp_elo;
                    other_uid.clone_from(uid2);
                }
            }

            if other_elo != 0.0 {
                let mut map = HashMap::new();
                map.insert(uid.clone(), request.clone());
                map.insert(
                    other_uid.clone(),
                    self.ranked_requests.get(&other_uid).unwrap().clone(),
                );

                deletions.push(uid.clone());
                deletions.push(other_uid.clone());

                let id = randstr!(16);

                let config = GameServerConfig {
                    arena_size: 2500.0,
                    wanted_shape_count: 0,
                    disabled_flags: vec![Inputs::LevelUp, Inputs::SwitchTank, Inputs::GodMode],
                    game_mode: GameMode::Ranked(map),
                    private: true,
                    max_players: 2,
                    allowed_uids: vec![uid.clone(), other_uid.clone()],
                    bot_count: 0,
                };

                let mut game_server = GameServer::new(config, None);
                game_servers.insert(id.clone(), game_server);

                let mut ranked_clients = self.ranked_clients.lock().await;
                {
                    let sender = ranked_clients.get_mut(uid).unwrap();
                    let _ = sender
                        .send(Message::Close(Some(CloseFrame {
                            code: 4069,
                            reason: id.clone().into(),
                        })))
                        .await;
                }

                {
                    let sender2 = ranked_clients.get_mut(&other_uid).unwrap();
                    let _ = sender2
                        .send(Message::Close(Some(CloseFrame {
                            code: 4069,
                            reason: id.into(),
                        })))
                        .await;
                }
            }
        }

        for deletion in deletions.into_iter() {
            self.ranked_requests.remove(&deletion);
        }

        let mut deletions: BTreeSet<_> = BTreeSet::new();

        for (i, client) in self.ws_clients.iter_mut() {
            if let Some(game_server) = game_servers.get_mut(&client.game_server) {
                if client.close.0
                    && let Some(sender) = client.sender.as_mut()
                {
                    let _ = sender.close().await;
                    client.sender = None;
                    deletions.insert(std::cmp::Reverse(*i));

                    if client.close.1 {
                        game_server
                            .banned_connections
                            .push(client.connection.clone());
                    }
                } else if let Some(entity_id) = client.entity_id
                    && let Some(tank) = game_server.entities.get(&entity_id)
                    && let GenericEntity::Tank(tank) = &mut *tank.borrow_mut()
                {
                    let sender = client.sender.as_mut().unwrap();
                    while let Some(packet) = tank.packets.pop() {
                        let _ = sender.send(Message::Binary(packet.into())).await;
                    }
                }
            } else if let Some(sender) = client.sender.as_mut() {
                let _ = sender.close().await;
                client.sender = None;
                deletions.insert(std::cmp::Reverse(*i));
            }
        }

        for deletion in deletions.into_iter() {
            self.ws_clients.remove(&deletion.0);
        }
    }
}

fn verify_client(headers: &HeaderMap) -> Result<bool, ()>
{
    Ok(true)

    // let host = headers.get("host").ok_or(())?.to_str().map_err(|_| ())?;
    // let origin = headers.get("origin").ok_or(())?.to_str().map_err(|_| ())?;
    // let user_agent = headers.get("user-agent").ok_or(())?.to_str().map_err(|_| ())?;

    // for &name in &["accept-encoding", "accept-language"]
    // {
    //     let value = headers.get(name).ok_or(())?.to_str().map_err(|_| ())?;
    // }

    // let header_keys_vec: Vec<&str> = headers.keys().map(|e| e.as_str()).collect();
    // for header_order in BLACKLISTED_HEADER_ORDERS.iter()
    // {
    //     if *header_order == header_keys_vec
    //     {
    //         return Ok(false);
    //     }
    // }

    // let valid_header_content =
    //     (host == "polyfight.io" || host == "polyfight.live" || host == "localhost:8080" || host
    // == "100.33.16.208:8080") && // Host Check     (origin == "https://polyfight.io" || origin == "https://polyfight.live" || origin == "http://localhost:3000" || origin == "http://100.33.16.208:3000") && // Origin Check
    //     (user_agent.contains("Mozilla")); // User Agent Check

    // Ok(valid_header_content)
}

async fn connect_1v1_client(
    ws: WebSocketUpgrade,
    headers: HeaderMap,
    State((server, _)): State<(Arc<AsyncMutex<Server>>, Arc<Mutex<Vec<ServerInfo>>>)>,
    query: Query<RequestQueryParams>,
    req: Request<Body>,
) -> impl IntoResponse
{
    debug!("A client is connecting...");

    let uri = req.uri().to_string();
    let id = query.0.id;

    if PRODUCTION {
        let verification = verify_client(&headers);
        if verification.is_err() || !verification.unwrap() {
            return Response::builder()
                .status(StatusCode::UPGRADE_REQUIRED)
                .body("`Upgrade` header did not include 'websocket'".into())
                .unwrap();
        }
    }

    let token = match query.0.token.as_str() {
        "undefined" => "",
        o => o,
    };

    if token.is_empty() {
        return Response::builder()
            .status(StatusCode::BAD_REQUEST)
            .body("You need to be logged in to play 1v1.".into())
            .unwrap();
    }

    let mut uid = if token.is_empty() {
        String::new()
    } else {
        get_token_information(token).await.unwrap_or(String::new())
    };

    ws.on_upgrade(move |socket| wss::incoming_1v1_connection(socket, server.clone(), uid))
}

async fn connect_scoring_client(
    ws: WebSocketUpgrade,
    headers: HeaderMap,
    user_agent: Option<TypedHeader<UserAgent>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    State((server, _)): State<(Arc<AsyncMutex<Server>>, Arc<Mutex<Vec<ServerInfo>>>)>,
    query: Query<RequestQueryParams>,
    req: Request<Body>,
) -> impl IntoResponse
{
    debug!("A client is connecting...");

    let uri = req.uri().to_string();
    let id = query.0.id;

    if PRODUCTION {
        let verification = verify_client(&headers);
        if verification.is_err() || !verification.unwrap() {
            return Response::builder()
                .status(StatusCode::UPGRADE_REQUIRED)
                .body("`Upgrade` header did not include 'websocket'".into())
                .unwrap();
        }
    }

    let token = match query.0.token.as_str() {
        "undefined" => "",
        o => o,
    };

    let mut uid = if token.is_empty() {
        String::new()
    } else {
        get_token_information(token).await.unwrap_or(String::new())
    };

    let (addr, id, game_server_key) = {
        let mut full_server = server.lock_with_timeout().await;
        let mut user_data: Option<UserData> = None;

        if !uid.is_empty() {
            if let Ok(ret) = full_server.ws_server.db.read_user_by_id(&uid) {
                user_data = ret;
            }
        }

        if let Some(game_server) = full_server.game_servers.get_mut(&id.to_string()) {
            let max_player_count = game_server.config.max_players as usize;

            if game_server.player_count >= max_player_count as u32 {
                return Response::builder()
                    .status(StatusCode::BAD_REQUEST)
                    .body("The lobby is filled.".into())
                    .unwrap();
            } else if !game_server.config.allowed_uids.is_empty()
                && !game_server.config.allowed_uids.contains(&uid)
            {
                return Response::builder()
                    .status(StatusCode::BAD_REQUEST)
                    .body("You are not allowed to join this server.".into())
                    .unwrap();
            }

            let game_server_key = id.to_string();

            full_server.ws_server.counter += 1;
            let id = full_server.ws_server.counter;

            let ip = if PRODUCTION {
                if let Ok(ip) = headers["cf-connecting-ip"].to_str() {
                    ip.to_string()
                } else {
                    addr.ip().to_string()
                }
            } else {
                addr.ip().to_string()
            };

            let client = WebSocketClient::new(
                addr,
                server.clone(),
                id,
                uid.clone(),
                user_data,
                ip,
                game_server_key.clone(),
            );
            let ip = client.addr;

            full_server.ws_server.ws_clients.insert(id, client);

            (ip, full_server.ws_server.counter, game_server_key)
        } else {
            return Response::builder()
                .status(StatusCode::BAD_REQUEST)
                .body("Invalid server ID.".into())
                .unwrap();
        }
    };

    ws.on_upgrade(move |socket| {
        wss::incoming_scoring_connection(socket, server.clone(), id, addr, game_server_key, uid)
    })
}

async fn auth_middleware(req: Request, next: Next) -> Result<Response, (StatusCode, &'static str)>
{
    match verify_client(req.headers()) {
        Ok(true) => Ok(next.run(req).await),
        _ => Err((
            StatusCode::UPGRADE_REQUIRED,
            "`Upgrade` header did not include 'websocket'",
        )),
    }
}

impl Server
{
    pub async fn init(configs: HashMap<String, GameServerConfig>)
    {
        let mut ws_server = WebSocketServer::new().await;
        let mut game_servers: HashMap<String, GameServer> = HashMap::new();

        // ws_server.db.drop_database();

        for (id, config) in configs.into_iter() {
            let id = id.clone();

            let wanted_shape_count = config.wanted_shape_count;
            let mut game_server = GameServer::new(config, None);
            for _ in 0..wanted_shape_count {
                game_server.spawn_random_shape();
            }

            game_servers.insert(id, game_server);
        }

        let server = Arc::new(AsyncMutex::new(Server {
            ws_server,
            game_servers,
        }));

        let other_other_server_clone = server.clone();
        let other_server_clone = server.clone();
        let server_clone = server.clone();
        let servers = Arc::new(Mutex::new(Vec::<ServerInfo>::new()));

        let server_state: (Arc<AsyncMutex<Server>>, Arc<Mutex<Vec<ServerInfo>>>) =
            (server.clone(), servers.clone());

        tokio::task::spawn(async {
            #[derive(serde::Serialize, serde::Deserialize)]
            pub struct RegistrationInfo
            {
                pub name: String,
            };

            #[derive(serde::Serialize, serde::Deserialize)]
            pub struct PlayerInfoRequest
            {
                pub identifier: String,
                pub category: String,
            };

            let app = Router::new()
                .route("/scoring", axum::routing::get(connect_scoring_client))
                .route("/1v1", axum::routing::get(connect_1v1_client))
                .route("/servers", axum::routing::get(move |State((_, servers)): State<(Arc<AsyncMutex<Server>>, Arc<Mutex<Vec<ServerInfo>>>)>| async move
                {
                    let servers = &mut *servers.lock().unwrap();

                    Response::builder()
                        .status(StatusCode::OK)
                        .header("Content-Type", "application/json")
                        .body(serde_json::to_string(&servers).unwrap())
                        .unwrap()
                }))
                .route("/create_server", axum::routing::get(move
                |
                    headers: HeaderMap,
                    jar: CookieJar,
                    Query(params): Query<HashMap<String, bool>>,
                    State((_, _)): State<(Arc<AsyncMutex<Server>>, Arc<Mutex<Vec<ServerInfo>>>)>
                | async move
                {
                    let private = params.get("private").unwrap_or(&false);

                    let token = match jar.get("token")
                    {
                        Some(t) => t.value(),
                        None =>
                        {
                            return Response::builder()
                                .status(StatusCode::BAD_REQUEST)
                                .body("Guest users are not allowed to create sandboxes. Please log in with Google.".to_string())
                                .unwrap();
                        }
                    };

                    let uid = match get_token_information(token).await
                    {
                        Ok(u) => u,
                        Err(_) =>
                        {
                            return Response::builder()
                                .status(StatusCode::BAD_REQUEST)
                                .body("Your Google account is not recognisable. Please contact the developers.".to_string())
                                .unwrap();
                        }
                    };

                    let mut full_server = server.lock_with_timeout().await;

                    for (id, game_server) in full_server.game_servers.iter()
                    {
                        if let Some(host) = &game_server.host_uid && uid == *host
                        {
                            return Response::builder()
                                .status(StatusCode::BAD_REQUEST)
                                .body("You are already hosting another sandbox.".to_string())
                                .unwrap();
                        }
                    }

                    let wanted_shape_count = 50;
                    let id = randstr!(16);

                    let config = GameServerConfig
                    {
                        arena_size: 2500.0,
                        wanted_shape_count,
                        disabled_flags: vec![Inputs::SwitchTank, Inputs::GodMode],
                        game_mode: GameMode::Sandbox,
                        private: *private,
                        max_players: 50,
                        allowed_uids: Vec::new(),
                        bot_count: 0
                    };

                    let server_info = ServerInfo
                    {
                        id: id.clone(),
                        gamemode: config.game_mode.to_string(),
                        player_count: 0,
                        private: config.private,
                        host: Some(uid.clone())
                    };

                    let mut game_server = GameServer::new(config, Some(uid));
                    for _ in 0..wanted_shape_count
                    {
                        game_server.spawn_random_shape();
                    }

                    full_server.game_servers.insert(id, game_server);

                    Response::builder()
                        .status(StatusCode::OK)
                        .header("Content-Type", "application/json")
                        .body(serde_json::to_string(&server_info).unwrap())
                        .unwrap()
                }))
                .route("/get_player_info", axum::routing::post(move
                |
                    Query(params): Query<HashMap<String, String>>,
                    State((server, _)): State<(Arc<AsyncMutex<Server>>, Arc<Mutex<Vec<ServerInfo>>>)>,
                    Json(body): Json<PlayerInfoRequest>
                | async move
                {
                    match body.category.as_str()
                    {
                        "uid" =>
                        {
                            let mut full_server = server.lock_with_timeout().await;
                            let user = full_server.ws_server.db.read_user_by_id(&body.identifier).unwrap();

                            if let Some(user) = user
                            {
                                return Response::builder()
                                    .status(StatusCode::OK)
                                    .header("Content-Type", "application/json")
                                    .body(serde_json::to_string(&user).unwrap())
                                    .unwrap()
                            }
                        },
                        "name" =>
                        {
                            let mut full_server = server.lock_with_timeout().await;
                            let user = full_server.ws_server.db.read_user_by_name(&body.identifier).unwrap();

                            if let Some(user) = user
                            {
                                return Response::builder()
                                    .status(StatusCode::OK)
                                    .header("Content-Type", "application/json")
                                    .body(serde_json::to_string(&user).unwrap())
                                    .unwrap()
                            }
                        },
                        _ => ()
                    }

                    Response::builder()
                        .status(StatusCode::BAD_REQUEST)
                        .body("Invalid UID.".to_string())
                        .unwrap()
                }))
                .route("/is_registered", axum::routing::get(move
                |
                    jar: CookieJar,
                    State((server, _)): State<(Arc<AsyncMutex<Server>>, Arc<Mutex<Vec<ServerInfo>>>)>
                | async move
                {
                    let token = match jar.get("token")
                    {
                        Some(t) => t.value(),
                        None =>
                        {
                            return Response::builder()
                                .status(StatusCode::BAD_REQUEST)
                                .body("Please log in with Google".to_string())
                                .unwrap();
                        }
                    };

                    let uid = match get_token_information(token).await
                    {
                        Ok(u) => u,
                        Err(_) =>
                        {
                            return Response::builder()
                                .status(StatusCode::BAD_REQUEST)
                                .body("Your Google account is not recognisable. Please contact the developers.".to_string())
                                .unwrap();
                        }
                    };

                    let mut full_server = server.lock_with_timeout().await;
                    let exists = matches!(full_server.ws_server.db.read_user_by_id(&uid), Ok(Some(_)));

                    Response::builder()
                        .status(if exists { StatusCode::OK } else { StatusCode::NOT_FOUND })
                        .body("".to_string())
                        .unwrap()
                }))
                .route("/register", axum::routing::post(move
                |
                    jar: CookieJar,
                    State((server, _)): State<(Arc<AsyncMutex<Server>>, Arc<Mutex<Vec<ServerInfo>>>)>,
                    Json(body): Json<RegistrationInfo>
                | async move
                {
                    if body.name.len() > 18
                    {
                        return Response::builder()
                            .status(StatusCode::BAD_REQUEST)
                            .body("Name is too long.".to_string())
                            .unwrap();
                    }

                    let token = match jar.get("token")
                    {
                        Some(t) => t.value(),
                        None =>
                        {
                            return Response::builder()
                                .status(StatusCode::BAD_REQUEST)
                                .body("Please log in with Google".to_string())
                                .unwrap();
                        }
                    };

                    let uid = match get_token_information(token).await
                    {
                        Ok(u) => u,
                        Err(_) =>
                        {
                            return Response::builder()
                                .status(StatusCode::BAD_REQUEST)
                                .body("Your Google account is not recognisable. Please contact the developers.".to_string())
                                .unwrap();
                        }
                    };

                    let mut full_server = server.lock_with_timeout().await;
                    if matches!(full_server.ws_server.db.read_user_by_name(&body.name), Ok(Some(_)))
                    {
                        return Response::builder()
                            .status(StatusCode::CONFLICT)
                            .body("".to_string())
                            .unwrap();
                    }

                    if let Err(x) = full_server.ws_server.db.create_user(UserData
                    {
                        id: uid.clone(),
                        name: body.name.clone(),
                        elo: [Glicko2Rating::default(); TankCategories::COUNT - 1]
                    })
                    {
                        dbg!(x);

                        Response::builder()
                            .status(StatusCode::INTERNAL_SERVER_ERROR)
                            .body("".to_string())
                            .unwrap()
                    }
                    else
                    {
                        Response::builder()
                            .status(StatusCode::OK)
                            .body("".to_string())
                            .unwrap()
                    }
                }))
                .route("/leaderboard", axum::routing::get(move
                |
                    State((server, _)): State<(Arc<AsyncMutex<Server>>, Arc<Mutex<Vec<ServerInfo>>>)>
                | async move
                {
                    let full_server = server.lock().await;

                    Response::builder()
                        .status(StatusCode::OK)
                        .body(serde_json::to_string(&full_server.ws_server.db.leaderboard).unwrap())
                        .unwrap()
                }))              
                .layer(tower_http::cors::CorsLayer::very_permissive())
                .layer(axum::middleware::from_fn(auth_middleware))
                .with_state(server_state);

            let listener =
                tokio::net::TcpListener::bind(format!("0.0.0.0:{}", utils::config::PORT))
                    .await
                    .unwrap();

            axum::serve(
                listener,
                app.into_make_service_with_connect_info::<SocketAddr>(),
            )
            .await
            .unwrap();
        });

        std::thread::spawn(move || {
            let refresh_top_players = || {
                let users = {
                    let full_server = other_server_clone.blocking_lock();
                    full_server.ws_server.db.read_all_users()
                };

                let mut top_players: [[LeaderboardEntry; 10]; TankCategories::COUNT - 1 + 1] =
                    Default::default();

                if let Ok(users) = users {
                    for category_index in 0..(TankCategories::COUNT - 1) {
                        let mut category_users: Vec<_> = users
                            .iter()
                            .map(|user| LeaderboardEntry {
                                name: user.name.clone(),
                                elo: user.elo[category_index].rating,
                            })
                            .collect();

                        category_users.sort_by(|a, b| {
                            b.elo
                                .partial_cmp(&a.elo)
                                .unwrap_or(std::cmp::Ordering::Equal)
                        });

                        for (i, entry) in category_users.iter().take(10).enumerate() {
                            top_players[category_index][i] = entry.clone();
                        }
                    }

                    let mut category_users: Vec<_> = users
                        .iter()
                        .map(|user| LeaderboardEntry {
                            name: user.name.clone(),
                            elo: user.elo.iter().map(|x| x.rating).sum::<f64>()
                                / user.elo.len() as f64,
                        })
                        .collect();

                    category_users.sort_by(|a, b| {
                        b.elo
                            .partial_cmp(&a.elo)
                            .unwrap_or(std::cmp::Ordering::Equal)
                    });

                    for (i, entry) in category_users.iter().take(10).enumerate() {
                        top_players[TankCategories::COUNT - 1][i] = entry.clone();
                    }
                } else {
                    error!("An error occured when fetching stuff:", users.unwrap_err());
                }

                {
                    let mut full_server = other_server_clone.blocking_lock();
                    full_server.ws_server.db.leaderboard = top_players;
                }
            };

            refresh_top_players();

            let mut interval = std::time::Duration::from_mins(5);
            loop {
                std::thread::sleep(interval);
                refresh_top_players();
            }
        });


        std::thread::spawn(move || {
            let mut interval = std::time::Duration::from_secs(20);
            loop {
                std::thread::sleep(interval);

                {
                    let mut full_server = other_other_server_clone.blocking_lock();
                    let _ = full_server.ws_server.db.ping();
                }
            }
        });

        let mut interval = tokio::time::interval(tokio::time::Duration::from_millis(config::MSPT));
        loop {
            interval.tick().await;

            {
                let mut full_server = &mut *server_clone.lock_with_timeout().await;

                let instant = Instant::now();
                {
                    let mut servers = &mut *servers.lock().unwrap();
                    servers.clear();

                    let deletions: Vec<String> = full_server
                        .game_servers
                        .iter_mut()
                        .filter(|(id, game_server)| {
                            ((game_server.config.game_mode != GameMode::FFA)
                                && (game_server
                                    .last_tick
                                    .duration_since(game_server.creation_tick))
                                    >= Duration::from_secs_f32(30.0)
                                && game_server
                                    .entities
                                    .iter()
                                    .filter(|(id, entity)| {
                                        matches!(&*(**entity).borrow(), GenericEntity::Tank(_))
                                    })
                                    .count()
                                    == 0)
                                || game_server.arena_state == ArenaState::Closed
                        })
                        .map(|(id, _)| id.clone())
                        .collect();

                    for id in deletions.into_iter() {
                        full_server.game_servers.remove(&id);
                    }

                    for (id, game_server) in full_server.game_servers.iter_mut() {
                        let player_count = game_server.player_count;

                        if !game_server.config.private {
                            servers.push(ServerInfo {
                                id: if game_server.config.private {
                                    String::new()
                                } else {
                                    id.clone()
                                },
                                gamemode: game_server.config.game_mode.to_string(),
                                player_count,
                                private: game_server.config.private,
                                host: game_server.host_uid.clone(),
                            });
                        }

                        game_server.tick(&mut full_server.ws_server);
                    }
                }


                {
                    full_server
                        .ws_server
                        .tick(&mut full_server.game_servers)
                        .await;
                }
            }
        }
    }
}
