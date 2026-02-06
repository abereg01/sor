use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::helpers::internal_error;
use crate::routes::AppState;

#[derive(Debug, Clone, Serialize)]
pub struct EdgeTypedFlowResponse {
    pub direction: String,
    pub domain_ids: Vec<Uuid>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpsertEdgeTypedFlowsRequest {
    pub flows: Vec<UpsertEdgeTypedFlow>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpsertEdgeTypedFlow {
    pub direction: String,
    pub domain_ids: Vec<Uuid>,
}

pub async fn get_edge_typed_flows(
    State(state): State<AppState>,
    Path(edge_id): Path<Uuid>,
) -> Result<Json<Vec<EdgeTypedFlowResponse>>, (StatusCode, String)> {
    let rows = sqlx::query!(
        r#"
        SELECT
          f.direction::text AS direction,
          COALESCE(
            array_agg(d.domain_id ORDER BY d.domain_id)
              FILTER (WHERE d.domain_id IS NOT NULL),
            ARRAY[]::uuid[]
          ) AS domain_ids
        FROM edge_typed_flows f
        LEFT JOIN edge_typed_flow_domains d ON d.flow_id = f.id
        WHERE f.edge_id = $1
        GROUP BY f.direction
        ORDER BY f.direction
        "#,
        edge_id
    )
    .fetch_all(&state.pool)
    .await
    .map_err(internal_error)?;

    let out = rows
        .into_iter()
        .map(|r| EdgeTypedFlowResponse {
            direction: r.direction.unwrap_or_else(|| "fran".to_string()),
            domain_ids: r.domain_ids.unwrap_or_default(),
        })
        .collect();

    Ok(Json(out))
}

pub async fn put_edge_typed_flows(
    State(state): State<AppState>,
    Path(edge_id): Path<Uuid>,
    Json(payload): Json<UpsertEdgeTypedFlowsRequest>,
) -> Result<StatusCode, (StatusCode, String)> {
    fn valid_direction(s: &str) -> bool {
        matches!(s, "fran" | "till" | "bidirectional")
    }

    for f in &payload.flows {
        if !valid_direction(f.direction.as_str()) {
            return Err((
                StatusCode::BAD_REQUEST,
                "Ogiltig riktning (måste vara fran, till eller bidirectional)".into(),
            ));
        }
    }

    let mut tx = state.pool.begin().await.map_err(internal_error)?;

    sqlx::query(
        r#"
        DELETE FROM edge_typed_flows
        WHERE edge_id = $1
        "#,
    )
    .bind(edge_id)
    .execute(&mut *tx)
    .await
    .map_err(internal_error)?;

    for f in payload.flows {
        if f.domain_ids.is_empty() {
            continue;
        }

        let flow_id: Uuid = sqlx::query_scalar(
            r#"
            INSERT INTO edge_typed_flows (edge_id, direction)
            VALUES ($1, $2::flow_direction)
            RETURNING id
            "#,
        )
        .bind(edge_id)
        .bind(f.direction)
        .fetch_one(&mut *tx)
        .await
        .map_err(internal_error)?;

        for domain_id in f.domain_ids {
            sqlx::query(
                r#"
                INSERT INTO edge_typed_flow_domains (flow_id, domain_id)
                VALUES ($1, $2)
                ON CONFLICT DO NOTHING
                "#,
            )
            .bind(flow_id)
            .bind(domain_id)
            .execute(&mut *tx)
            .await
            .map_err(internal_error)?;
        }
    }

    tx.commit().await.map_err(internal_error)?;
    Ok(StatusCode::NO_CONTENT)
}
