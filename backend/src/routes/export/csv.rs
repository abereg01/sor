use crate::models::Node;
use crate::routes::edges::flows::load_flow_map_for_claim_ids;
use crate::routes::AppState;
use axum::extract::{Query, State};
use axum::http::{HeaderMap, StatusCode};
use sqlx::Row;
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;
use uuid::Uuid;

use super::util::{
    csv_escape, csv_headers_csv, csv_opt, csv_opt_time, csv_opt_uuid, EdgeScope, ExportRequest,
};

pub(super) async fn export_snapshot_csv(
    State(state): State<AppState>,
    Query(req): Query<ExportRequest>,
) -> Result<(HeaderMap, String), (StatusCode, String)> {
    let spec = req
        .filter_spec()
        .map_err(|e| (StatusCode::BAD_REQUEST, e))?;

    let include_edges = req.include_edges();

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

    let edges = if include_edges {
        match (&node_ids, req.edge_scope()) {
            (Some(ids), EdgeScope::Both) => sqlx::query(
                r#"
                    SELECT id, kind, from_id, to_id
                    FROM edges
                    WHERE from_id = ANY($1) AND to_id = ANY($1)
                    ORDER BY kind, from_id, to_id, id
                    "#,
            )
            .bind(ids)
            .fetch_all(&state.pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
            (Some(ids), EdgeScope::Any) => sqlx::query(
                r#"
                    SELECT id, kind, from_id, to_id
                    FROM edges
                    WHERE from_id = ANY($1) OR to_id = ANY($1)
                    ORDER BY kind, from_id, to_id, id
                    "#,
            )
            .bind(ids)
            .fetch_all(&state.pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
            (None, _) => sqlx::query(
                r#"
                    SELECT id, kind, from_id, to_id
                    FROM edges
                    ORDER BY kind, from_id, to_id, id
                    "#,
            )
            .fetch_all(&state.pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
        }
    } else {
        vec![]
    };

    let mut out = String::new();
    out.push_str("record_type,id,kind,name,from_id,to_id\n");

    for n in nodes {
        out.push_str(&format!(
            "node,{},{},{},{},{}\n",
            n.id,
            csv_escape(&n.kind),
            csv_escape(&n.name),
            "",
            ""
        ));
    }

    for e in edges {
        let id: Uuid = e.get("id");
        let kind: String = e.get("kind");
        let from_id: Uuid = e.get("from_id");
        let to_id: Uuid = e.get("to_id");
        out.push_str(&format!(
            "edge,{},{},{},{},{}\n",
            id,
            csv_escape(&kind),
            "",
            from_id,
            to_id
        ));
    }

    Ok((csv_headers_csv(), out))
}

pub(super) async fn export_nodes_csv(State(state): State<AppState>) -> (HeaderMap, String) {
    let rows = sqlx::query!(
        r#"
        SELECT id, name, kind
        FROM nodes
        WHERE deleted_at IS NULL
        ORDER BY kind, name, id
        "#
    )
    .fetch_all(&state.pool)
    .await
    .unwrap();

    let mut out = String::new();
    out.push_str("id,name,kind\n");
    for r in rows {
        out.push_str(&format!(
            "{},{},{}\n",
            r.id,
            csv_escape(&r.name),
            csv_escape(&r.kind)
        ));
    }

    (csv_headers_csv(), out)
}

pub(super) async fn export_edges_csv(State(state): State<AppState>) -> (HeaderMap, String) {
    let rows = sqlx::query!(
        r#"
        SELECT id, from_id, to_id, kind
        FROM edges
        ORDER BY kind, from_id, to_id, id
        "#
    )
    .fetch_all(&state.pool)
    .await
    .unwrap();

    let mut out = String::new();
    out.push_str("id,from_id,to_id,kind\n");
    for r in rows {
        out.push_str(&format!(
            "{},{},{},{}\n",
            r.id,
            r.from_id,
            r.to_id,
            csv_escape(&r.kind)
        ));
    }

    (csv_headers_csv(), out)
}

pub(super) async fn export_claims_current_csv(
    State(state): State<AppState>,
) -> (HeaderMap, String) {
    let rows = sqlx::query(
        r#"
        SELECT
          e.id AS edge_id,
          c.*
        FROM edges e
        LEFT JOIN LATERAL (
          SELECT *
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
    .unwrap();

    let mut out = String::new();
    out.push_str("edge_id,claim_id,status,source,confidence,created_by,created_at,updated_at,last_verified_at,import_batch_id\n");

    for r in rows {
        let edge_id: Uuid = r.get("edge_id");

        let claim_id: Option<Uuid> = r.try_get("id").ok();
        let status: Option<String> = r.try_get("status").ok();
        let source: Option<String> = r.try_get("source").ok();
        let confidence: Option<i16> = r.try_get("confidence").ok();
        let created_by: Option<String> = r.try_get("created_by").ok();
        let created_at: Option<OffsetDateTime> = r.try_get("created_at").ok();
        let updated_at: Option<OffsetDateTime> = r.try_get("updated_at").ok();
        let last_verified_at: Option<OffsetDateTime> = r.try_get("last_verified_at").ok();
        let import_batch_id: Option<Uuid> = r.try_get("import_batch_id").ok();

        out.push_str(&format!(
            "{},{},{},{},{},{},{},{},{},{}\n",
            edge_id,
            csv_opt_uuid(&claim_id),
            csv_escape(status.as_deref().unwrap_or("")),
            csv_escape(source.as_deref().unwrap_or("")),
            confidence
                .map(|c| c.to_string())
                .unwrap_or_else(|| "".to_string()),
            csv_escape(created_by.as_deref().unwrap_or("")),
            created_at
                .map(|t| t.format(&Rfc3339).unwrap_or_default())
                .unwrap_or_default(),
            updated_at
                .map(|t| t.format(&Rfc3339).unwrap_or_default())
                .unwrap_or_default(),
            csv_opt_time(&last_verified_at),
            csv_opt_uuid(&import_batch_id),
        ));
    }

    (csv_headers_csv(), out)
}

pub(super) async fn export_flows_current_csv(State(state): State<AppState>) -> (HeaderMap, String) {
    let edge_rows = sqlx::query(
        r#"
        SELECT
          e.id,
          e.created_at,
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
    .unwrap();

    let claim_ids: Vec<Uuid> = edge_rows
        .iter()
        .filter_map(|r| r.try_get::<Uuid, _>("current_claim_id").ok())
        .collect();

    let flow_map = if claim_ids.is_empty() {
        std::collections::HashMap::new()
    } else {
        load_flow_map_for_claim_ids(&state.pool, &claim_ids)
            .await
            .unwrap()
    };

    let mut out = String::new();
    out.push_str("edge_id,claim_id,flow_id,flow_type,data_category_id,protocol,frequency,implicit,created_at\n");

    for r in edge_rows {
        let edge_id: Uuid = r.get("id");
        let edge_created_at: OffsetDateTime = r.get("created_at");
        let current_claim_id: Option<Uuid> = r.try_get("current_claim_id").ok();

        match current_claim_id {
            Some(cid) => {
                let mut rows = flow_map.get(&cid).cloned().unwrap_or_default();
                if rows.is_empty() {
                    out.push_str(&format!(
                        "{},{},{},{},{},{},{},{},{}\n",
                        edge_id,
                        cid,
                        "",
                        "data_flow",
                        "",
                        "",
                        "continuous",
                        "true",
                        edge_created_at.format(&Rfc3339).unwrap_or_default()
                    ));
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
                    for f in rows {
                        out.push_str(&format!(
                            "{},{},{},{},{},{},{},{},{}\n",
                            edge_id,
                            f.claim_id,
                            f.id,
                            csv_escape(&f.flow_type),
                            f.data_category_id
                                .map(|x| x.to_string())
                                .unwrap_or_else(|| "".to_string()),
                            csv_opt(&f.protocol),
                            csv_opt(&f.frequency),
                            "false",
                            f.created_at.format(&Rfc3339).unwrap_or_default(),
                        ));
                    }
                }
            }
            None => {
                out.push_str(&format!(
                    "{},{},{},{},{},{},{},{},{}\n",
                    edge_id,
                    "",
                    "",
                    "data_flow",
                    "",
                    "",
                    "continuous",
                    "true",
                    edge_created_at.format(&Rfc3339).unwrap_or_default()
                ));
            }
        }
    }

    (csv_headers_csv(), out)
}
