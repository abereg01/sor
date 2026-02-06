use axum::http::{HeaderMap, HeaderValue, StatusCode};
use sqlx::PgPool;
use time::format_description::well_known::Rfc3339;
use time::{OffsetDateTime, UtcOffset};

pub mod audit;
pub mod auth;
pub mod claims;
pub mod data_domains;
pub mod edges;
pub mod export;
pub mod graph;
pub mod health;
pub mod imports;
pub mod node_claims;
pub mod nodes;
pub mod patch;
pub mod query;
pub mod schema;
pub mod search;

#[derive(Clone)]
pub struct AuthState {
    pub local_admin_username: String,
    pub local_admin_password: String,
    pub jwt_secret: String,
    pub token_ttl_seconds: u64,
}

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub auth: AuthState,
}

pub fn etag_from_updated_at(updated_at: OffsetDateTime) -> HeaderValue {
    let s = updated_at
        .to_offset(UtcOffset::UTC)
        .format(&Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string());
    HeaderValue::from_str(&format!("\"{}\"", s))
        .unwrap_or_else(|_| HeaderValue::from_static("\"invalid\""))
}

pub fn require_if_match(headers: &HeaderMap) -> Result<String, (StatusCode, String)> {
    let raw = headers
        .get(axum::http::header::IF_MATCH)
        .ok_or((
            StatusCode::PRECONDITION_REQUIRED,
            "If-Match saknas (optimistisk låsning)".into(),
        ))?
        .to_str()
        .map_err(|_| (StatusCode::BAD_REQUEST, "Ogiltig If-Match".into()))?
        .trim();

    if raw.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Ogiltig If-Match".into()));
    }

    Ok(raw.to_string())
}

fn normalize_etag_token(token: &str) -> Option<String> {
    let mut s = token.trim();
    if s.is_empty() {
        return None;
    }
    if s == "*" {
        return Some("*".to_string());
    }

    if let Some(rest) = s.strip_prefix("W/") {
        s = rest.trim();
    }

    if let Some(rest) = s.strip_prefix('"') {
        s = rest;
    }
    if let Some(rest) = s.strip_suffix('"') {
        s = rest;
    }

    let out = s.trim();
    if out.is_empty() {
        None
    } else {
        Some(out.to_string())
    }
}

fn parse_rfc3339_millis(s: &str) -> Option<i128> {
    let dt = OffsetDateTime::parse(s, &Rfc3339).ok()?;
    Some(dt.unix_timestamp_nanos() / 1_000_000)
}

pub fn is_match(current_etag: &HeaderValue, if_match: &str) -> bool {
    let current_raw = match current_etag.to_str() {
        Ok(v) => v,
        Err(_) => return false,
    };

    let current = match normalize_etag_token(current_raw) {
        Some(v) => v,
        None => return false,
    };

    for part in if_match.split(',') {
        let token = match normalize_etag_token(part) {
            Some(v) => v,
            None => continue,
        };

        if token == "*" {
            return true;
        }

        if token == current {
            return true;
        }

        if let (Some(a), Some(b)) = (parse_rfc3339_millis(&token), parse_rfc3339_millis(&current)) {
            if a == b {
                return true;
            }
        }
    }

    false
}
