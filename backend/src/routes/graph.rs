use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use uuid::Uuid;

use crate::models::edge_claim_flow::EdgeClaimFlow;
use crate::routes::{etag_from_updated_at, AppState};

use crate::routes::edges::flows::load_flow_map_for_claim_ids;

pub fn router() -> Router<AppState> {
    Router::<AppState>::new()
        .route("/", get(get_graph))
        .route("/blast-radius/:id", get(blast_radius))
        .route("/reverse-deps/:id", get(reverse_deps))
}

#[derive(Serialize)]
pub struct GraphResponse {
    pub nodes: Vec<NodeRow>,
    pub links: Vec<EdgeRow>,
}

#[derive(Serialize)]
pub struct NodeRow {
    pub id: Uuid,
    pub kind: String,
    pub name: String,
    pub metadata: serde_json::Value,
    pub etag: String,
}

#[derive(Serialize)]
pub struct EdgeRow {
    pub id: Uuid,
    pub source: Uuid,
    pub target: Uuid,
    pub kind: String,
    pub metadata: serde_json::Value,
    pub etag: String,
    pub created_at: time::OffsetDateTime,
    pub updated_at: time::OffsetDateTime,
    pub current_claim_id: Option<Uuid>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub review_claim_id: Option<Uuid>,
    pub flows: Vec<GraphEdgeFlow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub review_flows: Option<Vec<GraphEdgeFlow>>,
}

#[derive(Serialize, Clone)]
pub struct GraphEdgeFlow {
    pub id: Uuid,
    pub claim_id: Option<Uuid>,
    pub flow_type: String,
    pub direction: String,
    pub data_category_id: Option<Uuid>,
    pub protocol: Option<String>,
    pub frequency: Option<String>,
    pub implicit: bool,
    pub created_at: time::OffsetDateTime,
}

#[derive(Deserialize, Default)]
struct GraphQuery {
    #[serde(default)]
    include_review: bool,
}

async fn get_graph(
    State(state): State<AppState>,
    Query(q): Query<GraphQuery>,
) -> Json<GraphResponse> {
    let node_rows = sqlx::query(
        r#"
        SELECT id, kind, name, metadata, updated_at
        FROM nodes
        WHERE deleted_at IS NULL
        ORDER BY name
        "#,
    )
    .fetch_all(&state.pool)
    .await
    .expect("fetch nodes failed");

    let nodes: Vec<NodeRow> = node_rows
        .into_iter()
        .map(|r| {
            let updated_at: time::OffsetDateTime = r.get("updated_at");
            let etag_hv = etag_from_updated_at(updated_at);
            let etag = etag_hv.to_str().unwrap_or("").to_string();

            NodeRow {
                id: r.get("id"),
                kind: r.get("kind"),
                name: r.get("name"),
                metadata: r.get("metadata"),
                etag,
            }
        })
        .collect();

    let edge_rows = sqlx::query(
        r#"
        SELECT
          e.id,
          e.from_id AS source,
          e.to_id   AS target,
          e.kind,
          e.metadata,
          e.created_at,
          e.updated_at,
          c_active.id AS current_claim_id,
          c_review.id AS review_claim_id
        FROM edges e
        JOIN nodes n_from ON n_from.id = e.from_id AND n_from.deleted_at IS NULL
        JOIN nodes n_to   ON n_to.id   = e.to_id   AND n_to.deleted_at IS NULL
        LEFT JOIN LATERAL (
          SELECT id
          FROM edge_claims
          WHERE edge_id = e.id
            AND status = 'active'
          ORDER BY created_at DESC
          LIMIT 1
        ) c_active ON TRUE
        LEFT JOIN LATERAL (
          SELECT id
          FROM edge_claims
          WHERE edge_id = e.id
            AND status = 'needs_review'
          ORDER BY created_at DESC
          LIMIT 1
        ) c_review ON TRUE
        ORDER BY e.kind
        "#,
    )
    .fetch_all(&state.pool)
    .await
    .expect("fetch edges failed");

    let mut claim_ids: Vec<Uuid> = edge_rows
        .iter()
        .filter_map(|r| r.try_get::<Uuid, _>("current_claim_id").ok())
        .collect();

    if q.include_review {
        for r in &edge_rows {
            if let Ok(id) = r.try_get::<Uuid, _>("review_claim_id") {
                claim_ids.push(id);
            }
        }
        claim_ids.sort();
        claim_ids.dedup();
    }

    let flow_map = if claim_ids.is_empty() {
        std::collections::HashMap::<Uuid, Vec<EdgeClaimFlow>>::new()
    } else {
        load_flow_map_for_claim_ids(&state.pool, &claim_ids)
            .await
            .expect("load flows failed")
    };

    let links: Vec<EdgeRow> = edge_rows
        .into_iter()
        .map(|r| {
            let updated_at: time::OffsetDateTime = r.get("updated_at");
            let created_at: time::OffsetDateTime = r.get("created_at");
            let etag_hv = etag_from_updated_at(updated_at);
            let etag = etag_hv.to_str().unwrap_or("").to_string();

            let current_claim_id: Option<Uuid> = r.try_get("current_claim_id").ok();
            let review_claim_id: Option<Uuid> = if q.include_review {
                r.try_get("review_claim_id").ok()
            } else {
                None
            };

            let flows: Vec<GraphEdgeFlow> =
                flows_for_claim_or_implicit(&flow_map, current_claim_id, created_at);

            let review_flows: Option<Vec<GraphEdgeFlow>> = if q.include_review {
                review_claim_id
                    .map(|cid| flows_for_claim_or_implicit(&flow_map, Some(cid), created_at))
            } else {
                None
            };

            EdgeRow {
                id: r.get("id"),
                source: r.get("source"),
                target: r.get("target"),
                kind: r.get("kind"),
                metadata: r.get("metadata"),
                etag,
                created_at,
                updated_at,
                current_claim_id,
                review_claim_id,
                flows,
                review_flows,
            }
        })
        .collect();

    Json(GraphResponse { nodes, links })
}

fn flows_for_claim_or_implicit(
    flow_map: &std::collections::HashMap<Uuid, Vec<EdgeClaimFlow>>,
    claim_id: Option<Uuid>,
    edge_created_at: time::OffsetDateTime,
) -> Vec<GraphEdgeFlow> {
    match claim_id {
        Some(cid) => {
            let mut rows = flow_map.get(&cid).cloned().unwrap_or_default();
            if rows.is_empty() {
                rows.push(EdgeClaimFlow {
                    id: Uuid::nil(),
                    claim_id: cid,
                    flow_type: "data_flow".to_string(),
                    direction: "source_to_target".to_string(),
                    data_category_id: None,
                    protocol: None,
                    frequency: Some("continuous".to_string()),
                    created_at: edge_created_at,
                });
            }

            rows.into_iter()
                .map(|f| GraphEdgeFlow {
                    id: f.id,
                    claim_id: Some(f.claim_id),
                    flow_type: f.flow_type,
                    direction: f.direction,
                    data_category_id: f.data_category_id,
                    protocol: f.protocol,
                    frequency: f.frequency,
                    implicit: f.id.is_nil(),
                    created_at: f.created_at,
                })
                .collect()
        }
        None => vec![GraphEdgeFlow {
            id: Uuid::nil(),
            claim_id: None,
            flow_type: "data_flow".to_string(),
            direction: "source_to_target".to_string(),
            data_category_id: None,
            protocol: None,
            frequency: Some("continuous".to_string()),
            implicit: true,
            created_at: edge_created_at,
        }],
    }
}

#[derive(Serialize)]
pub struct BlastRadiusResponse {
    pub node_ids: Vec<Uuid>,
    pub edge_ids: Vec<Uuid>,
}

async fn blast_radius(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Json<BlastRadiusResponse> {
    let rows = sqlx::query(
        r#"
        WITH RECURSIVE walk AS (
          SELECT $1::uuid AS node_id, NULL::uuid AS edge_id, 0 AS depth
          UNION ALL
          SELECT
            e.to_id AS node_id,
            e.id    AS edge_id,
            w.depth + 1
          FROM walk w
          JOIN edges e ON e.from_id = w.node_id
          WHERE w.depth < 6
        )
        SELECT node_id, edge_id FROM walk
        "#,
    )
    .bind(id)
    .fetch_all(&state.pool)
    .await
    .expect("blast radius failed");

    let mut node_ids: Vec<Uuid> = Vec::new();
    let mut edge_ids: Vec<Uuid> = Vec::new();

    for r in rows {
        let nid: Uuid = r.get("node_id");
        if !node_ids.contains(&nid) {
            node_ids.push(nid);
        }
        if let Ok(eid) = r.try_get::<Uuid, _>("edge_id") {
            if !edge_ids.contains(&eid) {
                edge_ids.push(eid);
            }
        }
    }

    Json(BlastRadiusResponse { node_ids, edge_ids })
}

#[derive(Serialize)]
pub struct ReverseDepsResponse {
    pub node_ids: Vec<Uuid>,
    pub edge_ids: Vec<Uuid>,
}

async fn reverse_deps(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Json<ReverseDepsResponse> {
    let rows = sqlx::query(
        r#"
        WITH RECURSIVE walk AS (
          SELECT $1::uuid AS node_id, NULL::uuid AS edge_id, 0 AS depth
          UNION ALL
          SELECT
            e.from_id AS node_id,
            e.id      AS edge_id,
            w.depth + 1
          FROM walk w
          JOIN edges e ON e.to_id = w.node_id
          WHERE w.depth < 6
        )
        SELECT node_id, edge_id FROM walk
        "#,
    )
    .bind(id)
    .fetch_all(&state.pool)
    .await
    .expect("reverse deps failed");

    let mut node_ids: Vec<Uuid> = Vec::new();
    let mut edge_ids: Vec<Uuid> = Vec::new();

    for r in rows {
        let nid: Uuid = r.get("node_id");
        if !node_ids.contains(&nid) {
            node_ids.push(nid);
        }
        if let Ok(eid) = r.try_get::<Uuid, _>("edge_id") {
            if !edge_ids.contains(&eid) {
                edge_ids.push(eid);
            }
        }
    }

    Json(ReverseDepsResponse { node_ids, edge_ids })
}
