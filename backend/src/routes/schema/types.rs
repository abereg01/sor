use serde::Serialize;

#[derive(Serialize)]
pub struct RecommendedKey {
    pub key: String,
    pub description: Option<String>,
    pub examples: Option<Vec<String>>,
}

#[derive(Serialize)]
#[serde(rename_all = "snake_case")]
pub enum UiInputType {
    Text,
    Textarea,
    Toggle,
    Select,
}

#[derive(Serialize)]
pub struct UiFieldHint {
    pub key: String,
    pub label_sv: String,
    pub input: UiInputType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub placeholder_sv: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub help_sv: Option<String>,
}

#[derive(Serialize)]
pub struct NodeKindInfo {
    pub kind: String,
    pub recommended_metadata_keys: Vec<RecommendedKey>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ui_hints: Option<Vec<UiFieldHint>>,
}

#[derive(Serialize)]
pub struct EdgeKindInfo {
    pub kind: String,
    pub recommended_metadata_keys: Vec<RecommendedKey>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ui_hints: Option<Vec<UiFieldHint>>,
}

#[derive(Serialize)]
pub struct KindsResponse {
    pub node_kinds: Vec<NodeKindInfo>,
    pub edge_kinds: Vec<EdgeKindInfo>,
}
