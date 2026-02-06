use axum::extract::State;
use axum::http::{header, HeaderMap, Method, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use serde::{Deserialize, Serialize};
use time::OffsetDateTime;

use jsonwebtoken::{DecodingKey, EncodingKey, Header, Validation};

use crate::routes::AppState;

#[derive(Debug, Clone)]
pub struct AuthActor {
    pub username: String,
    pub role: Role,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    Viewer,
    Admin,
}

impl Role {
    pub fn as_str(self) -> &'static str {
        match self {
            Role::Viewer => "viewer",
            Role::Admin => "admin",
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: String,
    role: Role,
    iat: i64,
    exp: i64,
    iss: String,
}

pub fn issue_token(state: &AppState, actor: &AuthActor) -> anyhow::Result<String> {
    let now = OffsetDateTime::now_utc().unix_timestamp();
    let exp = now + state.auth.token_ttl_seconds as i64;

    let claims = Claims {
        sub: actor.username.clone(),
        role: actor.role,
        iat: now,
        exp,
        iss: "infra-graph".to_string(),
    };

    let token = jsonwebtoken::encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(state.auth.jwt_secret.as_bytes()),
    )?;

    Ok(token)
}

pub fn verify_token(state: &AppState, token: &str) -> anyhow::Result<AuthActor> {
    let mut validation = Validation::default();
    validation.set_issuer(&["infra-graph"]);
    validation.validate_exp = true;

    let data = jsonwebtoken::decode::<Claims>(
        token,
        &DecodingKey::from_secret(state.auth.jwt_secret.as_bytes()),
        &validation,
    )?;

    Ok(AuthActor {
        username: data.claims.sub,
        role: data.claims.role,
    })
}

fn extract_bearer(headers: &HeaderMap) -> Option<String> {
    let v = headers
        .get(header::AUTHORIZATION)?
        .to_str()
        .ok()?
        .trim()
        .to_string();
    let parts: Vec<&str> = v.split_whitespace().collect();
    if parts.len() != 2 {
        return None;
    }
    if !parts[0].eq_ignore_ascii_case("bearer") {
        return None;
    }
    Some(parts[1].to_string())
}

fn is_public_path(path: &str) -> bool {
    path == "/" || path == "/health" || path == "/metrics" || path.starts_with("/auth")
}

fn is_safe_method(m: &Method) -> bool {
    matches!(*m, Method::GET | Method::HEAD | Method::OPTIONS)
}

pub async fn require_auth_for_writes(
    State(state): State<AppState>,
    req: axum::http::Request<axum::body::Body>,
    next: Next,
) -> Response {
    let method = req.method().clone();
    let path = req.uri().path().to_string();

    if is_public_path(&path) || is_safe_method(&method) {
        return next.run(req).await;
    }

    let token = match extract_bearer(req.headers()) {
        Some(t) => t,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                "Missing Authorization: Bearer <token>",
            )
                .into_response()
        }
    };

    match verify_token(&state, &token) {
        Ok(actor) => {
            let mut req = req;
            req.extensions_mut().insert(actor);
            next.run(req).await
        }
        Err(_) => (StatusCode::UNAUTHORIZED, "Invalid or expired token").into_response(),
    }
}
