use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ValidationSeverity {
    Warning,
    NeedsReview,
}

#[derive(Debug, Clone, Serialize)]
pub struct ValidationIssue {
    pub code: String,
    pub severity: ValidationSeverity,
    pub message_sv: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ValidationResult {
    pub profile: String,
    pub version: i32,
    pub issues: Vec<ValidationIssue>,
    pub needs_review: bool,
}

fn push(
    out: &mut Vec<ValidationIssue>,
    code: &str,
    severity: ValidationSeverity,
    message_sv: &str,
) {
    out.push(ValidationIssue {
        code: code.into(),
        severity,
        message_sv: message_sv.into(),
    });
}

fn get_str<'a>(v: &'a serde_json::Value, key: &str) -> Option<&'a str> {
    v.get(key)
        .and_then(|x| x.as_str())
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
}

fn get_bool(v: &serde_json::Value, key: &str) -> Option<bool> {
    v.get(key).and_then(|x| x.as_bool())
}

pub fn validate_edge_metadata(
    kind: &str,
    metadata: &serde_json::Value,
) -> Option<ValidationResult> {
    let version = 1;
    let mut issues: Vec<ValidationIssue> = Vec::new();

    match kind {
        "flows_to" => {
            let flow_type = get_str(metadata, "flow_type");
            if flow_type.is_none() {
                push(
                    &mut issues,
                    "flows_to.missing_flow_type",
                    ValidationSeverity::Warning,
                    "Saknar 'flow_type' (Typ av flöde).",
                );
            }

            let protocol = get_str(metadata, "protocol");
            if protocol.is_none() {
                push(
                    &mut issues,
                    "flows_to.missing_protocol",
                    ValidationSeverity::Warning,
                    "Saknar 'protocol' (Protokoll).",
                );
            }

            let frequency = get_str(metadata, "frequency");
            if frequency.is_none() {
                push(
                    &mut issues,
                    "flows_to.missing_frequency",
                    ValidationSeverity::Warning,
                    "Saknar 'frequency' (Frekvens).",
                );
            }

            if get_bool(metadata, "contains_pii").is_none() {
                push(
                    &mut issues,
                    "flows_to.missing_contains_pii",
                    ValidationSeverity::NeedsReview,
                    "Saknar 'contains_pii' (Personuppgifter). För flöden behöver vi veta om PII förekommer.",
                );
            }
        }
        "stores_data" => {
            if get_str(metadata, "data_type").is_none() {
                push(
                    &mut issues,
                    "stores_data.missing_data_type",
                    ValidationSeverity::Warning,
                    "Saknar 'data_type' (Datatyp).",
                );
            }
            if get_bool(metadata, "contains_pii").is_none() {
                push(
                    &mut issues,
                    "stores_data.missing_contains_pii",
                    ValidationSeverity::NeedsReview,
                    "Saknar 'contains_pii' (Personuppgifter). För lagring behöver vi veta om PII förekommer.",
                );
            }
        }
        "runs_on" => {
            if get_str(metadata, "runtime").is_none() {
                push(
                    &mut issues,
                    "runs_on.missing_runtime",
                    ValidationSeverity::Warning,
                    "Saknar 'runtime' (t.ex. Docker, VM, k8s).",
                );
            }
        }
        _ => return None,
    }

    let needs_review = issues
        .iter()
        .any(|i| matches!(i.severity, ValidationSeverity::NeedsReview));

    Some(ValidationResult {
        profile: kind.into(),
        version,
        issues,
        needs_review,
    })
}
