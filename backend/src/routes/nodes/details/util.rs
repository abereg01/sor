use axum::http::StatusCode;

pub fn is_valid_supplier_type(v: &str) -> bool {
    matches!(v.trim().to_lowercase().as_str(), "intern" | "saas" | "paas")
}

pub fn is_valid_business_criticality(v: &str) -> bool {
    matches!(v.trim().to_lowercase().as_str(), "low" | "medium" | "high")
}

pub fn is_valid_information_class(v: &str) -> bool {
    matches!(
        v.trim().to_lowercase().as_str(),
        "intern" | "begransad" | "skyddad" | "oppen" | "konfidentiell"
    )
}

pub fn trim_opt(v: Option<String>) -> Option<String> {
    let s = v?.trim().to_string();
    if s.is_empty() {
        None
    } else {
        Some(s)
    }
}

pub fn internal_error<E: std::fmt::Display>(e: E) -> (StatusCode, String) {
    (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
}
