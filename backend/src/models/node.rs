use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NodeKind {
    System,
    Service,
    Database,
    Host,
    Vendor,
    Team,
    DataCategory,
    App,
    Container,
    ExternalDependency,
}

impl NodeKind {
    pub fn as_str(self) -> &'static str {
        match self {
            NodeKind::System => "system",
            NodeKind::Service => "service",
            NodeKind::Database => "database",
            NodeKind::Host => "host",
            NodeKind::Vendor => "vendor",
            NodeKind::Team => "team",
            NodeKind::DataCategory => "data_category",
            NodeKind::App => "app",
            NodeKind::Container => "container",
            NodeKind::ExternalDependency => "external_dependency",
        }
    }
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct Node {
    pub id: Uuid,
    pub kind: String,
    pub name: String,
    pub metadata: serde_json::Value,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
    pub deleted_at: Option<OffsetDateTime>,
    pub deleted_by: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NewNode {
    pub kind: NodeKind,
    pub name: String,
    #[serde(default)]
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateNode {
    pub kind: Option<NodeKind>,
    pub name: Option<String>,
    pub metadata: Option<serde_json::Value>,
}
