use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};

use crate::routes::AppState;

use super::types::{LookupItem, LookupQuery};
use super::util::internal_error;

pub async fn lookup_suppliers(
    State(state): State<AppState>,
    Query(q): Query<LookupQuery>,
) -> Result<Json<Vec<LookupItem>>, (StatusCode, String)> {
    let q_str = q.q.unwrap_or_default().trim().to_string();
    let limit = q.limit.unwrap_or(20).clamp(1, 50);

    let rows = if q_str.is_empty() {
        sqlx::query_as::<_, LookupItem>(
            r#"
            SELECT id, name
            FROM suppliers
            ORDER BY name
            LIMIT $1
            "#,
        )
        .bind(limit)
        .fetch_all(&state.pool)
        .await
        .map_err(internal_error)?
    } else {
        let pattern = format!("%{}%", q_str);
        sqlx::query_as::<_, LookupItem>(
            r#"
            SELECT id, name
            FROM suppliers
            WHERE name ILIKE $1
            ORDER BY name
            LIMIT $2
            "#,
        )
        .bind(pattern)
        .bind(limit)
        .fetch_all(&state.pool)
        .await
        .map_err(internal_error)?
    };

    Ok(Json(rows))
}

pub async fn lookup_owners(
    State(state): State<AppState>,
    Query(q): Query<LookupQuery>,
) -> Result<Json<Vec<LookupItem>>, (StatusCode, String)> {
    let q_str = q.q.unwrap_or_default().trim().to_string();
    let limit = q.limit.unwrap_or(20).clamp(1, 50);

    let rows = if q_str.is_empty() {
        sqlx::query_as::<_, LookupItem>(
            r#"
            SELECT id, name
            FROM owners
            ORDER BY name
            LIMIT $1
            "#,
        )
        .bind(limit)
        .fetch_all(&state.pool)
        .await
        .map_err(internal_error)?
    } else {
        let pattern = format!("%{}%", q_str);
        sqlx::query_as::<_, LookupItem>(
            r#"
            SELECT id, name
            FROM owners
            WHERE name ILIKE $1
            ORDER BY name
            LIMIT $2
            "#,
        )
        .bind(pattern)
        .bind(limit)
        .fetch_all(&state.pool)
        .await
        .map_err(internal_error)?
    };

    Ok(Json(rows))
}
