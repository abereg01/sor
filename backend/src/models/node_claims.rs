use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct NodeClaim {
    pub id: Uuid,
    pub node_id: Uuid,

    pub source: String,
    pub confidence: i16,

    pub status: String,
    pub created_by: String,

    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,

    pub last_verified_at: Option<OffsetDateTime>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NewNodeClaim {
    pub source: String,
    pub confidence: i16,
    #[serde(default = "default_claim_status")]
    pub status: String,
}

fn default_claim_status() -> String {
    "active".to_string()
}
