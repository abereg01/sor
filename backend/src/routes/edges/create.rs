use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    Extension, Json,
};
use uuid::Uuid;

use crate::{
    audit::{self, AuditAction, EntityType, RequestContext},
    auth::AuthActor,
    models::{Edge, NewEdge},
    routes::{etag_from_updated_at, AppState},
};

use super::helpers::{internal_error, map_sqlx_error};

pub async fn create_edge(
    State(state): State<AppState>,
    Extension(ctx): Extension<RequestContext>,
    Extension(actor): Extension<AuthActor>,
    Json(payload): Json<NewEdge>,
) -> Result<(StatusCode, HeaderMap, Json<Edge>), (StatusCode, String)> {
    if payload.from_id == payload.to_id {
        return Err((
            StatusCode::BAD_REQUEST,
            "Källa och mål måste vara olika".into(),
        ));
    }

    let mut tx = state.pool.begin().await.map_err(internal_error)?;

    let (from_exists,): (bool,) =
        sqlx::query_as("SELECT EXISTS(SELECT 1 FROM nodes WHERE id = $1 AND deleted_at IS NULL)")
            .bind(payload.from_id)
            .fetch_one(&mut *tx)
            .await
            .map_err(internal_error)?;

    let (to_exists,): (bool,) =
        sqlx::query_as("SELECT EXISTS(SELECT 1 FROM nodes WHERE id = $1 AND deleted_at IS NULL)")
            .bind(payload.to_id)
            .fetch_one(&mut *tx)
            .await
            .map_err(internal_error)?;

    if !from_exists || !to_exists {
        return Err((StatusCode::BAD_REQUEST, "Källa eller mål finns inte".into()));
    }

    let edge = sqlx::query_as::<_, Edge>(
        r#"
        INSERT INTO edges (id, from_id, to_id, kind, metadata)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, from_id, to_id, kind, metadata, created_at, updated_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(payload.from_id)
    .bind(payload.to_id)
    .bind(payload.kind.as_str())
    .bind(payload.metadata)
    .fetch_one(&mut *tx)
    .await
    .map_err(map_sqlx_error)?;

    audit::write_audit(
        &mut *tx,
        ctx,
        Some(&actor),
        EntityType::Edge,
        edge.id,
        AuditAction::Create,
        None,
        None,
        serde_json::to_value(&edge).ok(),
    )
    .await
    .map_err(internal_error)?;

    tx.commit().await.map_err(internal_error)?;

    let mut headers = HeaderMap::new();
    headers.insert(
        axum::http::header::ETAG,
        etag_from_updated_at(edge.updated_at),
    );

    Ok((StatusCode::CREATED, headers, Json(edge)))
}
