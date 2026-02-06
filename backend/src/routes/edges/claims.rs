use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
};
use uuid::Uuid;

use crate::{
    audit::{self, AuditAction, EntityType, RequestContext},
    auth::AuthActor,
    models::{
        edge_claim::{EdgeClaim, NewEdgeClaim},
        edge_claim_evidence::{EdgeClaimEvidence, NewEdgeClaimEvidence},
        edge_claim_flow::EdgeClaimFlow,
        new_edge_claim_flow::NewEdgeClaimFlow,
    },
    routes::AppState,
};

use super::{
    evidence::load_evidence_map_for_claim_ids,
    flows::load_flow_map_for_claim_ids,
    helpers::{internal_error, map_sqlx_error},
};

#[derive(serde::Serialize)]
pub struct EdgeClaimWithDetails {
    #[serde(flatten)]
    pub claim: EdgeClaim,
    pub evidence: Vec<EdgeClaimEvidence>,
    pub flows: Vec<EdgeClaimFlow>,
}

#[derive(serde::Deserialize)]
pub struct CreateEdgeClaimRequest {
    #[serde(flatten)]
    pub claim: NewEdgeClaim,

    #[serde(default)]
    pub evidence: Vec<NewEdgeClaimEvidence>,

    #[serde(default)]
    pub flows: Vec<NewEdgeClaimFlow>,
}

pub async fn create_edge_claim(
    State(state): State<AppState>,
    Extension(ctx): Extension<RequestContext>,
    Extension(actor): Extension<AuthActor>,
    Path(edge_id): Path<Uuid>,
    Json(payload): Json<CreateEdgeClaimRequest>,
) -> Result<Json<EdgeClaimWithDetails>, (StatusCode, String)> {
    let mut tx = state.pool.begin().await.map_err(internal_error)?;

    let (exists,): (bool,) = sqlx::query_as("SELECT EXISTS(SELECT 1 FROM edges WHERE id = $1)")
        .bind(edge_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(internal_error)?;

    if !exists {
        return Err((StatusCode::NOT_FOUND, "Relationen finns inte".into()));
    }

    sqlx::query(
        r#"
        UPDATE edge_claims
        SET status = 'deprecated'
        WHERE edge_id = $1
          AND status IN ('active', 'needs_review')
        "#,
    )
    .bind(edge_id)
    .execute(&mut *tx)
    .await
    .map_err(internal_error)?;

    let claim = sqlx::query_as::<_, EdgeClaim>(
        r#"
        INSERT INTO edge_claims (
            edge_id, source, confidence, status, created_by
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING
            id,
            edge_id,
            import_batch_id,
            source,
            confidence,
            status,
            created_by,
            created_at,
            updated_at,
            last_verified_at
        "#,
    )
    .bind(edge_id)
    .bind(payload.claim.source)
    .bind(payload.claim.confidence)
    .bind(payload.claim.status)
    .bind(actor.username.clone())
    .fetch_one(&mut *tx)
    .await
    .map_err(map_sqlx_error)?;

    let mut evidence: Vec<EdgeClaimEvidence> = Vec::new();
    for ev in payload.evidence {
        let row = sqlx::query_as::<_, EdgeClaimEvidence>(
            r#"
            INSERT INTO edge_claim_evidence
                (claim_id, evidence_type, reference, note)
            VALUES ($1, $2, $3, $4)
            RETURNING
                id,
                claim_id,
                evidence_type,
                reference,
                note,
                created_at
            "#,
        )
        .bind(claim.id)
        .bind(ev.evidence_type)
        .bind(ev.reference)
        .bind(ev.note)
        .fetch_one(&mut *tx)
        .await
        .map_err(map_sqlx_error)?;

        evidence.push(row);
    }

    let mut flows: Vec<EdgeClaimFlow> = Vec::new();
    for f in payload.flows {
        let direction = f
            .direction
            .unwrap_or_else(|| "source_to_target".to_string());

        let row = sqlx::query_as::<_, EdgeClaimFlow>(
            r#"
            INSERT INTO edge_claim_flows
                (claim_id, flow_type, direction, data_category_id, protocol, frequency)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING
                id,
                claim_id,
                flow_type,
                direction,
                data_category_id,
                protocol,
                frequency,
                created_at
            "#,
        )
        .bind(claim.id)
        .bind(f.flow_type)
        .bind(direction)
        .bind(f.data_category_id)
        .bind(f.protocol)
        .bind(f.frequency)
        .fetch_one(&mut *tx)
        .await
        .map_err(map_sqlx_error)?;

        flows.push(row);
    }

    let out = EdgeClaimWithDetails {
        claim: claim.clone(),
        evidence,
        flows,
    };

    audit::write_audit(
        &mut *tx,
        ctx,
        Some(&actor),
        EntityType::Edge,
        edge_id,
        AuditAction::Create,
        None,
        None,
        serde_json::to_value(&out).ok(),
    )
    .await
    .map_err(internal_error)?;

    tx.commit().await.map_err(internal_error)?;

    Ok(Json(out))
}

pub async fn list_edge_claims(
    State(state): State<AppState>,
    Path(edge_id): Path<Uuid>,
) -> Result<Json<Vec<EdgeClaimWithDetails>>, (StatusCode, String)> {
    let claims = sqlx::query_as::<_, EdgeClaim>(
        r#"
        SELECT
            id,
            edge_id,
            import_batch_id,
            source,
            confidence,
            status,
            created_by,
            created_at,
            updated_at,
            last_verified_at
        FROM edge_claims
        WHERE edge_id = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(edge_id)
    .fetch_all(&state.pool)
    .await
    .map_err(internal_error)?;

    let claim_ids: Vec<Uuid> = claims.iter().map(|c| c.id).collect();

    let evidence_map = load_evidence_map_for_claim_ids(&state.pool, &claim_ids).await?;
    let flow_map = load_flow_map_for_claim_ids(&state.pool, &claim_ids).await?;

    let out = claims
        .into_iter()
        .map(|c| EdgeClaimWithDetails {
            evidence: evidence_map.get(&c.id).cloned().unwrap_or_default(),
            flows: flow_map.get(&c.id).cloned().unwrap_or_default(),
            claim: c,
        })
        .collect();

    Ok(Json(out))
}
