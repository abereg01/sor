use axum::{
    extract::{Query, State},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use uuid::Uuid;

use crate::routes::AppState;

pub fn router() -> Router<AppState> {
    Router::<AppState>::new()
        .route("/path", get(shortest_path))
        .route("/paths", get(paths))
        .route("/compliance/pii", get(pii_flows))
}

#[derive(Deserialize)]
struct PathQuery {
    from: Uuid,
    to: Uuid,
    #[serde(default = "default_depth")]
    max_depth: i32,
}

fn default_depth() -> i32 {
    12
}

#[derive(Serialize)]
pub struct PathResult {
    pub node_ids: Vec<Uuid>,
    pub edge_ids: Vec<Uuid>,
}

async fn shortest_path(
    State(state): State<AppState>,
    Query(q): Query<PathQuery>,
) -> Json<PathResult> {
    let row = sqlx::query(
        r#"
        WITH RECURSIVE walk AS (
            SELECT
                e.id AS edge_id,
                e.from_id AS src,
                e.to_id AS dst,
                ARRAY[e.id] AS edge_path,
                ARRAY[e.from_id, e.to_id] AS node_path,
                1 AS depth
            FROM edges e
            WHERE e.from_id = $1

            UNION ALL

            SELECT
                e.id,
                w.src,
                e.to_id,
                w.edge_path || e.id,
                w.node_path || e.to_id,
                w.depth + 1
            FROM walk w
            JOIN edges e ON e.from_id = w.dst
            WHERE w.depth < $3
              AND NOT e.id = ANY(w.edge_path)
        )
        SELECT node_path, edge_path
        FROM walk
        WHERE dst = $2
        ORDER BY depth
        LIMIT 1
        "#,
    )
    .bind(q.from)
    .bind(q.to)
    .bind(q.max_depth)
    .fetch_optional(&state.pool)
    .await
    .expect("path query failed");

    if let Some(r) = row {
        let node_ids: Vec<Uuid> = r.try_get("node_path").unwrap_or_default();
        let edge_ids: Vec<Uuid> = r.try_get("edge_path").unwrap_or_default();
        Json(PathResult { node_ids, edge_ids })
    } else {
        Json(PathResult {
            node_ids: vec![],
            edge_ids: vec![],
        })
    }
}

#[derive(Deserialize)]
struct PathsQuery {
    from: Uuid,
    to: Uuid,
    #[serde(default = "default_paths_depth")]
    max_depth: i32,

    #[serde(default = "default_min_confidence")]
    min_confidence: i16,

    #[serde(default = "default_include_needs_review")]
    include_needs_review: bool,

    #[serde(default = "default_paths_limit")]
    limit: i32,
}

fn default_paths_depth() -> i32 {
    8
}

fn default_min_confidence() -> i16 {
    0
}

fn default_include_needs_review() -> bool {
    true
}

fn default_paths_limit() -> i32 {
    20
}

#[derive(Serialize)]
pub struct PathsResponse {
    pub from: Uuid,
    pub to: Uuid,
    pub max_depth: i32,
    pub min_confidence: i16,
    pub include_needs_review: bool,
    pub paths: Vec<PathResult>,
}

async fn paths(State(state): State<AppState>, Query(q): Query<PathsQuery>) -> Json<PathsResponse> {
    let mut max_depth = q.max_depth;
    if max_depth < 1 {
        max_depth = 1;
    }
    if max_depth > 20 {
        max_depth = 20;
    }

    let mut limit = q.limit;
    if limit < 1 {
        limit = 1;
    }
    if limit > 100 {
        limit = 100;
    }

    let sql_including_needs_review = r#"
        WITH RECURSIVE walk AS (
            SELECT
                e.id AS edge_id,
                e.from_id AS src,
                e.to_id AS dst,
                ARRAY[e.id] AS edge_path,
                ARRAY[e.from_id, e.to_id] AS node_path,
                1 AS depth
            FROM edges e
            JOIN edge_claims c
              ON c.edge_id = e.id
             AND c.status IN ('active','needs_review')
             AND c.confidence >= $3
            WHERE e.from_id = $1

            UNION ALL

            SELECT
                e.id AS edge_id,
                w.src,
                e.to_id AS dst,
                w.edge_path || e.id,
                w.node_path || e.to_id,
                w.depth + 1
            FROM walk w
            JOIN edges e
              ON e.from_id = w.dst
            JOIN edge_claims c
              ON c.edge_id = e.id
             AND c.status IN ('active','needs_review')
             AND c.confidence >= $3
            WHERE w.depth < $4
              AND NOT e.id = ANY(w.edge_path)
              AND NOT e.to_id = ANY(w.node_path)
        )
        SELECT node_path, edge_path, depth
        FROM walk
        WHERE dst = $2
        ORDER BY depth ASC
        LIMIT $5
    "#;

    let sql_active_only = r#"
        WITH RECURSIVE walk AS (
            SELECT
                e.id AS edge_id,
                e.from_id AS src,
                e.to_id AS dst,
                ARRAY[e.id] AS edge_path,
                ARRAY[e.from_id, e.to_id] AS node_path,
                1 AS depth
            FROM edges e
            JOIN edge_claims c
              ON c.edge_id = e.id
             AND c.status = 'active'
             AND c.confidence >= $3
            WHERE e.from_id = $1

            UNION ALL

            SELECT
                e.id AS edge_id,
                w.src,
                e.to_id AS dst,
                w.edge_path || e.id,
                w.node_path || e.to_id,
                w.depth + 1
            FROM walk w
            JOIN edges e
              ON e.from_id = w.dst
            JOIN edge_claims c
              ON c.edge_id = e.id
             AND c.status = 'active'
             AND c.confidence >= $3
            WHERE w.depth < $4
              AND NOT e.id = ANY(w.edge_path)
              AND NOT e.to_id = ANY(w.node_path)
        )
        SELECT node_path, edge_path, depth
        FROM walk
        WHERE dst = $2
        ORDER BY depth ASC
        LIMIT $5
    "#;

    let sql = if q.include_needs_review {
        sql_including_needs_review
    } else {
        sql_active_only
    };

    let rows = sqlx::query(sql)
        .bind(q.from)
        .bind(q.to)
        .bind(q.min_confidence)
        .bind(max_depth)
        .bind(limit)
        .fetch_all(&state.pool)
        .await
        .expect("paths query failed");

    let mut out: Vec<PathResult> = Vec::with_capacity(rows.len());

    for r in rows {
        let node_ids: Vec<Uuid> = r.try_get("node_path").unwrap_or_default();
        let edge_ids: Vec<Uuid> = r.try_get("edge_path").unwrap_or_default();
        out.push(PathResult { node_ids, edge_ids });
    }

    Json(PathsResponse {
        from: q.from,
        to: q.to,
        max_depth,
        min_confidence: q.min_confidence,
        include_needs_review: q.include_needs_review,
        paths: out,
    })
}

#[derive(Deserialize)]
struct ComplianceQuery {
    #[serde(default = "default_depth")]
    depth: i32,
}

#[derive(Serialize)]
pub struct ComplianceResult {
    pub matched_pii_nodes: Vec<Uuid>,
    pub node_ids: Vec<Uuid>,
    pub edge_ids: Vec<Uuid>,
}

async fn pii_flows(
    State(state): State<AppState>,
    Query(q): Query<ComplianceQuery>,
) -> Json<ComplianceResult> {
    let row = sqlx::query(
        r#"
        WITH pii AS (
            SELECT id
            FROM nodes
            WHERE deleted_at IS NULL
              AND LOWER(metadata->>'classification') = 'pii'
        ),
        RECURSIVE flow AS (
            SELECT
                e.id AS edge_id,
                e.from_id AS source,
                e.to_id AS target,
                ARRAY[e.id] AS edge_path,
                ARRAY[e.from_id, e.to_id] AS node_path,
                1 AS depth
            FROM edges e
            JOIN pii p ON e.from_id = p.id

            UNION ALL

            SELECT
                e.id,
                f.source,
                e.to_id,
                f.edge_path || e.id,
                f.node_path || e.to_id,
                f.depth + 1
            FROM flow f
            JOIN edges e ON e.from_id = f.target
            WHERE f.depth < $1
              AND NOT e.id = ANY(f.edge_path)
        )
        SELECT
            COALESCE((SELECT array_agg(id) FROM pii), ARRAY[]::uuid[]) AS pii_nodes,
            COALESCE(ARRAY(SELECT DISTINCT unnest(node_path)), ARRAY[]::uuid[]) AS node_ids,
            COALESCE(ARRAY(SELECT DISTINCT unnest(edge_path)), ARRAY[]::uuid[]) AS edge_ids
        FROM flow
        LIMIT 1
        "#,
    )
    .bind(q.depth)
    .fetch_optional(&state.pool)
    .await
    .expect("compliance query failed");

    if let Some(r) = row {
        let matched_pii_nodes: Vec<Uuid> = r.try_get("pii_nodes").unwrap_or_default();
        let node_ids: Vec<Uuid> = r.try_get("node_ids").unwrap_or_default();
        let edge_ids: Vec<Uuid> = r.try_get("edge_ids").unwrap_or_default();
        Json(ComplianceResult {
            matched_pii_nodes,
            node_ids,
            edge_ids,
        })
    } else {
        Json(ComplianceResult {
            matched_pii_nodes: vec![],
            node_ids: vec![],
            edge_ids: vec![],
        })
    }
}
