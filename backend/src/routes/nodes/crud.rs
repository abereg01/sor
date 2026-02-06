use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Deserialize;
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;
use uuid::Uuid;

use crate::{
    audit::{self, AuditAction, EntityType, RequestContext},
    auth::AuthActor,
    models::{MergePatch, NewNode, Node, UpdateNode},
    routes::{etag_from_updated_at, is_match, patch::merge_patch, require_if_match, AppState},
};

use crate::routes::edges::helpers::{internal_error, map_sqlx_error};

#[derive(Debug, Deserialize)]
pub struct NodesQuery {
    #[serde(default)]
    pub include_deleted: bool,
}

#[derive(Debug, Deserialize)]
pub struct NodeQuery {
    #[serde(default)]
    pub include_deleted: bool,
}

pub async fn list_nodes(
    State(state): State<AppState>,
    Query(q): Query<NodesQuery>,
) -> Result<Json<Vec<Node>>, (StatusCode, String)> {
    let nodes: Vec<Node> = if q.include_deleted {
        sqlx::query_as(
            r#"
            SELECT id, kind, name, metadata, created_at, updated_at, deleted_at, deleted_by
            FROM nodes
            ORDER BY created_at DESC
            "#,
        )
        .fetch_all(&state.pool)
        .await
        .map_err(internal_error)?
    } else {
        sqlx::query_as(
            r#"
            SELECT id, kind, name, metadata, created_at, updated_at, deleted_at, deleted_by
            FROM nodes
            WHERE deleted_at IS NULL
            ORDER BY created_at DESC
            "#,
        )
        .fetch_all(&state.pool)
        .await
        .map_err(internal_error)?
    };

    Ok(Json(nodes))
}

pub async fn get_node(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(q): Query<NodeQuery>,
) -> Result<(HeaderMap, Json<Node>), (StatusCode, String)> {
    let node: Option<Node> = if q.include_deleted {
        sqlx::query_as(
            r#"
            SELECT id, kind, name, metadata, created_at, updated_at, deleted_at, deleted_by
            FROM nodes
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(&state.pool)
        .await
        .map_err(internal_error)?
    } else {
        sqlx::query_as(
            r#"
            SELECT id, kind, name, metadata, created_at, updated_at, deleted_at, deleted_by
            FROM nodes
            WHERE id = $1 AND deleted_at IS NULL
            "#,
        )
        .bind(id)
        .fetch_optional(&state.pool)
        .await
        .map_err(internal_error)?
    };

    let node = node.ok_or((StatusCode::NOT_FOUND, "Objektet finns inte längre".into()))?;

    let mut headers = HeaderMap::new();
    headers.insert(
        axum::http::header::ETAG,
        etag_from_updated_at(node.updated_at),
    );

    Ok((headers, Json(node)))
}

pub async fn create_node(
    State(state): State<AppState>,
    axum::Extension(ctx): axum::Extension<RequestContext>,
    axum::Extension(actor): axum::Extension<AuthActor>,
    Json(payload): Json<NewNode>,
) -> Result<(StatusCode, HeaderMap, Json<Node>), (StatusCode, String)> {
    if payload.name.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Namn får inte vara tomt".into()));
    }

    let id = Uuid::new_v4();
    let mut tx = state.pool.begin().await.map_err(internal_error)?;

    let node = sqlx::query_as::<_, Node>(
        r#"
        INSERT INTO nodes (id, kind, name, metadata)
        VALUES ($1, $2, $3, $4)
        RETURNING id, kind, name, metadata, created_at, updated_at, deleted_at, deleted_by
        "#,
    )
    .bind(id)
    .bind(payload.kind.as_str())
    .bind(payload.name)
    .bind(payload.metadata)
    .fetch_one(&mut *tx)
    .await
    .map_err(map_sqlx_error)?;

    audit::write_audit(
        &mut *tx,
        ctx,
        Some(&actor),
        EntityType::Node,
        node.id,
        AuditAction::Create,
        None,
        None,
        serde_json::to_value(&node).ok(),
    )
    .await
    .map_err(internal_error)?;

    tx.commit().await.map_err(internal_error)?;

    let mut headers = HeaderMap::new();
    headers.insert(
        axum::http::header::ETAG,
        etag_from_updated_at(node.updated_at),
    );

    Ok((StatusCode::CREATED, headers, Json(node)))
}

pub async fn update_node(
    State(state): State<AppState>,
    axum::Extension(ctx): axum::Extension<RequestContext>,
    axum::Extension(actor): axum::Extension<AuthActor>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateNode>,
) -> Result<(HeaderMap, Json<Node>), (StatusCode, String)> {
    let if_match = require_if_match(&headers)?;
    let expected_updated_at = OffsetDateTime::parse(&if_match, &Rfc3339)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Ogiltig If-Match".into()))?;

    let mut tx = state.pool.begin().await.map_err(internal_error)?;

    let before = sqlx::query_as::<_, Node>(
        r#"
        SELECT id, kind, name, metadata, created_at, updated_at, deleted_at, deleted_by
        FROM nodes
        WHERE id = $1 AND deleted_at IS NULL
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

    let kind_str = payload.kind.map(|k| k.as_str());

    let updated = sqlx::query_as::<_, Node>(
        r#"
        UPDATE nodes
        SET
          kind = COALESCE($2, kind),
          name = COALESCE($3, name),
          metadata = COALESCE($4, metadata),
          updated_at = now()
        WHERE id = $1 AND updated_at = $5 AND deleted_at IS NULL
        RETURNING id, kind, name, metadata, created_at, updated_at, deleted_at, deleted_by
        "#,
    )
    .bind(id)
    .bind(kind_str)
    .bind(payload.name.clone())
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
        ctx,
        Some(&actor),
        EntityType::Node,
        id,
        AuditAction::Patch,
        serde_json::to_value(&before).ok(),
        serde_json::to_value(&payload).ok(),
        serde_json::to_value(&updated).ok(),
    )
    .await
    .map_err(internal_error)?;

    tx.commit().await.map_err(internal_error)?;

    let mut headers = HeaderMap::new();
    headers.insert(
        axum::http::header::ETAG,
        etag_from_updated_at(updated.updated_at),
    );

    Ok((headers, Json(updated)))
}

pub async fn patch_node_metadata(
    State(state): State<AppState>,
    axum::Extension(ctx): axum::Extension<RequestContext>,
    axum::Extension(actor): axum::Extension<AuthActor>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(MergePatch(patch)): Json<MergePatch>,
) -> Result<(HeaderMap, Json<Node>), (StatusCode, String)> {
    let if_match = require_if_match(&headers)?;
    let expected_updated_at = OffsetDateTime::parse(&if_match, &Rfc3339)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Ogiltig If-Match".into()))?;

    let mut tx = state.pool.begin().await.map_err(internal_error)?;

    let mut before = sqlx::query_as::<_, Node>(
        r#"
        SELECT id, kind, name, metadata, created_at, updated_at, deleted_at, deleted_by
        FROM nodes
        WHERE id = $1 AND deleted_at IS NULL
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

    let updated = sqlx::query_as::<_, Node>(
        r#"
        UPDATE nodes
        SET metadata = $2, updated_at = now()
        WHERE id = $1 AND updated_at = $3 AND deleted_at IS NULL
        RETURNING id, kind, name, metadata, created_at, updated_at, deleted_at, deleted_by
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
        ctx,
        Some(&actor),
        EntityType::Node,
        id,
        AuditAction::Patch,
        Some(serde_json::json!({ "metadata": before_metadata })),
        Some(patch),
        serde_json::to_value(&updated).ok(),
    )
    .await
    .map_err(internal_error)?;

    tx.commit().await.map_err(internal_error)?;

    let mut headers = HeaderMap::new();
    headers.insert(
        axum::http::header::ETAG,
        etag_from_updated_at(updated.updated_at),
    );

    Ok((headers, Json(updated)))
}

pub async fn delete_node(
    State(state): State<AppState>,
    axum::Extension(ctx): axum::Extension<RequestContext>,
    axum::Extension(actor): axum::Extension<AuthActor>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let if_match = require_if_match(&headers)?;
    let expected_updated_at = OffsetDateTime::parse(&if_match, &Rfc3339)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Ogiltig If-Match".into()))?;

    let mut tx = state.pool.begin().await.map_err(internal_error)?;

    let before = sqlx::query_as::<_, Node>(
        r#"
        SELECT id, kind, name, metadata, created_at, updated_at, deleted_at, deleted_by
        FROM nodes
        WHERE id = $1 AND deleted_at IS NULL
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

    let deleted = sqlx::query_as::<_, Node>(
        r#"
        UPDATE nodes
        SET deleted_at = now(),
            deleted_by = $3,
            updated_at = now()
        WHERE id = $1 AND updated_at = $2 AND deleted_at IS NULL
        RETURNING id, kind, name, metadata, created_at, updated_at, deleted_at, deleted_by
        "#,
    )
    .bind(id)
    .bind(expected_updated_at)
    .bind(actor.username.clone())
    .fetch_optional(&mut *tx)
    .await
    .map_err(map_sqlx_error)?
    .ok_or((
        StatusCode::CONFLICT,
        "Objektet har uppdaterats av någon annan".into(),
    ))?;

    audit::write_audit(
        &mut *tx,
        ctx,
        Some(&actor),
        EntityType::Node,
        id,
        AuditAction::Delete,
        serde_json::to_value(&before).ok(),
        Some(serde_json::json!({ "deleted": true })),
        serde_json::to_value(&deleted).ok(),
    )
    .await
    .map_err(internal_error)?;

    tx.commit().await.map_err(internal_error)?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn restore_node(
    State(state): State<AppState>,
    axum::Extension(ctx): axum::Extension<RequestContext>,
    axum::Extension(actor): axum::Extension<AuthActor>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<(HeaderMap, Json<Node>), (StatusCode, String)> {
    let if_match = require_if_match(&headers)?;
    let expected_updated_at = OffsetDateTime::parse(&if_match, &Rfc3339)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Ogiltig If-Match".into()))?;

    let mut tx = state.pool.begin().await.map_err(internal_error)?;

    let before = sqlx::query_as::<_, Node>(
        r#"
        SELECT id, kind, name, metadata, created_at, updated_at, deleted_at, deleted_by
        FROM nodes
        WHERE id = $1 AND deleted_at IS NOT NULL
        "#,
    )
    .bind(id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(internal_error)?
    .ok_or((StatusCode::NOT_FOUND, "Objektet är inte raderat".into()))?;

    let current_etag = etag_from_updated_at(before.updated_at);
    if !is_match(&current_etag, &if_match) {
        return Err((
            StatusCode::CONFLICT,
            "Objektet har uppdaterats av någon annan".into(),
        ));
    }

    let restored = sqlx::query_as::<_, Node>(
        r#"
        UPDATE nodes
        SET deleted_at = NULL,
            deleted_by = NULL,
            updated_at = now()
        WHERE id = $1 AND updated_at = $2 AND deleted_at IS NOT NULL
        RETURNING id, kind, name, metadata, created_at, updated_at, deleted_at, deleted_by
        "#,
    )
    .bind(id)
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
        ctx,
        Some(&actor),
        EntityType::Node,
        id,
        AuditAction::Patch,
        serde_json::to_value(&before).ok(),
        Some(serde_json::json!({ "restore": true })),
        serde_json::to_value(&restored).ok(),
    )
    .await
    .map_err(internal_error)?;

    tx.commit().await.map_err(internal_error)?;

    let mut headers = HeaderMap::new();
    headers.insert(
        axum::http::header::ETAG,
        etag_from_updated_at(restored.updated_at),
    );

    Ok((headers, Json(restored)))
}

pub async fn duplicate_node(
    State(state): State<AppState>,
    axum::Extension(ctx): axum::Extension<RequestContext>,
    axum::Extension(actor): axum::Extension<AuthActor>,
    Path(id): Path<Uuid>,
) -> Result<(StatusCode, HeaderMap, Json<Node>), (StatusCode, String)> {
    let mut tx = state.pool.begin().await.map_err(internal_error)?;

    let original = sqlx::query_as::<_, Node>(
        r#"
        SELECT id, kind, name, metadata, created_at, updated_at, deleted_at, deleted_by
        FROM nodes
        WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(internal_error)?
    .ok_or((StatusCode::NOT_FOUND, "Objektet finns inte längre".into()))?;

    let new_id = Uuid::new_v4();
    let new_name = format!("{} (kopia)", original.name);

    let new_node = sqlx::query_as::<_, Node>(
        r#"
        INSERT INTO nodes (id, kind, name, metadata)
        VALUES ($1, $2, $3, $4)
        RETURNING id, kind, name, metadata, created_at, updated_at, deleted_at, deleted_by
        "#,
    )
    .bind(new_id)
    .bind(original.kind)
    .bind(new_name)
    .bind(original.metadata)
    .fetch_one(&mut *tx)
    .await
    .map_err(map_sqlx_error)?;

    audit::write_audit(
        &mut *tx,
        ctx,
        Some(&actor),
        EntityType::Node,
        new_node.id,
        AuditAction::Create,
        None,
        Some(serde_json::json!({ "duplicated_from": id })),
        serde_json::to_value(&new_node).ok(),
    )
    .await
    .map_err(internal_error)?;

    tx.commit().await.map_err(internal_error)?;

    let mut headers = HeaderMap::new();
    headers.insert(
        axum::http::header::ETAG,
        etag_from_updated_at(new_node.updated_at),
    );

    Ok((StatusCode::CREATED, headers, Json(new_node)))
}
