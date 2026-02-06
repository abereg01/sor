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
    models::edge_claim::EdgeClaim,
    routes::AppState,
};

use crate::routes::edges::helpers::{internal_error, map_sqlx_error};

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct NeedsReviewEdgeRow {
    pub edge_id: Uuid,
    pub kind: String,
    pub from_id: Uuid,
    pub to_id: Uuid,
    pub proposals: i64,
    pub status: String,
    pub created_by: String,
    pub created_at: time::OffsetDateTime,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MarkNeedsReviewBody {
    pub description: String,
}

pub async fn list_edges_needing_review(
    State(state): State<AppState>,
) -> Result<Json<Vec<NeedsReviewEdgeRow>>, (StatusCode, String)> {
    let rows: Vec<NeedsReviewEdgeRow> = sqlx::query_as(
        r#"
        SELECT
          e.id    AS edge_id,
          e.kind  AS kind,
          e.from_id AS from_id,
          e.to_id   AS to_id,
          COUNT(c.id) FILTER (WHERE c.status = 'needs_review') AS proposals,
          latest.status AS status,
          latest.created_by AS created_by,
          latest.created_at AS created_at
        FROM edges e
        JOIN edge_claims c ON c.edge_id = e.id
        JOIN LATERAL (
          SELECT status, created_by, created_at
          FROM edge_claims
          WHERE edge_id = e.id
            AND status IN ('needs_review', 'rejected')
          ORDER BY created_at DESC
          LIMIT 1
        ) latest ON true
        WHERE c.status IN ('needs_review', 'rejected')
        GROUP BY e.id, e.kind, e.from_id, e.to_id, latest.status, latest.created_by, latest.created_at
        ORDER BY latest.created_at DESC, proposals DESC, e.kind ASC
        "#,
    )
    .fetch_all(&state.pool)
    .await
    .map_err(internal_error)?;

    Ok(Json(rows))
}

pub async fn mark_edge_needs_review(
    State(state): State<AppState>,
    Extension(ctx): Extension<RequestContext>,
    Extension(actor): Extension<AuthActor>,
    Path(edge_id): Path<Uuid>,
    Json(body): Json<MarkNeedsReviewBody>,
) -> Result<Json<EdgeClaim>, (StatusCode, String)> {
    let description = body.description.trim();
    if description.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Beskrivning krävs".into()));
    }

    let mut tx = state.pool.begin().await.map_err(internal_error)?;

    sqlx::query(
        r#"
        UPDATE edge_claims
        SET status = 'deprecated', updated_at = now()
        WHERE edge_id = $1
          AND status IN ('active', 'needs_review', 'rejected')
        "#,
    )
    .bind(edge_id)
    .execute(&mut *tx)
    .await
    .map_err(map_sqlx_error)?;

    let claim = sqlx::query_as::<_, EdgeClaim>(
        r#"
        INSERT INTO edge_claims (
            edge_id,
            import_batch_id,
            source,
            confidence,
            status,
            created_by
        )
        VALUES ($1, NULL, $2, $3, 'needs_review', $4)
        RETURNING
            id,
            edge_id,
            import_batch_id,
            source,
            confidence,
            status,
            created_by,
            created_at,
            updated_at,
            last_verified_at
        "#,
    )
    .bind(edge_id)
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
        EntityType::Edge,
        edge_id,
        AuditAction::Patch,
        None,
        Some(serde_json::json!({
            "action": "edge_marked_needs_review",
            "claim_id": claim.id
        })),
        None,
    )
    .await
    .map_err(internal_error)?;

    tx.commit().await.map_err(internal_error)?;

    Ok(Json(claim))
}
