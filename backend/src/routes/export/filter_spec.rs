use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::models::Node;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Field {
    Critical,
    Domain,
    Kind,
    Meta,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Op {
    Eq,
    Neq,
    Contains,
    StartsWith,
    EndsWith,
    Exists,
    NotExists,
    In,
    NotIn,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Condition {
    pub field: Field,
    #[serde(default)]
    pub key: Option<String>,
    pub op: Op,
    #[serde(default)]
    pub value: Option<Value>,
    #[serde(default)]
    pub values: Option<Vec<Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Group {
    #[serde(default)]
    pub conditions: Vec<Condition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilterSpec {
    #[serde(default)]
    pub groups: Vec<Group>,
}

impl Default for FilterSpec {
    fn default() -> Self {
        Self { groups: vec![] }
    }
}

impl FilterSpec {
    pub fn is_empty(&self) -> bool {
        self.groups.is_empty() || self.groups.iter().all(|g| g.conditions.is_empty())
    }

    pub fn matches_node(&self, node: &Node) -> bool {
        if self.is_empty() {
            return true;
        }

        self.groups.iter().any(|g| {
            if g.conditions.is_empty() {
                return true;
            }
            g.conditions.iter().all(|c| matches_condition(node, c))
        })
    }
}

fn node_meta<'a>(node: &'a Node, key: &str) -> Option<&'a Value> {
    match node.metadata.get(key) {
        Some(v) if !v.is_null() => Some(v),
        _ => None,
    }
}

fn as_string(v: &Value) -> Option<String> {
    match v {
        Value::String(s) => Some(s.clone()),
        Value::Bool(b) => Some(if *b { "true" } else { "false" }.to_string()),
        Value::Number(n) => Some(n.to_string()),
        _ => None,
    }
}

fn normalize_bool_str(s: &str) -> Option<bool> {
    match s.trim().to_lowercase().as_str() {
        "true" | "1" | "yes" | "ja" => Some(true),
        "false" | "0" | "no" | "nej" => Some(false),
        _ => None,
    }
}

fn equals_value(actual: &Value, expected: &Value) -> bool {
    match (actual, expected) {
        (Value::Bool(a), Value::Bool(e)) => a == e,
        (Value::Number(a), Value::Number(e)) => a == e,
        (Value::String(a), Value::String(e)) => a == e,
        (Value::Bool(a), Value::String(e)) => {
            normalize_bool_str(e).map(|b| b == *a).unwrap_or(false)
        }
        (Value::String(a), Value::Bool(e)) => {
            normalize_bool_str(a).map(|b| b == *e).unwrap_or(false)
        }
        _ => as_string(actual)
            .zip(as_string(expected))
            .map(|(a, e)| a == e)
            .unwrap_or(false),
    }
}

fn matches_condition(node: &Node, c: &Condition) -> bool {
    match c.field {
        Field::Critical => {
            let actual = node_meta(node, "critical");
            matches_by_op(actual, c)
        }
        Field::Domain => {
            let actual = node_meta(node, "domain");
            matches_by_op(actual, c)
        }
        Field::Kind => {
            let actual = Value::String(node.kind.clone());
            matches_value_by_op(Some(&actual), c)
        }
        Field::Meta => {
            let key = c.key.as_deref().unwrap_or("").trim();
            if key.is_empty() {
                return false;
            }
            let actual = node_meta(node, key);
            matches_by_op(actual, c)
        }
    }
}

fn matches_by_op(actual: Option<&Value>, c: &Condition) -> bool {
    matches_value_by_op(actual, c)
}

fn matches_value_by_op(actual: Option<&Value>, c: &Condition) -> bool {
    match c.op {
        Op::Exists => actual.is_some(),
        Op::NotExists => actual.is_none(),
        Op::Eq => match (actual, c.value.as_ref()) {
            (Some(a), Some(e)) => equals_value(a, e),
            _ => false,
        },
        Op::Neq => match (actual, c.value.as_ref()) {
            (Some(a), Some(e)) => !equals_value(a, e),
            (None, Some(_)) => true,
            _ => false,
        },
        Op::In => match (actual, c.values.as_ref()) {
            (Some(a), Some(vs)) => vs.iter().any(|e| equals_value(a, e)),
            _ => false,
        },
        Op::NotIn => match (actual, c.values.as_ref()) {
            (Some(a), Some(vs)) => !vs.iter().any(|e| equals_value(a, e)),
            (None, Some(_)) => true,
            _ => false,
        },
        Op::Contains | Op::StartsWith | Op::EndsWith => {
            let a = actual.and_then(as_string).unwrap_or_default();
            let e = c.value.as_ref().and_then(as_string).unwrap_or_default();
            if a.is_empty() || e.is_empty() {
                return false;
            }
            let a_l = a.to_lowercase();
            let e_l = e.to_lowercase();
            match c.op {
                Op::Contains => a_l.contains(&e_l),
                Op::StartsWith => a_l.starts_with(&e_l),
                Op::EndsWith => a_l.ends_with(&e_l),
                _ => false,
            }
        }
    }
}
