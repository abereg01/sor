use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    Extension, Json,
};

use serde::Serialize;
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;
use uuid::Uuid;

use crate::{
    audit::{self, AuditAction, EntityType, RequestContext},
    auth::AuthActor,
    models::{Edge, EdgeKind, MergePatch, UpdateEdge},
    routes::{etag_from_updated_at, is_match, patch::merge_patch, require_if_match, AppState},
    validation::{validate_edge_metadata, ValidationResult},
};

use super::helpers::{internal_error, map_sqlx_error};

#[derive(Serialize)]
pub struct EdgeWriteResponse {
    pub edge: Edge,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub validation: Option<ValidationResult>,
    pub created_needs_review_claim: bool,
}

async fn ensure_needs_review_claim(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ctx: &RequestContext,
    actor: Option<&AuthActor>,
    edge_id: Uuid,
    reason: &str,
) -> Result<bool, (StatusCode, String)> {
    let exists: Option<(i64,)> = sqlx::query_as(
        r#"
        SELECT 1
        FROM edge_claims
        WHERE edge_id = $1 AND status = 'needs_review'
        LIMIT 1
        "#,
    )
    .bind(edge_id)
    .fetch_optional(&mut **tx)
    .await
    .map_err(internal_error)?;

    if exists.is_some() {
        return Ok(false);
    }

    sqlx::query(
        r#"
        UPDATE edge_claims
        SET status = 'deprecated'
        WHERE edge_id = $1
          AND status IN ('active', 'needs_review')
        "#,
    )
    .bind(edge_id)
    .execute(&mut **tx)
    .await
    .map_err(map_sqlx_error)?;

    sqlx::query(
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
        "#,
    )
    .bind(edge_id)
    .bind(format!("Metadata guidance: {}", reason))
    .bind(100i16)
    .bind(ctx.request_id.to_string())
    .execute(&mut **tx)
    .await
    .map_err(map_sqlx_error)?;

    audit::write_audit(
        &mut **tx,
        ctx.clone(),
        actor,
        EntityType::Edge,
        edge_id,
        AuditAction::Patch,
        None,
        Some(serde_json::json!({
            "action": "edge_marked_needs_review",
            "reason": reason
        })),
        None,
    )
    .await
    .map_err(internal_error)?;

    Ok(true)
}

pub async fn update_edge(
    State(state): State<AppState>,
    Extension(ctx): Extension<RequestContext>,
    Extension(actor): Extension<AuthActor>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateEdge>,
) -> Result<(HeaderMap, Json<EdgeWriteResponse>), (StatusCode, String)> {
    let if_match = require_if_match(&headers)?;
    let expected_updated_at = OffsetDateTime::parse(&if_match, &Rfc3339)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Ogiltig If-Match".into()))?;

    let kind_str = payload.kind.map(EdgeKind::as_str);

    let mut tx = state.pool.begin().await.map_err(internal_error)?;

    let before = sqlx::query_as::<_, Edge>(
        r#"
        SELECT id, from_id, to_id, kind, metadata, created_at, updated_at
        FROM edges
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(internal_error)?
    .ok_or((StatusCode::NOT_FOUND, "Objektet finns inte längre".into()))?;

    let current_etag = etag_from_updated_at(before.updated_at);
    if !is_match(&current_etag, &if_match) {
        return Err((
            StatusCode::CONFLICT,
            "Objektet har uppdaterats av någon annan".into(),
        ));
    }

    let updated = sqlx::query_as::<_, Edge>(
        r#"
        UPDATE edges
        SET
          kind = COALESCE($2, kind),
          metadata = COALESCE($3, metadata),
          updated_at = now()
        WHERE id = $1 AND updated_at = $4
        RETURNING id, from_id, to_id, kind, metadata, created_at, updated_at
        "#,
    )
    .bind(id)
    .bind(kind_str)
    .bind(payload.metadata.clone())
    .bind(expected_updated_at)
    .fetch_optional(&mut *tx)
    .await
    .map_err(map_sqlx_error)?
    .ok_or((
        StatusCode::CONFLICT,
        "Objektet har uppdaterats av någon annan".into(),
    ))?;

    audit::write_audit(
        &mut *tx,
        ctx.clone(),
        Some(&actor),
        EntityType::Edge,
        id,
        AuditAction::Patch,
        serde_json::to_value(&before).ok(),
        serde_json::to_value(&payload).ok(),
        serde_json::to_value(&updated).ok(),
    )
    .await
    .map_err(internal_error)?;

    let validation = validate_edge_metadata(&updated.kind, &updated.metadata);

    let mut created_needs_review_claim = false;
    if let Some(v) = &validation {
        if v.needs_review {
            let reason = v
                .issues
                .iter()
                .find(|i| {
                    matches!(
                        i.severity,
                        crate::validation::ValidationSeverity::NeedsReview
                    )
                })
                .map(|i| i.message_sv.as_str())
                .unwrap_or("metadata guidance");

            created_needs_review_claim =
                ensure_needs_review_claim(&mut tx, &ctx, Some(&actor), id, reason).await?;
        }
    }

    tx.commit().await.map_err(internal_error)?;

    let mut headers = HeaderMap::new();
    headers.insert(
        axum::http::header::ETAG,
        etag_from_updated_at(updated.updated_at),
    );

    Ok((
        headers,
        Json(EdgeWriteResponse {
            edge: updated,
            validation,
            created_needs_review_claim,
        }),
    ))
}

pub async fn patch_edge_metadata(
    State(state): State<AppState>,
    Extension(ctx): Extension<RequestContext>,
    Extension(actor): Extension<AuthActor>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(MergePatch(patch)): Json<MergePatch>,
) -> Result<(HeaderMap, Json<EdgeWriteResponse>), (StatusCode, String)> {
    let if_match = require_if_match(&headers)?;
    let expected_updated_at = OffsetDateTime::parse(&if_match, &Rfc3339)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Ogiltig If-Match".into()))?;

    let mut tx = state.pool.begin().await.map_err(internal_error)?;

    let mut before = sqlx::query_as::<_, Edge>(
        r#"
        SELECT id, from_id, to_id, kind, metadata, created_at, updated_at
        FROM edges
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(internal_error)?
    .ok_or((StatusCode::NOT_FOUND, "Objektet finns inte längre".into()))?;

    let current_etag = etag_from_updated_at(before.updated_at);
    if !is_match(&current_etag, &if_match) {
        return Err((
            StatusCode::CONFLICT,
            "Objektet har uppdaterats av någon annan".into(),
        ));
    }

    let before_metadata = before.metadata.clone();
    merge_patch(&mut before.metadata, &patch);

    let updated = sqlx::query_as::<_, Edge>(
        r#"
        UPDATE edges
        SET metadata = $2, updated_at = now()
        WHERE id = $1 AND updated_at = $3
        RETURNING id, from_id, to_id, kind, metadata, created_at, updated_at
        "#,
    )
    .bind(id)
    .bind(before.metadata.clone())
    .bind(expected_updated_at)
    .fetch_optional(&mut *tx)
    .await
    .map_err(internal_error)?
    .ok_or((
        StatusCode::CONFLICT,
        "Objektet har uppdaterats av någon annan".into(),
    ))?;

    audit::write_audit(
        &mut *tx,
        ctx.clone(),
        Some(&actor),
        EntityType::Edge,
        id,
        AuditAction::Patch,
        Some(serde_json::json!({ "metadata": before_metadata })),
        Some(patch),
        serde_json::to_value(&updated).ok(),
    )
    .await
    .map_err(internal_error)?;

    let validation = validate_edge_metadata(&updated.kind, &updated.metadata);

    let mut created_needs_review_claim = false;
    if let Some(v) = &validation {
        if v.needs_review {
            let reason = v
                .issues
                .iter()
                .find(|i| {
                    matches!(
                        i.severity,
                        crate::validation::ValidationSeverity::NeedsReview
                    )
                })
                .map(|i| i.message_sv.as_str())
                .unwrap_or("metadata guidance");

            created_needs_review_claim =
                ensure_needs_review_claim(&mut tx, &ctx, Some(&actor), id, reason).await?;
        }
    }

    tx.commit().await.map_err(internal_error)?;

    let mut headers = HeaderMap::new();
    headers.insert(
        axum::http::header::ETAG,
        etag_from_updated_at(updated.updated_at),
    );

    Ok((
        headers,
        Json(EdgeWriteResponse {
            edge: updated,
            validation,
            created_needs_review_claim,
        }),
    ))
}
