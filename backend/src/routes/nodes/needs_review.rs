#![allow(dead_code)]

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
};
use serde::Deserialize;
use serde::Serialize;
use uuid::Uuid;

use crate::{
    audit::{self, AuditAction, EntityType, RequestContext},
    auth::AuthActor,
    models::node_claims::NodeClaim,
    routes::AppState,
};

use crate::routes::edges::helpers::{internal_error, map_sqlx_error};

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct NeedsReviewNodeRow {
    pub node_id: Uuid,
    pub kind: String,
    pub name: String,
    pub proposals: i64,
    pub status: String,

    pub created_by: String,
    pub created_at: time::OffsetDateTime,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MarkNeedsReviewBody {
    pub description: String,
}

pub async fn list_nodes_needing_review(
    State(state): State<AppState>,
) -> Result<Json<Vec<NeedsReviewNodeRow>>, (StatusCode, String)> {
    let rows: Vec<NeedsReviewNodeRow> = sqlx::query_as(
        r#"
        SELECT
          n.id    AS node_id,
          n.kind  AS kind,
          n.name  AS name,
          COUNT(c.id) FILTER (WHERE c.status = 'needs_review') AS proposals,
          latest.status AS status,
          latest.created_by AS created_by,
          latest.created_at AS created_at
        FROM nodes n
        JOIN node_claims c ON c.node_id = n.id
        JOIN LATERAL (
          SELECT status, created_by, created_at
          FROM node_claims
          WHERE node_id = n.id
            AND status IN ('needs_review', 'rejected')
          ORDER BY created_at DESC
          LIMIT 1
        ) latest ON true
        WHERE c.status IN ('needs_review', 'rejected')
        GROUP BY n.id, n.kind, n.name, latest.status, latest.created_by, latest.created_at
        ORDER BY latest.created_at DESC, proposals DESC, n.name ASC
        "#,
    )
    .fetch_all(&state.pool)
    .await
    .map_err(internal_error)?;

    Ok(Json(rows))
}

pub async fn mark_node_needs_review(
    State(state): State<AppState>,
    Extension(ctx): Extension<RequestContext>,
    Extension(actor): Extension<AuthActor>,
    Path(node_id): Path<Uuid>,
    Json(body): Json<MarkNeedsReviewBody>,
) -> Result<Json<NodeClaim>, (StatusCode, String)> {
    let description = body.description.trim();
    if description.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Beskrivning krävs".into()));
    }
    let mut tx = state.pool.begin().await.map_err(internal_error)?;

    sqlx::query(
        r#"
        UPDATE node_claims
        SET status = 'deprecated', updated_at = now()
        WHERE node_id = $1
          AND status IN ('active', 'needs_review', 'rejected')
        "#,
    )
    .bind(node_id)
    .execute(&mut *tx)
    .await
    .map_err(map_sqlx_error)?;

    let claim = sqlx::query_as::<_, NodeClaim>(
        r#"
        INSERT INTO node_claims (
            node_id,
            source,
            confidence,
            status,
            created_by
        )
        VALUES ($1, $2, $3, 'needs_review', $4)
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
    .bind(description.to_string())
    .bind(100i16)
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
            "action": "node_marked_needs_review",
            "claim_id": claim.id
        })),
        None,
    )
    .await
    .map_err(internal_error)?;

    tx.commit().await.map_err(internal_error)?;

    Ok(Json(claim))
}
