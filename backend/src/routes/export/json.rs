use crate::models::{Edge, EdgeClaim, Node};
use crate::routes::edges::flows::load_flow_map_for_claim_ids;
use crate::routes::AppState;
use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::Json;
use serde::Serialize;
use sqlx::Row;
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;
use uuid::Uuid;

use super::util::{EdgeScope, ExportRequest};

#[derive(Serialize)]
struct ExportSnapshot {
    version: i32,
    exported_at: String,
    nodes: Vec<Node>,
    edges: Vec<ExportEdgeRow>,
}

#[derive(Serialize)]
struct ExportEdgeRow {
    edge: Edge,
    current_claim: Option<EdgeClaim>,
    flows: Vec<ExportFlowRow>,
}

#[derive(Serialize)]
struct ExportFlowRow {
    flow_id: Option<Uuid>,
    claim_id: Option<Uuid>,
    flow_type: String,
    data_category_id: Option<Uuid>,
    protocol: Option<String>,
    frequency: Option<String>,
    implicit: bool,
    created_at: String,
}

pub(super) async fn export_snapshot_json(
    State(state): State<AppState>,
    Query(req): Query<ExportRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let exported_at = OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string());

    let spec = req
        .filter_spec()
        .map_err(|e| (StatusCode::BAD_REQUEST, e))?;

    let include_edges = req.include_edges();
    let include_claims = req.include_claims();
    let include_flows = req.include_flows() && include_claims;

    let all_nodes: Vec<Node> = sqlx::query_as::<_, Node>(
        r#"
        SELECT *
        FROM nodes
        WHERE deleted_at IS NULL
        ORDER BY kind, name, id
        "#,
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let nodes: Vec<Node> = all_nodes
        .into_iter()
        .filter(|n| spec.matches_node(n))
        .collect();

    let node_ids: Option<Vec<Uuid>> = if spec.is_empty() {
        None
    } else {
        Some(nodes.iter().map(|n| n.id).collect())
    };

    let mut edges_out: Vec<ExportEdgeRow> = vec![];

    if include_edges {
        let edge_rows = match (&node_ids, req.edge_scope()) {
            (Some(ids), EdgeScope::Both) => sqlx::query(
                r#"
                    SELECT
                      e.*,
                      c.id AS current_claim_id
                    FROM edges e
                    LEFT JOIN LATERAL (
                      SELECT id
                      FROM edge_claims
                      WHERE edge_id = e.id
                        AND status IN ('active', 'needs_review')
                      ORDER BY created_at DESC
                      LIMIT 1
                    ) c ON TRUE
                    WHERE e.from_id = ANY($1) AND e.to_id = ANY($1)
                    ORDER BY e.kind, e.from_id, e.to_id, e.id
                    "#,
            )
            .bind(ids)
            .fetch_all(&state.pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
            (Some(ids), EdgeScope::Any) => sqlx::query(
                r#"
                    SELECT
                      e.*,
                      c.id AS current_claim_id
                    FROM edges e
                    LEFT JOIN LATERAL (
                      SELECT id
                      FROM edge_claims
                      WHERE edge_id = e.id
                        AND status IN ('active', 'needs_review')
                      ORDER BY created_at DESC
                      LIMIT 1
                    ) c ON TRUE
                    WHERE e.from_id = ANY($1) OR e.to_id = ANY($1)
                    ORDER BY e.kind, e.from_id, e.to_id, e.id
                    "#,
            )
            .bind(ids)
            .fetch_all(&state.pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
            (None, _) => sqlx::query(
                r#"
                    SELECT
                      e.*,
                      c.id AS current_claim_id
                    FROM edges e
                    LEFT JOIN LATERAL (
                      SELECT id
                      FROM edge_claims
                      WHERE edge_id = e.id
                        AND status IN ('active', 'needs_review')
                      ORDER BY created_at DESC
                      LIMIT 1
                    ) c ON TRUE
                    ORDER BY e.kind, e.from_id, e.to_id, e.id
                    "#,
            )
            .fetch_all(&state.pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
        };

        let claim_ids: Vec<Uuid> = if include_claims {
            edge_rows
                .iter()
                .filter_map(|r| r.try_get::<Uuid, _>("current_claim_id").ok())
                .collect()
        } else {
            vec![]
        };

        let flow_map = if include_flows && !claim_ids.is_empty() {
            load_flow_map_for_claim_ids(&state.pool, &claim_ids)
                .await
                .map_err(|e| e)?
        } else {
            std::collections::HashMap::new()
        };

        let claims: Vec<EdgeClaim> = if include_claims && !claim_ids.is_empty() {
            sqlx::query_as::<_, EdgeClaim>(
                r#"
                SELECT *
                FROM edge_claims
                WHERE id = ANY($1)
                "#,
            )
            .bind(&claim_ids)
            .fetch_all(&state.pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        } else {
            vec![]
        };

        let mut claim_by_id = std::collections::HashMap::<Uuid, EdgeClaim>::new();
        for c in claims {
            claim_by_id.insert(c.id, c);
        }

        edges_out = Vec::with_capacity(edge_rows.len());

        for r in edge_rows {
            let edge = Edge {
                id: r.get("id"),
                from_id: r.get("from_id"),
                to_id: r.get("to_id"),
                kind: r.get("kind"),
                metadata: r.get("metadata"),
                created_at: r.get("created_at"),
                updated_at: r.get("updated_at"),
            };

            let current_claim_id: Option<Uuid> = if include_claims {
                r.try_get("current_claim_id").ok()
            } else {
                None
            };
            let current_claim = current_claim_id.and_then(|cid| claim_by_id.get(&cid).cloned());

            let flows_out: Vec<ExportFlowRow> = if include_flows {
                match current_claim_id {
                    Some(cid) => {
                        let mut rows = flow_map.get(&cid).cloned().unwrap_or_default();

                        if rows.is_empty() {
                            vec![ExportFlowRow {
                                flow_id: None,
                                claim_id: Some(cid),
                                flow_type: "data_flow".to_string(),
                                data_category_id: None,
                                protocol: None,
                                frequency: Some("continuous".to_string()),
                                implicit: true,
                                created_at: edge
                                    .created_at
                                    .format(&Rfc3339)
                                    .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string()),
                            }]
                        } else {
                            rows.sort_by_key(|f| {
                                (
                                    f.flow_type.clone(),
                                    f.data_category_id,
                                    f.protocol.clone(),
                                    f.frequency.clone(),
                                    f.id,
                                )
                            });
                            rows.into_iter()
                                .map(|f| ExportFlowRow {
                                    flow_id: Some(f.id),
                                    claim_id: Some(f.claim_id),
                                    flow_type: f.flow_type,
                                    data_category_id: f.data_category_id,
                                    protocol: f.protocol,
                                    frequency: f.frequency,
                                    implicit: false,
                                    created_at: f
                                        .created_at
                                        .format(&Rfc3339)
                                        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string()),
                                })
                                .collect()
                        }
                    }
                    None => vec![ExportFlowRow {
                        flow_id: None,
                        claim_id: None,
                        flow_type: "data_flow".to_string(),
                        data_category_id: None,
                        protocol: None,
                        frequency: Some("continuous".to_string()),
                        implicit: true,
                        created_at: edge
                            .created_at
                            .format(&Rfc3339)
                            .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string()),
                    }],
                }
            } else {
                vec![]
            };

            edges_out.push(ExportEdgeRow {
                edge,
                current_claim,
                flows: flows_out,
            });
        }
    }

    let snapshot = ExportSnapshot {
        version: 1,
        exported_at,
        nodes,
        edges: edges_out,
    };

    Ok(Json(serde_json::to_value(snapshot).unwrap()))
}
