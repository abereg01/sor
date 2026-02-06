use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EdgeKind {
    DependsOn,
    RunsOn,
    StoresData,
    FlowsTo,
    OwnedBy,
    BacksUpTo,
    Exposes,
    ExposesPort,
    ExternalDependency,
}

impl EdgeKind {
    pub fn as_str(self) -> &'static str {
        match self {
            EdgeKind::DependsOn => "depends_on",
            EdgeKind::RunsOn => "runs_on",
            EdgeKind::StoresData => "stores_data",
            EdgeKind::FlowsTo => "flows_to",
            EdgeKind::OwnedBy => "owned_by",
            EdgeKind::BacksUpTo => "backs_up_to",
            EdgeKind::Exposes => "exposes",
            EdgeKind::ExposesPort => "exposes_port",
            EdgeKind::ExternalDependency => "external_dependency",
        }
    }
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct Edge {
    pub id: Uuid,
    pub from_id: Uuid,
    pub to_id: Uuid,
    pub kind: String,
    pub metadata: serde_json::Value,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NewEdge {
    pub from_id: Uuid,
    pub to_id: Uuid,
    pub kind: EdgeKind,
    #[serde(default)]
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateEdge {
    pub kind: Option<EdgeKind>,
    pub metadata: Option<serde_json::Value>,
}
