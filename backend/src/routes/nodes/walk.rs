use axum::http::StatusCode;
use std::collections::{HashMap, HashSet};
use uuid::Uuid;

use crate::models::{Edge, Node};

#[derive(sqlx::FromRow)]
pub struct WalkRow {
    pub node_id: Uuid,
    pub depth: i32,
    pub edge_id: Option<Uuid>,
}

#[derive(Debug, serde::Serialize, Clone)]
pub struct BlastRadiusNode {
    pub node: Node,
    pub depth: i32,
}

pub async fn materialize_walk(
    pool: &sqlx::PgPool,
    walked: Vec<WalkRow>,
) -> Result<(Vec<BlastRadiusNode>, Vec<Edge>), (StatusCode, String)> {
    let mut node_depth: HashMap<Uuid, i32> = HashMap::new();
    let mut edge_ids: HashSet<Uuid> = HashSet::new();

    for r in walked {
        node_depth
            .entry(r.node_id)
            .and_modify(|d| {
                if r.depth < *d {
                    *d = r.depth;
                }
            })
            .or_insert(r.depth);

        if let Some(eid) = r.edge_id {
            edge_ids.insert(eid);
        }
    }

    let node_ids: Vec<Uuid> = node_depth.keys().cloned().collect();
    let edge_ids_vec: Vec<Uuid> = edge_ids.into_iter().collect();

    let nodes = sqlx::query_as::<_, Node>(
        r#"
        SELECT id, kind, name, metadata, created_at, updated_at, deleted_at, deleted_by
        FROM nodes
        WHERE id = ANY($1) AND deleted_at IS NULL
        "#,
    )
    .bind(&node_ids)
    .fetch_all(pool)
    .await
    .map_err(internal_error)?;

    let edges = if edge_ids_vec.is_empty() {
        Vec::new()
    } else {
        sqlx::query_as::<_, Edge>(
            r#"
            SELECT id, from_id, to_id, kind, metadata, created_at, updated_at
            FROM edges
            WHERE id = ANY($1)
            "#,
        )
        .bind(&edge_ids_vec)
        .fetch_all(pool)
        .await
        .map_err(internal_error)?
    };

    let mut nodes_with_depth: Vec<BlastRadiusNode> = nodes
        .into_iter()
        .map(|n| BlastRadiusNode {
            depth: *node_depth.get(&n.id).unwrap_or(&0),
            node: n,
        })
        .collect();

    nodes_with_depth.sort_by(|a, b| {
        a.depth
            .cmp(&b.depth)
            .then_with(|| a.node.name.to_lowercase().cmp(&b.node.name.to_lowercase()))
    });

    Ok((nodes_with_depth, edges))
}

fn internal_error<E: std::fmt::Display>(e: E) -> (StatusCode, String) {
    (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
}
