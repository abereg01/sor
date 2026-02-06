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
pub struct NeedsReviewInRadiusQuery {
    pub direction: Option<String>,
    pub max_depth: Option<i32>,
    pub confidence_threshold: Option<i16>,
}

#[derive(Debug, serde::Serialize)]
pub struct FlaggedEdge {
    pub edge: Edge,
    pub reason: String,

    pub claim_id: Uuid,
    pub status: String,
    pub confidence: i16,
    pub last_verified_at: Option<time::OffsetDateTime>,
    pub source: String,
}

#[derive(Debug, serde::Serialize)]
pub struct NeedsReviewInRadiusResponse {
    pub root_node_id: Uuid,
    pub direction: String,
    pub max_depth: i32,
    pub confidence_threshold: i16,
    pub nodes: Vec<BlastRadiusNode>,
    pub edges: Vec<Edge>,
    pub flagged_edges: Vec<FlaggedEdge>,
}

pub async fn get_needs_review_in_blast_radius(
    State(state): State<AppState>,
    Path(root_id): Path<Uuid>,
    Query(q): Query<NeedsReviewInRadiusQuery>,
) -> Result<Json<NeedsReviewInRadiusResponse>, (StatusCode, String)> {
    let exists: (bool,) =
        sqlx::query_as("SELECT EXISTS(SELECT 1 FROM nodes WHERE id = $1 AND deleted_at IS NULL)")
            .bind(root_id)
            .fetch_one(&state.pool)
            .await
            .map_err(internal_error)?;

    if !exists.0 {
        return Err((StatusCode::NOT_FOUND, "Noden finns inte".into()));
    }

    let direction = q.direction.unwrap_or_else(|| "downstream".to_string());
    if direction != "downstream" && direction != "upstream" {
        return Err((
            StatusCode::BAD_REQUEST,
            "direction måste vara 'downstream' eller 'upstream'".into(),
        ));
    }

    let mut max_depth = q.max_depth.unwrap_or(5);
    if max_depth < 0 {
        max_depth = 0;
    }
    if max_depth > 20 {
        max_depth = 20;
    }

    let confidence_threshold = q.confidence_threshold.unwrap_or(80);

    let sql_downstream = r#"
        WITH RECURSIVE walk AS (
            SELECT 0::int AS depth, $1::uuid AS node_id, NULL::uuid AS edge_id
            UNION ALL
            SELECT
                w.depth + 1,
                e.to_id AS node_id,
                e.id    AS edge_id
            FROM walk w
            JOIN edges e
              ON e.from_id = w.node_id
            JOIN edge_claims c
              ON c.edge_id = e.id
             AND c.status IN ('active','needs_review')
            WHERE w.depth < $2
        )
        SELECT node_id, depth, edge_id
        FROM walk
    "#;

    let sql_upstream = r#"
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
             AND c.status IN ('active','needs_review')
            WHERE w.depth < $2
        )
        SELECT node_id, depth, edge_id
        FROM walk
    "#;

    let sql = if direction == "downstream" {
        sql_downstream
    } else {
        sql_upstream
    };

    let walked = sqlx::query_as::<_, WalkRow>(sql)
        .bind(root_id)
        .bind(max_depth)
        .fetch_all(&state.pool)
        .await
        .map_err(internal_error)?;

    let (nodes_with_depth, edges) = materialize_walk(&state.pool, walked).await?;

    #[derive(sqlx::FromRow)]
    struct ClaimRow {
        edge_id: Uuid,
        claim_id: Uuid,
        status: String,
        confidence: i16,
        last_verified_at: Option<time::OffsetDateTime>,
        source: String,
    }

    let edge_ids: Vec<Uuid> = edges.iter().map(|e| e.id).collect();

    let claim_rows: Vec<ClaimRow> = if edge_ids.is_empty() {
        Vec::new()
    } else {
        sqlx::query_as::<_, ClaimRow>(
            r#"
            SELECT
              c.edge_id,
              c.id AS claim_id,
              c.status,
              c.confidence,
              c.last_verified_at,
              c.source
            FROM edge_claims c
            WHERE c.edge_id = ANY($1)
              AND c.status IN ('active','needs_review')
            "#,
        )
        .bind(&edge_ids)
        .fetch_all(&state.pool)
        .await
        .map_err(internal_error)?
    };

    use std::collections::HashMap;
    let mut claim_by_edge: HashMap<Uuid, ClaimRow> = HashMap::new();
    for r in claim_rows {
        claim_by_edge.insert(r.edge_id, r);
    }

    let mut flagged: Vec<FlaggedEdge> = Vec::new();

    for e in &edges {
        let Some(c) = claim_by_edge.get(&e.id) else {
            continue;
        };

        let mut reasons: Vec<&'static str> = Vec::new();
        if c.status == "needs_review" {
            reasons.push("status=needs_review");
        }
        if c.confidence < confidence_threshold {
            reasons.push("låg confidence");
        }
        if c.last_verified_at.is_none() {
            reasons.push("aldrig verifierad");
        }

        if !reasons.is_empty() {
            flagged.push(FlaggedEdge {
                edge: e.clone(),
                reason: reasons.join(", "),
                claim_id: c.claim_id,
                status: c.status.clone(),
                confidence: c.confidence,
                last_verified_at: c.last_verified_at,
                source: c.source.clone(),
            });
        }
    }

    Ok(Json(NeedsReviewInRadiusResponse {
        root_node_id: root_id,
        direction,
        max_depth,
        confidence_threshold,
        nodes: nodes_with_depth,
        edges,
        flagged_edges: flagged,
    }))
}
