#![allow(clippy::type_complexity)]
#![allow(clippy::new_without_default)]
#![allow(clippy::new_ret_no_self)]
#![allow(unused)]
#![deny(unused_must_use)]
#![feature(duration_constructors)]
#![feature(let_chains)]
#![feature(duration_millis_float)]
#![feature(str_split_whitespace_remainder)]

use std::collections::HashMap;

use connection::apis::DatabaseContext;
use rand::Rng;

use game::server::{
    GameMode,
    GameServerConfig,
};
use server::Server;

mod connection;
mod game;
mod physics;
mod server;
mod utils;

#[tokio::main]
async fn main()
{
    std::env::set_var("RUST_BACKTRACE", "1");

    let mut map: HashMap<String, GameServerConfig> = HashMap::new();
    map.insert(
        randstr!(16),
        GameServerConfig {
            arena_size: 14000.0,
            wanted_shape_count: 1500,
            // disabled_flags: vec![connection::packets::Inputs::SwitchTank],
            disabled_flags: vec![connection::packets::Inputs::GodMode, connection::packets::Inputs::SwitchTank],
            game_mode: GameMode::FFA,
            private: false,
            max_players: 100,
            allowed_uids: Vec::new(),
            bot_count: 16,
        },
    );

    Server::init(map).await;
}
