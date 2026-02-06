use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct EdgeClaimEvidence {
    pub id: Uuid,
    pub claim_id: Uuid,
    pub evidence_type: String,
    pub reference: String,
    pub note: Option<String>,
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NewEdgeClaimEvidence {
    pub evidence_type: String,
    pub reference: String,
    pub note: Option<String>,
}
