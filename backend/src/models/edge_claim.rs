use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct EdgeClaim {
    pub id: Uuid,
    pub edge_id: Uuid,

    #[sqlx(default)]
    pub import_batch_id: Option<Uuid>,

    pub source: String,
    pub confidence: i16,
    pub status: String,
    pub created_by: String,
    pub created_at: OffsetDateTime,

    #[sqlx(default)]
    pub updated_at: Option<OffsetDateTime>,

    pub last_verified_at: Option<OffsetDateTime>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NewEdgeClaim {
    pub source: String,
    pub confidence: i16,
    #[serde(default = "default_claim_status")]
    pub status: String,
}

fn default_claim_status() -> String {
    "active".to_string()
}
