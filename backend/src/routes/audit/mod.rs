use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;
use uuid::Uuid;

use crate::routes::edges::helpers::internal_error;
use crate::routes::AppState;

#[derive(Deserialize)]
pub struct AuditQuery {
    pub limit: Option<u32>,
    pub before: Option<String>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct AuditLogEntry {
    pub id: Uuid,
    pub at: OffsetDateTime,
    pub actor_type: String,
    pub actor_id: Option<Uuid>,
    pub actor_username: Option<String>,
    pub actor_role: Option<String>,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub action: String,
    pub before: Option<serde_json::Value>,
    pub patch: Option<serde_json::Value>,
    pub after: Option<serde_json::Value>,
    pub correlation_id: Option<Uuid>,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/node/:id", get(get_node_audit))
        .route("/edge/:id", get(get_edge_audit))
}

async fn get_node_audit(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(q): Query<AuditQuery>,
) -> Result<Json<Vec<AuditLogEntry>>, (StatusCode, String)> {
    get_audit_for(&state, "node", id, q).await
}

async fn get_edge_audit(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(q): Query<AuditQuery>,
) -> Result<Json<Vec<AuditLogEntry>>, (StatusCode, String)> {
    get_audit_for(&state, "edge", id, q).await
}

async fn get_audit_for(
    state: &AppState,
    entity_type: &str,
    entity_id: Uuid,
    q: AuditQuery,
) -> Result<Json<Vec<AuditLogEntry>>, (StatusCode, String)> {
    let mut limit = q.limit.unwrap_or(200) as i64;
    if limit < 1 {
        limit = 1;
    }
    if limit > 500 {
        limit = 500;
    }

    let before_ts: Option<OffsetDateTime> =
        match q.before {
            None => None,
            Some(raw) => {
                let s = raw.trim();
                if s.is_empty() {
                    None
                } else {
                    Some(OffsetDateTime::parse(s, &Rfc3339).map_err(|_| {
                        (StatusCode::BAD_REQUEST, "Ogiltig 'before' (RFC3339)".into())
                    })?)
                }
            }
        };

    let rows: Vec<AuditLogEntry> = if let Some(before) = before_ts {
        sqlx::query_as(
            r#"
            SELECT
                id,
                at,
                actor_type,
                actor_id,
                actor_username,
                actor_role,
                entity_type,
                entity_id,
                action,
                before,
                patch,
                after,
                correlation_id
            FROM audit_log
            WHERE entity_type = $1
              AND entity_id = $2
              AND at < $3
            ORDER BY at DESC, id DESC
            LIMIT $4
            "#,
        )
        .bind(entity_type)
        .bind(entity_id)
        .bind(before)
        .bind(limit)
        .fetch_all(&state.pool)
        .await
        .map_err(internal_error)?
    } else {
        sqlx::query_as(
            r#"
            SELECT
                id,
                at,
                actor_type,
                actor_id,
                actor_username,
                actor_role,
                entity_type,
                entity_id,
                action,
                before,
                patch,
                after,
                correlation_id
            FROM audit_log
            WHERE entity_type = $1
              AND entity_id = $2
            ORDER BY at DESC, id DESC
            LIMIT $3
            "#,
        )
        .bind(entity_type)
        .bind(entity_id)
        .bind(limit)
        .fetch_all(&state.pool)
        .await
        .map_err(internal_error)?
    };

    Ok(Json(rows))
}
