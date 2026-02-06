use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use rust_xlsxwriter::XlsxError;
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;
use uuid::Uuid;

pub fn csv_escape(s: &str) -> String {
    let needs_quotes = s.contains(',') || s.contains('"') || s.contains('\n') || s.contains('\r');
    if !needs_quotes {
        return s.to_string();
    }
    let escaped = s.replace('"', "\"\"");
    format!("\"{}\"", escaped)
}

pub fn csv_opt(s: &Option<String>) -> String {
    match s {
        Some(v) => csv_escape(v),
        None => "".to_string(),
    }
}

pub fn csv_opt_uuid(u: &Option<Uuid>) -> String {
    match u {
        Some(v) => v.to_string(),
        None => "".to_string(),
    }
}

pub fn csv_opt_time(t: &Option<OffsetDateTime>) -> String {
    match t {
        Some(v) => v.format(&Rfc3339).unwrap_or_default(),
        None => "".to_string(),
    }
}

pub fn csv_headers_csv() -> HeaderMap {
    let mut h = HeaderMap::new();
    h.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("text/csv; charset=utf-8"),
    );
    h
}

pub fn xlsx_error(e: XlsxError) -> (StatusCode, String) {
    (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
}

pub fn db_error<E: std::fmt::Display>(e: E) -> (StatusCode, String) {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        format!("error returned from database: {e}"),
    )
}

pub fn set_width_range(
    ws: &mut rust_xlsxwriter::Worksheet,
    first_col: u16,
    last_col: u16,
    width: f64,
) -> Result<(), XlsxError> {
    for c in first_col..=last_col {
        ws.set_column_width(c, width)?;
    }
    Ok(())
}

pub fn meta_str(meta: &serde_json::Value, keys: &[&str]) -> Option<String> {
    let obj = meta.as_object()?;
    for k in keys {
        if let Some(v) = obj.get(*k) {
            if v.is_null() {
                continue;
            }
            if let Some(s) = v.as_str() {
                if !s.trim().is_empty() {
                    return Some(s.to_string());
                }
            } else if let Some(b) = v.as_bool() {
                return Some(if b {
                    "Ja".to_string()
                } else {
                    "Nej".to_string()
                });
            } else if let Some(n) = v.as_i64() {
                return Some(n.to_string());
            } else if let Some(f) = v.as_f64() {
                return Some(f.to_string());
            } else {
                return Some(v.to_string());
            }
        }
    }
    None
}

pub fn meta_env(meta: &serde_json::Value) -> String {
    meta_str(meta, &["miljö", "miljo", "env", "environment"]).unwrap_or_default()
}
pub fn meta_os(meta: &serde_json::Value) -> String {
    meta_str(meta, &["os", "operating_system"]).unwrap_or_default()
}
pub fn meta_owner(meta: &serde_json::Value) -> String {
    meta_str(meta, &["ägare", "agare", "owner"]).unwrap_or_default()
}
pub fn meta_role(meta: &serde_json::Value) -> String {
    meta_str(meta, &["roll", "role"]).unwrap_or_default()
}
pub fn meta_critical(meta: &serde_json::Value) -> String {
    meta_str(meta, &["kritisk", "critical", "is_critical"]).unwrap_or_default()
}
pub fn meta_sla(meta: &serde_json::Value) -> String {
    meta_str(meta, &["sla", "SLA"]).unwrap_or_default()
}

use base64::Engine;
use serde::Deserialize;

use super::filter_spec::FilterSpec;

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EdgeScope {
    Both,
    Any,
}

impl Default for EdgeScope {
    fn default() -> Self {
        Self::Both
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct ExportRequest {
    #[serde(default)]
    pub f: Option<String>,

    #[serde(default)]
    pub include_edges: Option<bool>,
    #[serde(default)]
    pub include_claims: Option<bool>,
    #[serde(default)]
    pub include_flows: Option<bool>,

    #[serde(default)]
    pub edge_scope: Option<EdgeScope>,
}

impl ExportRequest {
    pub fn include_edges(&self) -> bool {
        self.include_edges.unwrap_or(true)
    }

    pub fn include_claims(&self) -> bool {
        self.include_claims.unwrap_or(true)
    }

    pub fn include_flows(&self) -> bool {
        self.include_flows.unwrap_or(true)
    }

    pub fn edge_scope(&self) -> EdgeScope {
        self.edge_scope.unwrap_or_default()
    }

    pub fn filter_spec(&self) -> Result<FilterSpec, String> {
        if let Some(f) = &self.f {
            if f.trim().is_empty() {
                return Ok(FilterSpec::default());
            }
            decode_filter_spec(f)
        } else {
            Ok(FilterSpec::default())
        }
    }
}

pub fn decode_filter_spec(encoded: &str) -> Result<FilterSpec, String> {
    let bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(encoded.as_bytes())
        .map_err(|e| format!("invalid filter encoding: {e}"))?;

    let s = String::from_utf8(bytes).map_err(|e| format!("invalid filter utf8: {e}"))?;
    serde_json::from_str::<FilterSpec>(&s).map_err(|e| format!("invalid filter json: {e}"))
}
