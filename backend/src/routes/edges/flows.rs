use std::collections::HashMap;

use axum::http::StatusCode;
use uuid::Uuid;

use crate::models::edge_claim_flow::EdgeClaimFlow;

use super::helpers::internal_error;

pub async fn load_flow_map_for_claim_ids(
    pool: &sqlx::PgPool,
    claim_ids: &[Uuid],
) -> Result<HashMap<Uuid, Vec<EdgeClaimFlow>>, (StatusCode, String)> {
    if claim_ids.is_empty() {
        return Ok(HashMap::new());
    }

    let rows: Vec<EdgeClaimFlow> = sqlx::query_as::<_, EdgeClaimFlow>(
        r#"
        SELECT
            id,
            claim_id,
            flow_type,
            direction,
            data_category_id,
            protocol,
            frequency,
            created_at
        FROM edge_claim_flows
        WHERE claim_id = ANY($1)
        ORDER BY created_at ASC
        "#,
    )
    .bind(claim_ids)
    .fetch_all(pool)
    .await
    .map_err(internal_error)?;

    let mut map: HashMap<Uuid, Vec<EdgeClaimFlow>> = HashMap::new();
    for row in rows {
        map.entry(row.claim_id).or_default().push(row);
    }

    Ok(map)
}

pub async fn load_flows_for_claim_id(
    pool: &sqlx::PgPool,
    claim_id: Uuid,
) -> Result<Vec<EdgeClaimFlow>, (StatusCode, String)> {
    let rows: Vec<EdgeClaimFlow> = sqlx::query_as::<_, EdgeClaimFlow>(
        r#"
        SELECT
            id,
            claim_id,
            flow_type,
            direction,
            data_category_id,
            protocol,
            frequency,
            created_at
        FROM edge_claim_flows
        WHERE claim_id = $1
        ORDER BY created_at ASC
        "#,
    )
    .bind(claim_id)
    .fetch_all(pool)
    .await
    .map_err(internal_error)?;

    Ok(rows)
}
