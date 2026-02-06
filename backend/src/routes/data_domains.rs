use axum::{routing::get, Json, Router};
use serde::Serialize;
use uuid::Uuid;

use crate::routes::AppState;

#[derive(Serialize)]
pub struct DataDomainRow {
    pub id: Uuid,
    pub name: String,
    pub parent_id: Option<Uuid>,
    pub sort_order: i32,
}

pub fn router() -> Router<AppState> {
    Router::new().route("/", get(list_data_domains))
}

async fn list_data_domains(
    axum::extract::State(state): axum::extract::State<AppState>,
) -> Result<Json<Vec<DataDomainRow>>, (axum::http::StatusCode, String)> {
    let rows = sqlx::query_as!(
        DataDomainRow,
        r#"
        SELECT id, name, parent_id, sort_order
        FROM data_domains
        ORDER BY parent_id NULLS FIRST, sort_order ASC, name ASC
        "#
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(rows))
}
