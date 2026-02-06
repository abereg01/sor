use axum::{extract::Query, routing::get, Json, Router};
use serde::Deserialize;
use uuid::Uuid;

use crate::routes::AppState;

#[derive(Deserialize)]
pub struct NodeSearchQuery {
    pub q: String,
    pub kind: Option<String>,
    pub limit: Option<i64>,
}

#[derive(serde::Serialize)]
pub struct NodeSearchResult {
    pub id: Uuid,
    pub name: String,
    pub kind: String,
}

pub fn router() -> Router<AppState> {
    Router::new().route("/nodes", get(search_nodes))
}

async fn search_nodes(
    axum::extract::State(state): axum::extract::State<AppState>,
    Query(q): Query<NodeSearchQuery>,
) -> Result<Json<Vec<NodeSearchResult>>, (axum::http::StatusCode, String)> {
    let limit = q.limit.unwrap_or(20).min(50);

    let rows = sqlx::query_as!(
        NodeSearchResult,
        r#"
        SELECT id, name, kind
        FROM nodes
        WHERE deleted_at IS NULL
          AND name ILIKE '%' || $1 || '%'
          AND ($2::text IS NULL OR kind = $2)
        ORDER BY name
        LIMIT $3
        "#,
        q.q,
        q.kind,
        limit
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(rows))
}
