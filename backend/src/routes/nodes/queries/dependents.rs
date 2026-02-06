use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use uuid::Uuid;

use crate::models::Edge;
use crate::routes::AppState;

use crate::routes::nodes::walk::{materialize_walk, BlastRadiusNode, WalkRow};

use super::internal_error;

#[derive(Debug, serde::Deserialize)]
pub struct DependentsQuery {
    pub max_depth: Option<i32>,
    pub min_confidence: Option<i16>,
    pub include_needs_review: Option<bool>,
}

#[derive(Debug, serde::Serialize)]
pub struct DependentsResponse {
    pub root_node_id: Uuid,
    pub max_depth: i32,
    pub min_confidence: i16,
    pub include_needs_review: bool,
    pub nodes: Vec<BlastRadiusNode>,
    pub edges: Vec<Edge>,
}

pub async fn get_dependents(
    State(state): State<AppState>,
    Path(root_id): Path<Uuid>,
    Query(q): Query<DependentsQuery>,
) -> Result<Json<DependentsResponse>, (StatusCode, String)> {
    let exists: (bool,) =
        sqlx::query_as("SELECT EXISTS(SELECT 1 FROM nodes WHERE id = $1 AND deleted_at IS NULL)")
            .bind(root_id)
            .fetch_one(&state.pool)
            .await
            .map_err(internal_error)?;

    if !exists.0 {
        return Err((StatusCode::NOT_FOUND, "Noden finns inte".into()));
    }

    let mut max_depth = q.max_depth.unwrap_or(1);
    if max_depth < 0 {
        max_depth = 0;
    }
    if max_depth > 20 {
        max_depth = 20;
    }

    let min_confidence = q.min_confidence.unwrap_or(0);
    let include_needs_review = q.include_needs_review.unwrap_or(true);

    let sql_upstream_including_needs_review = r#"
        WITH RECURSIVE walk AS (
            SELECT 0::int AS depth, $1::uuid AS node_id, NULL::uuid AS edge_id
            UNION ALL
            SELECT
                w.depth + 1,
                e.from_id AS node_id,
                e.id      AS edge_id
            FROM walk w
            JOIN edges e
              ON e.to_id = w.node_id
            JOIN edge_claims c
              ON c.edge_id = e.id
             AND c.status IN ('active', 'needs_review')
             AND c.confidence >= $3
            WHERE w.depth < $2
        )
        SELECT node_id, depth, edge_id
        FROM walk
    "#;

    let sql_upstream_active_only = r#"
        WITH RECURSIVE walk AS (
            SELECT 0::int AS depth, $1::uuid AS node_id, NULL::uuid AS edge_id
            UNION ALL
            SELECT
                w.depth + 1,
                e.from_id AS node_id,
                e.id      AS edge_id
            FROM walk w
            JOIN edges e
              ON e.to_id = w.node_id
            JOIN edge_claims c
              ON c.edge_id = e.id
             AND c.status = 'active'
             AND c.confidence >= $3
            WHERE w.depth < $2
        )
        SELECT node_id, depth, edge_id
        FROM walk
    "#;

    let sql = if include_needs_review {
        sql_upstream_including_needs_review
    } else {
        sql_upstream_active_only
    };

    let walked = sqlx::query_as::<_, WalkRow>(sql)
        .bind(root_id)
        .bind(max_depth)
        .bind(min_confidence)
        .fetch_all(&state.pool)
        .await
        .map_err(internal_error)?;

    let (nodes_with_depth, edges) = materialize_walk(&state.pool, walked).await?;

    Ok(Json(DependentsResponse {
        root_node_id: root_id,
        max_depth,
        min_confidence,
        include_needs_review,
        nodes: nodes_with_depth,
        edges,
    }))
}
