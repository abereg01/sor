use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub bind_addr: String,
    pub cors_origins: Vec<String>,
    pub local_admin_username: String,
    pub local_admin_password: String,
    pub auth_jwt_secret: String,
    pub auth_token_ttl_seconds: u64,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let database_url = env::var("DATABASE_URL")
            .map_err(|_| anyhow::anyhow!("Missing required environment variable: DATABASE_URL"))?;

        let bind_addr = env::var("BIND_ADDR").unwrap_or_else(|_| "0.0.0.0:8080".to_string());

        let cors_raw = env::var("CORS_ORIGINS")
            .or_else(|_| env::var("CORS_ORIGIN"))
            .unwrap_or_else(|_| "http://localhost:5173".to_string());

        let cors_origins: Vec<String> = cors_raw
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        if cors_origins.is_empty() {
            return Err(anyhow::anyhow!(
                "CORS origins resolved to an empty list (check CORS_ORIGINS/CORS_ORIGIN)"
            ));
        }

        let local_admin_username = env::var("LOCAL_ADMIN_USERNAME").map_err(|_| {
            anyhow::anyhow!("Missing required environment variable: LOCAL_ADMIN_USERNAME")
        })?;

        let local_admin_password = env::var("LOCAL_ADMIN_PASSWORD").map_err(|_| {
            anyhow::anyhow!("Missing required environment variable: LOCAL_ADMIN_PASSWORD")
        })?;

        let auth_jwt_secret = env::var("AUTH_JWT_SECRET").map_err(|_| {
            anyhow::anyhow!("Missing required environment variable: AUTH_JWT_SECRET")
        })?;

        let auth_token_ttl_seconds: u64 = env::var("AUTH_TOKEN_TTL_SECONDS")
            .ok()
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(12 * 60 * 60);

        Ok(Self {
            database_url,
            bind_addr,
            cors_origins,
            local_admin_username,
            local_admin_password,
            auth_jwt_secret,
            auth_token_ttl_seconds,
        })
    }
}
