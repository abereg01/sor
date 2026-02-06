use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    routing::post,
    Extension, Json, Router,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    audit::{self, AuditAction, EntityType, RequestContext},
    auth::AuthActor,
    models::node_claims::NodeClaim,
    routes::{etag_from_updated_at, is_match, require_if_match, AppState},
};

use crate::routes::edges::helpers::{internal_error, map_sqlx_error};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/:id/approve", post(approve_claim))
        .route("/:id/reject", post(reject_claim))
}

#[derive(Deserialize)]
pub struct RejectBody {
    #[serde(default)]
    pub reason: Option<String>,
}

#[derive(Serialize)]
pub struct ApproveResponse {
    pub active_claim: NodeClaim,
    pub retired_proposal_id: Uuid,
}

#[derive(Serialize)]
pub struct RejectResponse {
    pub retired_claim: NodeClaim,
}

async fn approve_claim(
    State(state): State<AppState>,
    Extension(ctx): Extension<RequestContext>,
    Extension(actor): Extension<AuthActor>,
    headers: HeaderMap,
    Path(claim_id): Path<Uuid>,
) -> Result<Json<ApproveResponse>, (StatusCode, String)> {
    let mut tx = state.pool.begin().await.map_err(internal_error)?;

    let proposal: NodeClaim = sqlx::query_as(
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
        WHERE id = $1
        "#,
    )
    .bind(claim_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(map_sqlx_error)?;

    if proposal.status != "needs_review" && proposal.status != "rejected" {
        return Err((
            StatusCode::CONFLICT,
            "Endast claims med status needs_review kan godkännas".into(),
        ));
    }
    let if_match = require_if_match(&headers)?;
    let expected = etag_from_updated_at(proposal.updated_at);
    if !is_match(&expected, &if_match) {
        return Err((StatusCode::BAD_REQUEST, "Ogiltig If-Match".into()));
    }

    let retired: NodeClaim = sqlx::query_as(
        r#"
        UPDATE node_claims
        SET status = 'deprecated',
            updated_at = now()
        WHERE id = $1
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
    .bind(proposal.id)
    .fetch_one(&mut *tx)
    .await
    .map_err(map_sqlx_error)?;

    let active: NodeClaim = sqlx::query_as(
        r#"
        INSERT INTO node_claims (
            node_id,
            source,
            confidence,
            status,
            created_by,
            last_verified_at
        )
        VALUES ($1, $2, $3, 'active', $4, now())
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
    .bind(proposal.node_id)
    .bind(proposal.source.clone())
    .bind(proposal.confidence)
    .bind(actor.username.clone())
    .fetch_one(&mut *tx)
    .await
    .map_err(map_sqlx_error)?;

    audit::write_audit(
        &mut *tx,
        ctx.clone(),
        Some(&actor),
        EntityType::Node,
        proposal.node_id,
        AuditAction::Patch,
        None,
        Some(serde_json::json!({
            "action": "node_claim_approved",
            "proposal_id": proposal.id,
            "active_id": active.id,
        })),
        None,
    )
    .await
    .map_err(internal_error)?;

    tx.commit().await.map_err(internal_error)?;

    Ok(Json(ApproveResponse {
        active_claim: active,
        retired_proposal_id: retired.id,
    }))
}

async fn reject_claim(
    State(state): State<AppState>,
    Extension(ctx): Extension<RequestContext>,
    Extension(actor): Extension<AuthActor>,
    headers: HeaderMap,
    Path(claim_id): Path<Uuid>,
    Json(body): Json<RejectBody>,
) -> Result<Json<RejectResponse>, (StatusCode, String)> {
    let mut tx = state.pool.begin().await.map_err(internal_error)?;

    let proposal: NodeClaim = sqlx::query_as(
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
        WHERE id = $1
        "#,
    )
    .bind(claim_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(map_sqlx_error)?;

    if proposal.status != "needs_review" && proposal.status != "rejected" {
        return Err((
            StatusCode::CONFLICT,
            "Endast claims med status needs_review eller rejected kan avslås".into(),
        ));
    }
    let if_match = require_if_match(&headers)?;
    let expected = etag_from_updated_at(proposal.updated_at);
    if !is_match(&expected, &if_match) {
        return Err((StatusCode::BAD_REQUEST, "Ogiltig If-Match".into()));
    }

    let retired: NodeClaim = sqlx::query_as(
        r#"
        UPDATE node_claims
        SET status = 'rejected',
            source = CASE
              WHEN $2::text IS NULL OR btrim($2::text) = '' THEN source
              ELSE $2::text
            END,
            updated_at = now()
        WHERE id = $1
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
    .bind(proposal.id)
    .bind(body.reason.clone())
    .fetch_one(&mut *tx)
    .await
    .map_err(map_sqlx_error)?;

    audit::write_audit(
        &mut *tx,
        ctx.clone(),
        Some(&actor),
        EntityType::Node,
        proposal.node_id,
        AuditAction::Patch,
        None,
        Some(serde_json::json!({
            "action": "node_claim_rejected",
            "proposal_id": proposal.id,
            "reason": body.reason,
        })),
        None,
    )
    .await
    .map_err(internal_error)?;

    tx.commit().await.map_err(internal_error)?;

    Ok(Json(RejectResponse {
        retired_claim: retired,
    }))
}
