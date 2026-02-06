use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
};
use uuid::Uuid;

use crate::{
    audit::{self, AuditAction, EntityType, RequestContext},
    auth::AuthActor,
    models::node_claims::{NewNodeClaim, NodeClaim},
    routes::AppState,
};

use crate::routes::edges::helpers::{internal_error, map_sqlx_error};

pub async fn list_node_claims(
    State(state): State<AppState>,
    Path(node_id): Path<Uuid>,
) -> Result<Json<Vec<NodeClaim>>, (StatusCode, String)> {
    let rows: Vec<NodeClaim> = sqlx::query_as(
        r#"
        SELECT
            id,
            node_id,
            source,
            confidence,
            status,
            created_by,
            created_at,
            updated_at,
            last_verified_at
        FROM node_claims
        WHERE node_id = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(node_id)
    .fetch_all(&state.pool)
    .await
    .map_err(internal_error)?;

    Ok(Json(rows))
}

pub async fn create_node_claim(
    State(state): State<AppState>,
    Extension(ctx): Extension<RequestContext>,
    Extension(actor): Extension<AuthActor>,
    Path(node_id): Path<Uuid>,
    Json(body): Json<NewNodeClaim>,
) -> Result<Json<NodeClaim>, (StatusCode, String)> {
    let mut tx = state.pool.begin().await.map_err(internal_error)?;

    let claim: NodeClaim = sqlx::query_as(
        r#"
        INSERT INTO node_claims (
            node_id,
            source,
            confidence,
            status,
            created_by
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING
            id,
            node_id,
            source,
            confidence,
            status,
            created_by,
            created_at,
            updated_at,
            last_verified_at
        "#,
    )
    .bind(node_id)
    .bind(body.source.clone())
    .bind(body.confidence)
    .bind(body.status.clone())
    .bind(actor.username.clone())
    .fetch_one(&mut *tx)
    .await
    .map_err(map_sqlx_error)?;

    audit::write_audit(
        &mut *tx,
        ctx.clone(),
        Some(&actor),
        EntityType::Node,
        node_id,
        AuditAction::Patch,
        None,
        Some(serde_json::json!({
            "action": "node_claim_created",
            "claim_id": claim.id,
            "status": claim.status,
        })),
        None,
    )
    .await
    .map_err(internal_error)?;

    tx.commit().await.map_err(internal_error)?;

    Ok(Json(claim))
}
