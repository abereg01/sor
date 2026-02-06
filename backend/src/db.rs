use sqlx::{postgres::PgPoolOptions, PgPool};
use uuid::Uuid;

use crate::models::{EdgeKind, NewEdge, NewNode, NodeKind};

pub async fn connect(database_url: &str) -> anyhow::Result<PgPool> {
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(database_url)
        .await?;
    Ok(pool)
}

pub async fn seed_if_empty(pool: &PgPool) -> anyhow::Result<()> {
    let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM nodes")
        .fetch_one(pool)
        .await?;

    if count > 0 {
        return Ok(());
    }

    tracing::info!("seeding demo graph (DB was empty)");

    let host = create_node(
        pool,
        NewNode {
            kind: NodeKind::Host,
            name: "ds-m01".into(),
            metadata: serde_json::json!({"role": "swarm-manager", "env": "prod"}),
        },
    )
    .await?;

    let postgres = create_node(
        pool,
        NewNode {
            kind: NodeKind::Database,
            name: "Postgres16".into(),
            metadata: serde_json::json!({"engine": "postgres", "version": "16", "env": "prod"}),
        },
    )
    .await?;

    let nextcloud = create_node(
        pool,
        NewNode {
            kind: NodeKind::System,
            name: "Nextcloud".into(),
            metadata: serde_json::json!({"env": "prod", "critical": true}),
        },
    )
    .await?;

    let backup = create_node(
        pool,
        NewNode {
            kind: NodeKind::Service,
            name: "Borg Backup".into(),
            metadata: serde_json::json!({"env": "prod"}),
        },
    )
    .await?;

    let team = create_node(
        pool,
        NewNode {
            kind: NodeKind::Team,
            name: "Digit".into(),
            metadata: serde_json::json!({"cost_center": "IT"}),
        },
    )
    .await?;

    let gdpr = create_node(
        pool,
        NewNode {
            kind: NodeKind::DataCategory,
            name: "Personal Data (GDPR)".into(),
            metadata: serde_json::json!({"law": "GDPR", "examples": ["names", "emails", "files"]}),
        },
    )
    .await?;

    create_edge(
        pool,
        NewEdge {
            from_id: nextcloud,
            to_id: postgres,
            kind: EdgeKind::DependsOn,
            metadata: serde_json::json!({"notes": "DB backend"}),
        },
    )
    .await?;

    create_edge(
        pool,
        NewEdge {
            from_id: nextcloud,
            to_id: host,
            kind: EdgeKind::RunsOn,
            metadata: serde_json::json!({"notes": "Swarm service on manager"}),
        },
    )
    .await?;

    create_edge(
        pool,
        NewEdge {
            from_id: nextcloud,
            to_id: gdpr,
            kind: EdgeKind::StoresData,
            metadata: serde_json::json!({"notes": "User files, shares"}),
        },
    )
    .await?;

    create_edge(
        pool,
        NewEdge {
            from_id: postgres,
            to_id: backup,
            kind: EdgeKind::BacksUpTo,
            metadata: serde_json::json!({"notes": "nightly job"}),
        },
    )
    .await?;

    create_edge(
        pool,
        NewEdge {
            from_id: nextcloud,
            to_id: team,
            kind: EdgeKind::OwnedBy,
            metadata: serde_json::json!({"notes": "internal owner"}),
        },
    )
    .await?;

    Ok(())
}

async fn create_node(pool: &PgPool, node: NewNode) -> anyhow::Result<Uuid> {
    let id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO nodes (id, kind, name, metadata)
        VALUES ($1, $2, $3, $4)
        "#,
    )
    .bind(id)
    .bind(node.kind.as_str())
    .bind(node.name)
    .bind(node.metadata)
    .execute(pool)
    .await?;
    Ok(id)
}

async fn create_edge(pool: &PgPool, edge: NewEdge) -> anyhow::Result<Uuid> {
    let id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO edges (id, from_id, to_id, kind, metadata)
        VALUES ($1, $2, $3, $4, $5)
        "#,
    )
    .bind(id)
    .bind(edge.from_id)
    .bind(edge.to_id)
    .bind(edge.kind.as_str())
    .bind(edge.metadata)
    .execute(pool)
    .await?;
    Ok(id)
}
