use std::collections::HashMap;
use uuid::Uuid;

use axum::http::StatusCode;

use crate::models::edge_claim_evidence::EdgeClaimEvidence;

use super::helpers::internal_error;

pub async fn load_evidence_map_for_claim_ids(
    pool: &sqlx::PgPool,
    claim_ids: &[Uuid],
) -> Result<HashMap<Uuid, Vec<EdgeClaimEvidence>>, (StatusCode, String)> {
    if claim_ids.is_empty() {
        return Ok(HashMap::new());
    }

    let rows = sqlx::query_as::<_, EdgeClaimEvidence>(
        r#"
        SELECT id, claim_id, evidence_type, reference, note, created_at
        FROM edge_claim_evidence
        WHERE claim_id = ANY($1)
        ORDER BY created_at ASC
        "#,
    )
    .bind(claim_ids)
    .fetch_all(pool)
    .await
    .map_err(internal_error)?;

    let mut map: HashMap<Uuid, Vec<EdgeClaimEvidence>> = HashMap::new();
    for r in rows {
        map.entry(r.claim_id).or_default().push(r);
    }

    Ok(map)
}

pub async fn load_evidence_for_claim_id(
    pool: &sqlx::PgPool,
    claim_id: Uuid,
) -> Result<Vec<EdgeClaimEvidence>, (StatusCode, String)> {
    let rows = sqlx::query_as::<_, EdgeClaimEvidence>(
        r#"
        SELECT id, claim_id, evidence_type, reference, note, created_at
        FROM edge_claim_evidence
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
