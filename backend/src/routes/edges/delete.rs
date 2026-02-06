use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    Extension,
};
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;
use uuid::Uuid;

use crate::{
    audit::{self, AuditAction, EntityType, RequestContext},
    auth::AuthActor,
    models::Edge,
    routes::{etag_from_updated_at, is_match, require_if_match, AppState},
};

use super::helpers::internal_error;

pub async fn delete_edge(
    State(state): State<AppState>,
    Extension(ctx): Extension<RequestContext>,
    Extension(actor): Extension<AuthActor>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let if_match = require_if_match(&headers)?;
    let expected_updated_at = OffsetDateTime::parse(&if_match, &Rfc3339)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Ogiltig If-Match".into()))?;

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

    let deleted = sqlx::query(
        r#"
        DELETE FROM edges
        WHERE id = $1 AND updated_at = $2
        "#,
    )
    .bind(id)
    .bind(expected_updated_at)
    .execute(&mut *tx)
    .await
    .map_err(internal_error)?;

    if deleted.rows_affected() == 0 {
        return Err((
            StatusCode::CONFLICT,
            "Objektet har uppdaterats av någon annan".into(),
        ));
    }

    audit::write_audit(
        &mut *tx,
        ctx,
        Some(&actor),
        EntityType::Edge,
        id,
        AuditAction::Delete,
        serde_json::to_value(&before).ok(),
        None,
        None,
    )
    .await
    .map_err(internal_error)?;

    tx.commit().await.map_err(internal_error)?;

    Ok(StatusCode::NO_CONTENT)
}
