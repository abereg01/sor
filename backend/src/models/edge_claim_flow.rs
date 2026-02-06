use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct EdgeClaimFlow {
    pub id: Uuid,
    pub claim_id: Uuid,
    pub flow_type: String,
    pub direction: String,
    pub data_category_id: Option<Uuid>,
    pub protocol: Option<String>,
    pub frequency: Option<String>,
    pub created_at: OffsetDateTime,
}
