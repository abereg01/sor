use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct LookupQuery {
    pub q: Option<String>,
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct LookupItem {
    pub id: Uuid,
    pub name: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct NodeDetailsResponse {
    pub node: NodeCore,
    pub suppliers: Vec<Party>,
    pub owners: Vec<Party>,
    pub supplier_types: Vec<String>,
    pub software: Option<NodeSoftware>,
    pub risk: Option<NodeRisk>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct NodeCore {
    pub id: Uuid,
    pub kind: String,
    pub name: String,
    pub metadata: serde_json::Value,
    pub owning_department: Option<String>,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Party {
    pub id: Uuid,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct NodeSoftware {
    pub software_name: Option<String>,
    pub purpose: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct NodeRisk {
    pub legal_requirements: Option<bool>,
    pub financial_value: Option<bool>,
    pub pii: Option<bool>,
    pub business_criticality: Option<String>,
    pub information_class: Option<String>,
    pub criticality_score: Option<f64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PutNodeDetailsRequest {
    pub owning_department: Option<String>,
    pub supplier_types: Option<Vec<String>>,
    pub suppliers: Option<Vec<String>>,
    pub owners: Option<Vec<String>>,
    pub metadata: Option<serde_json::Value>,
    pub software: Option<PutNodeSoftware>,
    pub risk: Option<PutNodeRisk>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PutNodeSoftware {
    pub software_name: Option<String>,
    pub purpose: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PutNodeRisk {
    pub legal_requirements: Option<bool>,
    pub financial_value: Option<bool>,
    pub pii: Option<bool>,
    pub business_criticality: Option<String>,
    pub information_class: Option<String>,
    pub criticality_score: Option<f64>,
}
