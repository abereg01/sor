use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use uuid::Uuid;

use crate::{
    models::{
        edge::Edge, edge_claim::EdgeClaim, edge_claim_evidence::EdgeClaimEvidence,
        edge_claim_flow::EdgeClaimFlow,
    },
    routes::{etag_from_updated_at, AppState},
};

use super::{
    evidence::load_evidence_for_claim_id, flows::load_flows_for_claim_id, helpers::internal_error,
};

#[derive(serde::Serialize)]
pub struct EdgeClaimWithDetails {
    #[serde(flatten)]
    pub claim: EdgeClaim,
    pub evidence: Vec<EdgeClaimEvidence>,
    pub flows: Vec<EdgeClaimFlow>,
}

#[derive(serde::Serialize)]
pub struct EdgeWithClaim {
    #[serde(flatten)]
    pub edge: Edge,
    pub current_claim: Option<EdgeClaimWithDetails>,
}

pub async fn get_edge(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<(HeaderMap, Json<EdgeWithClaim>), (StatusCode, String)> {
    let edge = sqlx::query_as::<_, Edge>(
        r#"
        SELECT
            id,
            from_id,
            to_id,
            kind,
            metadata,
            created_at,
            updated_at
        FROM edges
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    .map_err(internal_error)?
    .ok_or((StatusCode::NOT_FOUND, "Objektet finns inte längre".into()))?;

    let claim = sqlx::query_as::<_, EdgeClaim>(
        r#"
        SELECT
            id,
            edge_id,
            source,
            confidence,
            status,
            created_by,
            created_at,
            last_verified_at
        FROM edge_claims
        WHERE edge_id = $1
          AND status IN ('active', 'needs_review')
        "#,
    )
    .bind(edge.id)
    .fetch_optional(&state.pool)
    .await
    .map_err(internal_error)?;

    let current_claim = if let Some(c) = claim {
        let evidence = load_evidence_for_claim_id(&state.pool, c.id).await?;

        let mut flows = load_flows_for_claim_id(&state.pool, c.id).await?;

        if flows.is_empty() {
            flows.push(EdgeClaimFlow {
                id: Uuid::nil(),
                claim_id: c.id,
                flow_type: "data_flow".to_string(),
                direction: "source_to_target".to_string(),
                data_category_id: None,
                protocol: None,
                frequency: Some("continuous".to_string()),
                created_at: edge.created_at,
            });
        }

        Some(EdgeClaimWithDetails {
            claim: c,
            evidence,
            flows,
        })
    } else {
        None
    };

    let mut headers = HeaderMap::new();
    headers.insert(
        axum::http::header::ETAG,
        etag_from_updated_at(edge.updated_at),
    );

    Ok((
        headers,
        Json(EdgeWithClaim {
            edge,
            current_claim,
        }),
    ))
}
