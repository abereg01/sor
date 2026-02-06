use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewEdgeClaimFlow {
    pub flow_type: String,
    #[serde(default)]
    pub direction: Option<String>,
    pub data_category_id: Option<Uuid>,
    pub protocol: Option<String>,
    pub frequency: Option<String>,
}
