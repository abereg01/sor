use axum::{extract::State, http::StatusCode, Json};

use crate::{models::Edge, routes::AppState};

use super::helpers::internal_error;

pub async fn list_edges(
    State(state): State<AppState>,
) -> Result<Json<Vec<Edge>>, (StatusCode, String)> {
    let rows = sqlx::query_as::<_, Edge>(
        r#"
        SELECT
            id,
            from_id,
            to_id,
            kind,
            metadata,
            created_at,
            updated_at
        FROM edges
        ORDER BY updated_at DESC
        "#,
    )
    .fetch_all(&state.pool)
    .await
    .map_err(internal_error)?;

    Ok(Json(rows))
}
