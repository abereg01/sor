use super::types::{RecommendedKey, UiFieldHint, UiInputType};

pub fn rk(key: &str, description: Option<&str>, examples: Option<Vec<String>>) -> RecommendedKey {
    RecommendedKey {
        key: key.into(),
        description: description.map(|s| s.into()),
        examples,
    }
}

pub fn ui_text(
    key: &str,
    label_sv: &str,
    placeholder_sv: Option<String>,
    help_sv: Option<String>,
) -> UiFieldHint {
    UiFieldHint {
        key: key.into(),
        label_sv: label_sv.into(),
        input: UiInputType::Text,
        options: None,
        placeholder_sv,
        help_sv,
    }
}

pub fn ui_textarea(
    key: &str,
    label_sv: &str,
    placeholder_sv: Option<String>,
    help_sv: Option<String>,
) -> UiFieldHint {
    UiFieldHint {
        key: key.into(),
        label_sv: label_sv.into(),
        input: UiInputType::Textarea,
        options: None,
        placeholder_sv,
        help_sv,
    }
}

pub fn ui_toggle(key: &str, label_sv: &str, help_sv: Option<String>) -> UiFieldHint {
    UiFieldHint {
        key: key.into(),
        label_sv: label_sv.into(),
        input: UiInputType::Toggle,
        options: None,
        placeholder_sv: None,
        help_sv,
    }
}

pub fn ui_select(
    key: &str,
    label_sv: &str,
    options: Vec<String>,
    placeholder_sv: Option<String>,
    help_sv: Option<String>,
) -> UiFieldHint {
    UiFieldHint {
        key: key.into(),
        label_sv: label_sv.into(),
        input: UiInputType::Select,
        options: Some(options),
        placeholder_sv,
        help_sv,
    }
}
