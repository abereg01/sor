use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::post,
    Extension, Json, Router,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    audit::{self, AuditAction, EntityType, RequestContext},
    auth::AuthActor,
    models::{
        edge::Edge,
        edge_claim::EdgeClaim,
        edge_claim_evidence::{EdgeClaimEvidence, NewEdgeClaimEvidence},
        edge_claim_flow::EdgeClaimFlow,
        new_edge_claim_flow::NewEdgeClaimFlow,
    },
    routes::AppState,
};

use crate::routes::edges::{
    evidence::load_evidence_map_for_claim_ids,
    flows::load_flow_map_for_claim_ids,
    helpers::{internal_error, map_sqlx_error},
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", post(create_import).get(list_imports))
        .route("/:id/proposals", post(create_proposals).get(list_proposals))
}

type JsonObj = serde_json::Value;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct ImportBatch {
    pub id: Uuid,
    pub source: String,
    pub created_by: String,
    pub started_at: time::OffsetDateTime,
    pub finished_at: Option<time::OffsetDateTime>,
    pub metadata: Option<JsonObj>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NewImportBatch {
    pub source: String,
    #[serde(default)]
    pub metadata: Option<JsonObj>,
}

#[derive(Serialize)]
pub struct ImportBatchSummary {
    pub id: Uuid,
    pub source: String,
    pub created_by: String,
    pub started_at: time::OffsetDateTime,
    pub finished_at: Option<time::OffsetDateTime>,
    pub metadata: Option<JsonObj>,
    pub open_proposals: i64,
}

#[derive(Serialize)]
pub struct EdgeClaimWithDetails {
    pub claim: EdgeClaim,
    pub evidence: Vec<EdgeClaimEvidence>,
    pub flows: Vec<EdgeClaimFlow>,
}

#[derive(Serialize)]
pub struct ProposalItem {
    pub edge: Edge,
    pub claim: EdgeClaimWithDetails,
}

#[derive(Deserialize)]
pub struct CreateProposalsBody {
    pub edges: Vec<ProposalEdgeInput>,
}

#[derive(Deserialize)]
pub struct ProposalEdgeInput {
    pub from_id: Uuid,
    pub to_id: Uuid,
    pub kind: String,

    pub source: String,
    pub confidence: Option<i16>,

    pub evidence: Option<Vec<NewEdgeClaimEvidence>>,
    pub flows: Option<Vec<NewEdgeClaimFlow>>,
}

#[derive(sqlx::FromRow)]
struct ImportBatchSummaryRow {
    pub id: Uuid,
    pub source: String,
    pub created_by: String,
    pub started_at: time::OffsetDateTime,
    pub finished_at: Option<time::OffsetDateTime>,
    pub metadata: Option<JsonObj>,
    pub open_proposals: i64,
}

pub async fn list_imports(
    State(state): State<AppState>,
) -> Result<Json<Vec<ImportBatchSummary>>, (StatusCode, String)> {
    let rows: Vec<ImportBatchSummaryRow> = sqlx::query_as(
        r#"
        SELECT
            b.id,
            b.source,
            b.created_by,
            b.started_at,
            b.finished_at,
            b.metadata,
            COALESCE((
                SELECT COUNT(*)
                FROM edge_claims c
                WHERE c.import_batch_id = b.id
                  AND c.status = 'needs_review'
            ), 0) AS open_proposals
        FROM import_batches b
        ORDER BY b.started_at DESC
        "#,
    )
    .fetch_all(&state.pool)
    .await
    .map_err(internal_error)?;

    let out = rows
        .into_iter()
        .map(|r| ImportBatchSummary {
            id: r.id,
            source: r.source,
            created_by: r.created_by,
            started_at: r.started_at,
            finished_at: r.finished_at,
            metadata: r.metadata,
            open_proposals: r.open_proposals,
        })
        .collect();

    Ok(Json(out))
}

pub async fn create_import(
    State(state): State<AppState>,
    Extension(ctx): Extension<RequestContext>,
    Json(body): Json<NewImportBatch>,
) -> Result<Json<ImportBatch>, (StatusCode, String)> {
    let batch_id = Uuid::new_v4();

    let batch: ImportBatch = sqlx::query_as(
        r#"
        INSERT INTO import_batches (
            id,
            source,
            created_by,
            metadata
        )
        VALUES ($1, $2, $3, $4)
        RETURNING
            id,
            source,
            created_by,
            started_at,
            finished_at,
            metadata
        "#,
    )
    .bind(batch_id)
    .bind(body.source)
    .bind(ctx.request_id.to_string())
    .bind(body.metadata)
    .fetch_one(&state.pool)
    .await
    .map_err(map_sqlx_error)?;

    Ok(Json(batch))
}

pub async fn create_proposals(
    State(state): State<AppState>,
    Extension(ctx): Extension<RequestContext>,
    Extension(actor): Extension<AuthActor>,
    Path(batch_id): Path<Uuid>,
    Json(body): Json<CreateProposalsBody>,
) -> Result<Json<Vec<ProposalItem>>, (StatusCode, String)> {
    let mut tx = state.pool.begin().await.map_err(internal_error)?;

    let _: ImportBatch = sqlx::query_as(
        r#"
        SELECT
            id, source, created_by, started_at, finished_at, metadata
        FROM import_batches
        WHERE id = $1
        "#,
    )
    .bind(batch_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(map_sqlx_error)?;

    let mut created_edges: Vec<Edge> = Vec::new();
    let mut created_claims: Vec<EdgeClaim> = Vec::new();

    for item in body.edges {
        let edge: Edge = sqlx::query_as(
            r#"
            INSERT INTO edges (from_id, to_id, kind, metadata)
            VALUES ($1, $2, $3, '{}'::jsonb)
            ON CONFLICT (from_id, to_id, kind) DO UPDATE
              SET updated_at = now()
            RETURNING
              id, from_id, to_id, kind, metadata, created_at, updated_at
            "#,
        )
        .bind(item.from_id)
        .bind(item.to_id)
        .bind(item.kind)
        .fetch_one(&mut *tx)
        .await
        .map_err(map_sqlx_error)?;

        let claim: EdgeClaim = sqlx::query_as(
            r#"
            INSERT INTO edge_claims (
              edge_id,
              import_batch_id,
              source,
              confidence,
              status,
              created_by
            )
            VALUES ($1, $2, $3, $4, 'needs_review', $5)
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
        .bind(edge.id)
        .bind(batch_id)
        .bind(item.source)
        .bind(item.confidence.unwrap_or(70))
        .bind(ctx.request_id.to_string())
        .fetch_one(&mut *tx)
        .await
        .map_err(map_sqlx_error)?;

        if let Some(evs) = item.evidence {
            for ev in evs {
                let _e: EdgeClaimEvidence = sqlx::query_as(
                    r#"
                    INSERT INTO edge_claim_evidence (claim_id, evidence_type, reference, note)
                    VALUES ($1, $2, $3, $4)
                    RETURNING id, claim_id, evidence_type, reference, note, created_at
                    "#,
                )
                .bind(claim.id)
                .bind(ev.evidence_type)
                .bind(ev.reference)
                .bind(ev.note)
                .fetch_one(&mut *tx)
                .await
                .map_err(map_sqlx_error)?;
            }
        }

        if let Some(flows) = item.flows {
            for f in flows {
                let _f: EdgeClaimFlow = sqlx::query_as(
                    r#"
                    INSERT INTO edge_claim_flows (claim_id, flow_type, data_category_id, protocol, frequency)
                    VALUES ($1, $2, $3, $4, $5)
                    RETURNING id, claim_id, flow_type, data_category_id, protocol, frequency, created_at
                    "#,
                )
                .bind(claim.id)
                .bind(f.flow_type)
                .bind(f.data_category_id)
                .bind(f.protocol)
                .bind(f.frequency)
                .fetch_one(&mut *tx)
                .await
                .map_err(map_sqlx_error)?;
            }
        }

        audit::write_audit(
            &mut *tx,
            ctx.clone(),
            Some(&actor),
            EntityType::Edge,
            edge.id,
            AuditAction::Patch,
            None,
            Some(serde_json::json!({
                "import_batch_id": batch_id,
                "action": "proposal_created",
                "claim_id": claim.id
            })),
            None,
        )
        .await
        .map_err(internal_error)?;

        created_edges.push(edge);
        created_claims.push(claim);
    }

    tx.commit().await.map_err(internal_error)?;

    if created_claims.is_empty() {
        return Ok(Json(Vec::new()));
    }

    let claim_ids: Vec<Uuid> = created_claims.iter().map(|c| c.id).collect();
    let evidence_map = load_evidence_map_for_claim_ids(&state.pool, &claim_ids).await?;
    let flow_map = load_flow_map_for_claim_ids(&state.pool, &claim_ids).await?;

    let mut edge_by_id: std::collections::HashMap<Uuid, Edge> = std::collections::HashMap::new();
    for e in created_edges {
        edge_by_id.insert(e.id, e);
    }

    let mut out: Vec<ProposalItem> = Vec::new();
    for c in created_claims {
        let edge = edge_by_id
            .get(&c.edge_id)
            .cloned()
            .ok_or((StatusCode::INTERNAL_SERVER_ERROR, "Edge saknas".into()))?;

        out.push(ProposalItem {
            edge,
            claim: EdgeClaimWithDetails {
                evidence: evidence_map.get(&c.id).cloned().unwrap_or_default(),
                flows: flow_map.get(&c.id).cloned().unwrap_or_default(),
                claim: c,
            },
        });
    }

    Ok(Json(out))
}

pub async fn list_proposals(
    State(state): State<AppState>,
    Path(batch_id): Path<Uuid>,
) -> Result<Json<Vec<ProposalItem>>, (StatusCode, String)> {
    #[derive(sqlx::FromRow)]
    struct ProposalRow {
        e_id: Uuid,
        e_from_id: Uuid,
        e_to_id: Uuid,
        e_kind: String,
        e_metadata: serde_json::Value,
        e_created_at: time::OffsetDateTime,
        e_updated_at: time::OffsetDateTime,

        c_id: Uuid,
        c_edge_id: Uuid,
        c_import_batch_id: Option<Uuid>,
        c_source: String,
        c_confidence: i16,
        c_status: String,
        c_created_by: String,
        c_created_at: time::OffsetDateTime,
        c_updated_at: time::OffsetDateTime,
        c_last_verified_at: Option<time::OffsetDateTime>,
    }

    let rows: Vec<ProposalRow> = sqlx::query_as(
        r#"
        SELECT
          e.id          AS e_id,
          e.from_id     AS e_from_id,
          e.to_id       AS e_to_id,
          e.kind        AS e_kind,
          e.metadata    AS e_metadata,
          e.created_at  AS e_created_at,
          e.updated_at  AS e_updated_at,

          c.id               AS c_id,
          c.edge_id          AS c_edge_id,
          c.import_batch_id  AS c_import_batch_id,
          c.source           AS c_source,
          c.confidence       AS c_confidence,
          c.status           AS c_status,
          c.created_by       AS c_created_by,
          c.created_at       AS c_created_at,
          c.updated_at       AS c_updated_at,
          c.last_verified_at AS c_last_verified_at
        FROM edge_claims c
        JOIN edges e ON e.id = c.edge_id
        WHERE c.import_batch_id = $1
          AND c.status = 'needs_review'
        ORDER BY c.created_at DESC
        "#,
    )
    .bind(batch_id)
    .fetch_all(&state.pool)
    .await
    .map_err(internal_error)?;

    let claim_ids: Vec<Uuid> = rows.iter().map(|r| r.c_id).collect();
    let evidence_map = load_evidence_map_for_claim_ids(&state.pool, &claim_ids).await?;
    let flow_map = load_flow_map_for_claim_ids(&state.pool, &claim_ids).await?;

    let mut out: Vec<ProposalItem> = Vec::new();

    for r in rows {
        let edge = Edge {
            id: r.e_id,
            from_id: r.e_from_id,
            to_id: r.e_to_id,
            kind: r.e_kind,
            metadata: r.e_metadata,
            created_at: r.e_created_at,
            updated_at: r.e_updated_at,
        };

        let claim = EdgeClaim {
            id: r.c_id,
            edge_id: r.c_edge_id,
            import_batch_id: r.c_import_batch_id,
            source: r.c_source,
            confidence: r.c_confidence,
            status: r.c_status,
            created_by: r.c_created_by,
            created_at: r.c_created_at,
            updated_at: Some(r.c_updated_at),
            last_verified_at: r.c_last_verified_at,
        };

        out.push(ProposalItem {
            edge,
            claim: EdgeClaimWithDetails {
                claim: claim.clone(),
                evidence: evidence_map.get(&claim.id).cloned().unwrap_or_default(),
                flows: flow_map.get(&claim.id).cloned().unwrap_or_default(),
            },
        });
    }

    Ok(Json(out))
}
