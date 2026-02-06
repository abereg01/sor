use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;
use uuid::Uuid;

use crate::routes::{etag_from_updated_at, is_match, require_if_match, AppState};

use super::types::*;
use super::util::{
    internal_error, is_valid_business_criticality, is_valid_information_class,
    is_valid_supplier_type, trim_opt,
};

pub async fn get_node_details(
    State(state): State<AppState>,
    Path(node_id): Path<Uuid>,
) -> Result<(HeaderMap, Json<NodeDetailsResponse>), (StatusCode, String)> {
    let node = sqlx::query_as::<_, NodeCore>(
        r#"
        SELECT
          id,
          kind,
          name,
          metadata,
          owning_department::text AS owning_department,
          created_at,
          updated_at
        FROM nodes
        WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(node_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(internal_error)?
    .ok_or((StatusCode::NOT_FOUND, "Noden finns inte".into()))?;

    let suppliers = sqlx::query_as::<_, Party>(
        r#"
        SELECT s.id, s.name
        FROM node_suppliers ns
        JOIN suppliers s ON s.id = ns.supplier_id
        WHERE ns.node_id = $1
        ORDER BY s.name
        "#,
    )
    .bind(node_id)
    .fetch_all(&state.pool)
    .await
    .map_err(internal_error)?;

    let owners = sqlx::query_as::<_, Party>(
        r#"
        SELECT o.id, o.name
        FROM node_owners no
        JOIN owners o ON o.id = no.owner_id
        WHERE no.node_id = $1
        ORDER BY o.name
        "#,
    )
    .bind(node_id)
    .fetch_all(&state.pool)
    .await
    .map_err(internal_error)?;

    let supplier_types_rows = sqlx::query_scalar::<_, String>(
        r#"
        SELECT supplier_type::text
        FROM node_supplier_types
        WHERE node_id = $1
        ORDER BY supplier_type::text
        "#,
    )
    .bind(node_id)
    .fetch_all(&state.pool)
    .await
    .map_err(internal_error)?;

    let software = sqlx::query_as::<_, NodeSoftware>(
        r#"
        SELECT
          software_name,
          purpose,
          description
        FROM node_software
        WHERE node_id = $1
        "#,
    )
    .bind(node_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(internal_error)?;

    let risk = sqlx::query_as::<_, NodeRisk>(
        r#"
        SELECT
          legal_requirements,
          financial_value,
          pii,
          business_criticality::text AS business_criticality,
          information_class::text AS information_class,
          criticality_score::float8 AS criticality_score
        FROM node_risk
        WHERE node_id = $1
        "#,
    )
    .bind(node_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(internal_error)?;

    let mut headers = HeaderMap::new();
    let etag = etag_from_updated_at(node.updated_at);
    headers.insert("etag", etag);

    Ok((
        headers,
        Json(NodeDetailsResponse {
            node,
            suppliers,
            owners,
            supplier_types: supplier_types_rows,
            software,
            risk,
        }),
    ))
}

pub async fn put_node_details(
    State(state): State<AppState>,
    Path(node_id): Path<Uuid>,
    headers: HeaderMap,
    Json(payload): Json<PutNodeDetailsRequest>,
) -> Result<(HeaderMap, Json<NodeDetailsResponse>), (StatusCode, String)> {
    let if_match = require_if_match(&headers)?;

    let node_updated_at: OffsetDateTime = sqlx::query_scalar(
        r#"
        SELECT updated_at
        FROM nodes
        WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(node_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(internal_error)?
    .ok_or((StatusCode::NOT_FOUND, "Noden finns inte".into()))?;

    let current_etag = etag_from_updated_at(node_updated_at);
    if !is_match(&current_etag, &if_match) {
        return Err((
            StatusCode::PRECONDITION_FAILED,
            "Objektet har ändrats. Ladda om och försök igen.".into(),
        ));
    }

    let if_match_clean = if_match.trim().trim_matches('"');
    let expected_updated_at =
        OffsetDateTime::parse(if_match_clean, &Rfc3339).unwrap_or(node_updated_at);

    let mut touched = false;

    let mut tx = state.pool.begin().await.map_err(internal_error)?;

    if let Some(dept) = payload.owning_department {
        let dept = dept.trim().to_string();
        let dept = if dept.is_empty() { None } else { Some(dept) };

        let res = if let Some(dept) = dept {
            sqlx::query(
                r#"
                UPDATE nodes
                SET owning_department = $2::owning_department
                WHERE id = $1 AND updated_at = $3
                "#,
            )
            .bind(node_id)
            .bind(dept)
            .bind(expected_updated_at)
            .execute(&mut *tx)
            .await
            .map_err(internal_error)?
        } else {
            sqlx::query(
                r#"
                UPDATE nodes
                SET owning_department = NULL
                WHERE id = $1 AND updated_at = $2
                "#,
            )
            .bind(node_id)
            .bind(expected_updated_at)
            .execute(&mut *tx)
            .await
            .map_err(internal_error)?
        };

        if res.rows_affected() == 0 {
            return Err((
                StatusCode::CONFLICT,
                "Objektet har uppdaterats av någon annan. Ladda om och försök igen.".into(),
            ));
        }

        touched = true;
    }

    if let Some(meta) = payload.metadata {
        let allowed_keys = [
            "app",
            "backup_policy",
            "description",
            "environment",
            "critical",
            "domain",
            "sla",
        ];

        let mut filtered = serde_json::Map::new();
        if let Some(obj) = meta.as_object() {
            for k in allowed_keys.iter() {
                if let Some(v) = obj.get(*k) {
                    filtered.insert(k.to_string(), v.clone());
                }
            }
        }

        if !filtered.is_empty() {
            let patch = serde_json::Value::Object(filtered);

            let res = sqlx::query(
                r#"
                UPDATE nodes
                SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
                WHERE id = $1 AND updated_at = $3
                "#,
            )
            .bind(node_id)
            .bind(patch)
            .bind(expected_updated_at)
            .execute(&mut *tx)
            .await
            .map_err(internal_error)?;

            if res.rows_affected() == 0 {
                return Err((
                    StatusCode::PRECONDITION_FAILED,
                    "Objektet har ändrats. Ladda om och försök igen.".into(),
                ));
            }

            touched = true;
        }
    }

    if let Some(types) = payload.supplier_types {
        for t in &types {
            if !is_valid_supplier_type(t) {
                return Err((
                    StatusCode::BAD_REQUEST,
                    "Ogiltig supplier_type (måste vara intern, saas eller paas)".into(),
                ));
            }
        }

        sqlx::query(
            r#"
            DELETE FROM node_supplier_types
            WHERE node_id = $1
            "#,
        )
        .bind(node_id)
        .execute(&mut *tx)
        .await
        .map_err(internal_error)?;

        for t in types {
            let t = t.trim().to_lowercase();
            if t.is_empty() {
                continue;
            }
            sqlx::query(
                r#"
                INSERT INTO node_supplier_types (node_id, supplier_type)
                VALUES ($1, $2::supplier_type)
                ON CONFLICT DO NOTHING
                "#,
            )
            .bind(node_id)
            .bind(t)
            .execute(&mut *tx)
            .await
            .map_err(internal_error)?;
        }

        touched = true;
    }

    if let Some(suppliers) = payload.suppliers {
        sqlx::query(
            r#"
            DELETE FROM node_suppliers
            WHERE node_id = $1
            "#,
        )
        .bind(node_id)
        .execute(&mut *tx)
        .await
        .map_err(internal_error)?;

        for name in suppliers {
            let name = name.trim().to_string();
            if name.is_empty() {
                continue;
            }

            let supplier_id: Uuid = sqlx::query_scalar(
                r#"
                INSERT INTO suppliers (name, updated_at)
                VALUES ($1, now())
                ON CONFLICT (name) DO UPDATE
                SET updated_at = EXCLUDED.updated_at
                RETURNING id
                "#,
            )
            .bind(name)
            .fetch_one(&mut *tx)
            .await
            .map_err(internal_error)?;

            sqlx::query(
                r#"
                INSERT INTO node_suppliers (node_id, supplier_id)
                VALUES ($1, $2)
                ON CONFLICT DO NOTHING
                "#,
            )
            .bind(node_id)
            .bind(supplier_id)
            .execute(&mut *tx)
            .await
            .map_err(internal_error)?;
        }

        touched = true;
    }

    if let Some(owners) = payload.owners {
        sqlx::query(
            r#"
            DELETE FROM node_owners
            WHERE node_id = $1
            "#,
        )
        .bind(node_id)
        .execute(&mut *tx)
        .await
        .map_err(internal_error)?;

        for name in owners {
            let name = name.trim().to_string();
            if name.is_empty() {
                continue;
            }

            let owner_id: Uuid = sqlx::query_scalar(
                r#"
                INSERT INTO owners (name, updated_at)
                VALUES ($1, now())
                ON CONFLICT (name) DO UPDATE
                SET updated_at = EXCLUDED.updated_at
                RETURNING id
                "#,
            )
            .bind(name)
            .fetch_one(&mut *tx)
            .await
            .map_err(internal_error)?;

            sqlx::query(
                r#"
                INSERT INTO node_owners (node_id, owner_id)
                VALUES ($1, $2)
                ON CONFLICT DO NOTHING
                "#,
            )
            .bind(node_id)
            .bind(owner_id)
            .execute(&mut *tx)
            .await
            .map_err(internal_error)?;
        }

        touched = true;
    }

    if let Some(sw) = payload.software {
        sqlx::query(
            r#"
            INSERT INTO node_software (node_id, software_name, purpose, description, updated_at)
            VALUES ($1, $2, $3, $4, now())
            ON CONFLICT (node_id) DO UPDATE
            SET
              software_name = EXCLUDED.software_name,
              purpose = EXCLUDED.purpose,
              description = EXCLUDED.description,
              updated_at = now()
            "#,
        )
        .bind(node_id)
        .bind(trim_opt(sw.software_name))
        .bind(trim_opt(sw.purpose))
        .bind(trim_opt(sw.description))
        .execute(&mut *tx)
        .await
        .map_err(internal_error)?;

        touched = true;
    }

    if let Some(risk) = payload.risk {
        if let Some(score) = risk.criticality_score {
            if score < 0.0 || score > 5.0 {
                return Err((
                    StatusCode::BAD_REQUEST,
                    "criticality_score måste vara mellan 0 och 5".into(),
                ));
            }
            let step = (score * 2.0).round() / 2.0;
            if (step - score).abs() > 1e-9 {
                return Err((
                    StatusCode::BAD_REQUEST,
                    "criticality_score måste vara i 0.5-steg (0, 0.5, 1.0 ... 5.0)".into(),
                ));
            }
        }

        if let Some(ref bc) = risk.business_criticality {
            if !is_valid_business_criticality(bc) {
                return Err((
                    StatusCode::BAD_REQUEST,
                    "Ogiltig business_criticality (low, medium, high)".into(),
                ));
            }
        }

        if let Some(ref ic) = risk.information_class {
            if !is_valid_information_class(ic) {
                return Err((
                    StatusCode::BAD_REQUEST,
                    "Ogiltig information_class (intern, begransad, skyddad, oppen, konfidentiell)"
                        .into(),
                ));
            }
        }

        sqlx::query(
            r#"
            INSERT INTO node_risk (
              node_id,
              legal_requirements,
              financial_value,
              pii,
              business_criticality,
              information_class,
              criticality_score,
              updated_at
            )
            VALUES ($1, $2, $3, $4, $5::business_criticality, $6::information_class, $7, now())
            ON CONFLICT (node_id) DO UPDATE
            SET
              legal_requirements = EXCLUDED.legal_requirements,
              financial_value = EXCLUDED.financial_value,
              pii = EXCLUDED.pii,
              business_criticality = EXCLUDED.business_criticality,
              information_class = EXCLUDED.information_class,
              criticality_score = EXCLUDED.criticality_score,
              updated_at = now()
            "#,
        )
        .bind(node_id)
        .bind(risk.legal_requirements)
        .bind(risk.financial_value)
        .bind(risk.pii)
        .bind(trim_opt(risk.business_criticality))
        .bind(trim_opt(risk.information_class))
        .bind(risk.criticality_score)
        .execute(&mut *tx)
        .await
        .map_err(internal_error)?;

        touched = true;
    }

    if touched {
        let res = sqlx::query(
            r#"
            UPDATE nodes
            SET updated_at = now()
            WHERE id = $1 AND updated_at = $2
            "#,
        )
        .bind(node_id)
        .bind(expected_updated_at)
        .execute(&mut *tx)
        .await
        .map_err(internal_error)?;

        if res.rows_affected() == 0 {
            return Err((
                StatusCode::CONFLICT,
                "Objektet har uppdaterats av någon annan. Ladda om och försök igen.".into(),
            ));
        }
    }

    tx.commit().await.map_err(internal_error)?;

    get_node_details(State(state), Path(node_id)).await
}
