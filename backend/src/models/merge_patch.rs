use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct MergePatch(pub serde_json::Value);
