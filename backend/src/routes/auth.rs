use axum::{
    extract::State,
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use subtle::ConstantTimeEq;

use crate::auth::{issue_token, verify_token, AuthActor, Role};
use crate::routes::AppState;

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub user: UserInfo,
}

#[derive(Debug, Serialize)]
pub struct UserInfo {
    pub username: String,
    pub role: String,
}

fn ct_eq(a: &str, b: &str) -> bool {
    a.as_bytes().ct_eq(b.as_bytes()).into()
}

async fn login(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, (StatusCode, String)> {
    let ok_user = ct_eq(req.username.trim(), &state.auth.local_admin_username);
    let ok_pass = ct_eq(&req.password, &state.auth.local_admin_password);

    if !(ok_user && ok_pass) {
        return Err((
            StatusCode::UNAUTHORIZED,
            "Fel användarnamn eller lösenord".into(),
        ));
    }

    let actor = AuthActor {
        username: state.auth.local_admin_username.clone(),
        role: Role::Admin,
    };

    let token = issue_token(&state, &actor).map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Kunde inte skapa token".into(),
        )
    })?;

    Ok(Json(LoginResponse {
        token,
        user: UserInfo {
            username: actor.username,
            role: actor.role.as_str().to_string(),
        },
    }))
}

async fn me(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
) -> Result<Json<UserInfo>, (StatusCode, String)> {
    let auth = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .trim();

    let token = auth
        .strip_prefix("Bearer ")
        .or_else(|| auth.strip_prefix("bearer "))
        .ok_or((StatusCode::UNAUTHORIZED, "Missing Authorization".into()))?;

    let actor = verify_token(&state, token)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid token".into()))?;

    Ok(Json(UserInfo {
        username: actor.username,
        role: actor.role.as_str().to_string(),
    }))
}

async fn logout() -> StatusCode {
    StatusCode::NO_CONTENT
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/login", post(login))
        .route("/me", get(me))
        .route("/logout", post(logout))
}
