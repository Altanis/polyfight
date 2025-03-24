use crate::{
    env,
    error,
    game::entity::components::entity_identity::TankCategories,
    utils::config::PRODUCTION,
};
use futures_util::{
    StreamExt,
    TryStreamExt,
};
use mysql::{
    params,
    prelude::Queryable,
    Pool,
    PooledConn,
};
use skillratings::glicko2::Glicko2Rating;
use std::{
    cell::LazyCell,
    collections::HashMap,
    net::IpAddr,
    sync::LazyLock,
    time::Instant,
};
use strum::EnumCount;
use tokio::sync::OnceCell;

/// Wraps around `reqwest::get` and logs to the console any errors.
pub async fn safe_get(url: String) -> Result<String, Box<dyn std::error::Error>>
{
    Ok(reqwest::get(url).await?.text().await?)
}

/// FIREBASE API ///
pub async fn get_token_information(token: &str) -> Result<String, Box<dyn std::error::Error>>
{
    let url = format!(
        "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key={}",
        env!("FIREBASE_API_KEY")
    );

    let client = reqwest::Client::new();
    let response = client
        .post(url)
        .header("Content-Type", "application/json")
        .body(
            serde_json::json!({
                "id_token": token
            })
            .to_string(),
        )
        .send()
        .await?;

    let body: serde_json::Value = serde_json::from_str(&response.text().await?)?;
    Ok(body["users"]
        .as_array()
        .ok_or("No array")?
        .first()
        .ok_or("No first el")?
        .as_object()
        .ok_or("No object")?["localId"]
        .as_str()
        .ok_or("No local id")?
        .to_string())
}

/// DATABASE API ///
#[derive(Debug, Clone, PartialEq, serde::Deserialize, serde::Serialize)]
pub struct UserData
{
    pub id: String,
    pub name: String,
    pub elo: [Glicko2Rating; TankCategories::COUNT - 1],
}

#[derive(Default, Clone, serde::Serialize)]
pub struct LeaderboardEntry
{
    pub name: String,
    pub elo: f64,
}

pub struct DatabaseContext
{
    pub pool: Pool,
    /// The top 10 ELO players per category.
    pub leaderboard: [[LeaderboardEntry; 10]; TankCategories::COUNT - 1 + 1],
}

impl DatabaseContext
{
    pub fn new() -> Self
    {
        let url = format!(
            "mysql://root:{}@{}/{}",
            env!("MYSQL_PASSWORD"),
            env!("MYSQL_IP"),
            if PRODUCTION {
                "polyfight_prod"
            } else {
                "polyfight_dev"
            }
        );
        let pool = Pool::new(url.as_str()).expect("Could not initialise database connection.");

        let mut conn = pool
            .get_conn()
            .expect("Could not get connection from pool.");

        conn.query_drop(
            r"CREATE TABLE IF NOT EXISTS USERS (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(18),
                elo TEXT
            )",
        )
        .expect("Could not ensure the USERS table exists.");

        DatabaseContext {
            pool,
            leaderboard: Default::default(),
        }
    }

    pub fn ping(&self) -> Result<(), mysql::Error>
    {
        let mut conn: PooledConn = self.pool.get_conn()?;
        conn.query_drop("SELECT 1;")
    }

    pub fn create_user(&self, user_data: UserData) -> Result<UserData, Box<dyn std::error::Error>>
    {
        // dbg!("create started!");
        // let time = Instant::now();

        let elo_json = serde_json::to_string(&user_data.elo)?;
        let mut conn = self.pool.get_conn()?;
        conn.exec_drop(
            r"INSERT INTO USERS (id, name, elo)
                    VALUES (:id, :name, :elo)
                    ON DUPLICATE KEY UPDATE
                    name = VALUES(name),
                    elo = VALUES(elo)",
            params! {
                "id" => user_data.id.clone(),
                "name" => user_data.name.clone(),
                "elo" => elo_json
            },
        )?;

        // println!("Create time: {:?}", time.elapsed());

        Ok(user_data)
    }

    pub fn read_user_by_id(
        &self,
        id: &String,
    ) -> Result<Option<UserData>, Box<dyn std::error::Error>>
    {
        // dbg!("read started!");
        // let time = Instant::now();

        let mut conn = self.pool.get_conn()?;
        let result: Option<(String, String)> = conn.exec_first(
            r"SELECT elo, name FROM USERS WHERE id = :id",
            params! {
                "id" => id,
            },
        )?;

        // println!("Read time: {:?}", time.elapsed());

        if let Some((elo_json, name)) = result {
            let elo: [Glicko2Rating; TankCategories::COUNT - 1] = serde_json::from_str(&elo_json)?;
            Ok(Some(UserData {
                id: id.clone(),
                elo,
                name,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn read_user_by_name(
        &self,
        name: &String,
    ) -> Result<Option<UserData>, Box<dyn std::error::Error>>
    {
        // dbg!("read started!");
        // let time = Instant::now();

        let mut conn = self.pool.get_conn()?;
        let result: Option<(String, String)> = conn.exec_first(
            r"SELECT elo, id FROM USERS WHERE name = :name",
            params! {
                "name" => name,
            },
        )?;

        // println!("Read time: {:?}", time.elapsed());

        if let Some((elo_json, id)) = result {
            let elo: [Glicko2Rating; TankCategories::COUNT - 1] = serde_json::from_str(&elo_json)?;
            Ok(Some(UserData {
                id,
                elo,
                name: name.clone(),
            }))
        } else {
            Ok(None)
        }
    }

    pub fn read_all_users(&self) -> Result<Vec<UserData>, Box<dyn std::error::Error>>
    {
        // dbg!("read started!");
        // let time = Instant::now();

        let mut conn = self.pool.get_conn()?;
        let result: Vec<(String, String, String)> = conn
            .query_map(r"SELECT id, name, elo FROM USERS", |(id, name, elo)| {
                (id, name, elo)
            })?;

        // println!("Read time: {:?}", time.elapsed());

        let mut users = Vec::new();
        for (id, name, elo_json) in result {
            let elo: [Glicko2Rating; TankCategories::COUNT - 1] = serde_json::from_str(&elo_json)?;
            users.push(UserData { id, elo, name });
        }

        Ok(users)
    }

    pub fn delete_user(&self, id: &String) -> Result<(), Box<dyn std::error::Error>>
    {
        // dbg!("delete started!");
        let time = Instant::now();

        let mut conn = self.pool.get_conn()?;
        conn.exec_drop(
            r"DELETE FROM USERS WHERE id = :id",
            params! {
                "id" => id,
            },
        )?;

        // println!("Delete time: {:?}", time.elapsed());

        Ok(())
    }

    pub fn drop_database(&self)
    {
        if PRODUCTION {
            panic!("you dont wanna do this");
        }

        let mut conn: PooledConn = self.pool.get_conn().unwrap();
        conn.query_drop("DROP TABLE USERS").unwrap();
    }
}

/// PROXY DETECTOR API ///
pub struct ProxyDetector
{
    /// A hashmap caching all known IPs with their blacklist status.
    pub ip_map: HashMap<IpAddr, bool>,
}

impl ProxyDetector
{
    pub fn new() -> Self
    {
        ProxyDetector {
            ip_map: HashMap::new(),
        }
    }

    pub async fn check_proxy(&mut self, ip: IpAddr) -> Result<bool, Box<dyn std::error::Error>>
    {
        if let Some(is_proxy) = self.ip_map.get(&ip) {
            return Ok(*is_proxy);
        }

        let url = format!(
            "http://proxycheck.io/v2/{}?key={}&vpn=1",
            ip,
            env!("PROXY_API_KEY")
        );
        let request = safe_get(url).await?;
        let json: Result<serde_json::Value, serde_json::Error> = serde_json::from_str(&request);

        if let Err(e) = json {
            error!("Failed to parse JSON for IP: {}", ip);
            error!("{}", e);
            return Err("Failed to parse JSON for IP".into());
        }

        let json = json.unwrap();

        if let Some(information) = json[ip.to_string()].as_object() {
            if let Some(proxy) = information["proxy"].as_str() {
                if proxy == "yes" {
                    self.ip_map.insert(ip, true);
                    return Ok(true);
                }
            } else {
                error!("Failed to find proxy in JSON for IP: {}", ip);
                return Err("Failed to find proxy in JSON for IP.".into());
            }

            if let Some(ip_type) = information["type"].as_str() {
                if ip_type.to_lowercase() == "vpn" {
                    self.ip_map.insert(ip, true);
                    return Ok(true);
                }
            } else {
                error!("Failed to find type in JSON for IP: {}", ip);
                return Err("Failed to find type in JSON for IP.".into());
            }
        } else {
            error!("Failed to find IP in JSON for IP: {}", ip);
            return Err("Failed to find IP in JSON for IP.".into());
        }

        Ok(false)
    }
}

pub static PROXY_DETECTOR: LazyLock<ProxyDetector> = LazyLock::new(ProxyDetector::new);
