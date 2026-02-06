use serde_json::Value;
use sqlx::Postgres;
use uuid::Uuid;

use crate::auth::AuthActor;

#[derive(Debug, Clone, Copy)]
pub struct RequestContext {
    pub request_id: Uuid,
}

#[derive(Debug, Clone, Copy)]
pub enum EntityType {
    Node,
    Edge,
}

impl EntityType {
    pub fn as_str(self) -> &'static str {
        match self {
            EntityType::Node => "node",
            EntityType::Edge => "edge",
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub enum AuditAction {
    Create,
    Patch,
    Delete,
}

impl AuditAction {
    pub fn as_str(self) -> &'static str {
        match self {
            AuditAction::Create => "create",
            AuditAction::Patch => "patch",
            AuditAction::Delete => "delete",
        }
    }
}

pub async fn write_audit<'e, E>(
    executor: E,
    ctx: RequestContext,
    actor: Option<&AuthActor>,
    entity_type: EntityType,
    entity_id: Uuid,
    action: AuditAction,
    before: Option<Value>,
    patch: Option<Value>,
    after: Option<Value>,
) -> Result<(), sqlx::Error>
where
    E: sqlx::Executor<'e, Database = Postgres>,
{
    sqlx::query(
        r#"
        INSERT INTO audit_log (
            entity_type,
            entity_id,
            action,
            before,
            patch,
            after,
            correlation_id,
            actor_type,
            actor_id,
            actor_username,
            actor_role
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        "#,
    )
    .bind(entity_type.as_str())
    .bind(entity_id)
    .bind(action.as_str())
    .bind(before)
    .bind(patch)
    .bind(after)
    .bind(ctx.request_id)
    .bind(actor.map(|_| "user").unwrap_or("system"))
    .bind(None::<Uuid>)
    .bind(actor.map(|a| a.username.as_str()))
    .bind(actor.map(|a| a.role.as_str()))
    .execute(executor)
    .await
    .map(|_| ())
}
