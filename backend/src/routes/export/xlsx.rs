use crate::models::{Edge, Node};
use crate::routes::edges::flows::load_flow_map_for_claim_ids;
use crate::routes::AppState;
use axum::{
    body::Body,
    extract::{Query, State},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::Response,
};
use bytes::Bytes;
use sqlx::Row;
use time::format_description::well_known::Rfc3339;
use time::macros::format_description;
use time::OffsetDateTime;
use uuid::Uuid;

use rust_xlsxwriter::{Color, Format, FormatAlign, Workbook};

use super::util::{
    db_error, meta_critical, meta_env, meta_os, meta_owner, meta_role, meta_sla, set_width_range,
    xlsx_error, EdgeScope, ExportRequest,
};

pub(super) async fn export_snapshot_xlsx(
    State(state): State<AppState>,
    Query(req): Query<ExportRequest>,
) -> Result<Response, (StatusCode, String)> {
    let now = OffsetDateTime::now_utc();
    let exported_at = now
        .format(&Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string());
    let date_for_filename = now
        .format(&format_description!("[day]_[month]_[year repr:last_two]"))
        .unwrap_or_else(|_| "01_01_70".to_string());
    let filename = format!("KEAB_SoR_{}.xlsx", date_for_filename);

    let spec = req
        .filter_spec()
        .map_err(|e| (StatusCode::BAD_REQUEST, e))?;

    let include_edges = req.include_edges();
    let include_claims = req.include_claims();
    let include_flows = req.include_flows() && include_claims;

    let nodes: Vec<Node> = sqlx::query_as::<_, Node>(
        r#"
        SELECT *
        FROM nodes
        WHERE deleted_at IS NULL
        ORDER BY kind, name, id
        "#,
    )
    .fetch_all(&state.pool)
    .await
    .map_err(db_error)?;

    let nodes: Vec<Node> = nodes.into_iter().filter(|n| spec.matches_node(n)).collect();

    let node_ids: Option<Vec<Uuid>> = if spec.is_empty() {
        None
    } else {
        Some(nodes.iter().map(|n| n.id).collect())
    };

    let edges: Vec<Edge> = if include_edges {
        match (&node_ids, req.edge_scope()) {
            (Some(ids), EdgeScope::Both) => sqlx::query_as::<_, Edge>(
                r#"
                    SELECT *
                    FROM edges
                    WHERE from_id = ANY($1) AND to_id = ANY($1)
                    ORDER BY kind, from_id, to_id, id
                    "#,
            )
            .bind(ids)
            .fetch_all(&state.pool)
            .await
            .map_err(db_error)?,
            (Some(ids), EdgeScope::Any) => sqlx::query_as::<_, Edge>(
                r#"
                    SELECT *
                    FROM edges
                    WHERE from_id = ANY($1) OR to_id = ANY($1)
                    ORDER BY kind, from_id, to_id, id
                    "#,
            )
            .bind(ids)
            .fetch_all(&state.pool)
            .await
            .map_err(db_error)?,
            (None, _) => sqlx::query_as::<_, Edge>(
                r#"
                    SELECT *
                    FROM edges
                    ORDER BY kind, from_id, to_id, id
                    "#,
            )
            .fetch_all(&state.pool)
            .await
            .map_err(db_error)?,
        }
    } else {
        vec![]
    };

    let claim_rows = if include_edges && include_claims {
        if node_ids.is_none() {
            sqlx::query(
                r#"
                SELECT
                  e.id AS edge_id,

                  c.id AS claim_id,
                  c.status AS claim_status,
                  c.source AS claim_source,
                  c.confidence AS claim_confidence,
                  c.created_by AS claim_created_by,
                  c.created_at AS claim_created_at,
                  c.updated_at AS claim_updated_at,
                  c.last_verified_at AS claim_last_verified_at,
                  c.import_batch_id AS claim_import_batch_id

                FROM edges e
                LEFT JOIN LATERAL (
                  SELECT *
                  FROM edge_claims
                  WHERE edge_id = e.id
                    AND status IN ('active', 'needs_review')
                  ORDER BY created_at DESC
                  LIMIT 1
                ) c ON TRUE
                ORDER BY e.kind, e.from_id, e.to_id, e.id
                "#,
            )
            .fetch_all(&state.pool)
            .await
            .map_err(db_error)?
        } else {
            let edge_ids: Vec<Uuid> = edges.iter().map(|e| e.id).collect();

            if edge_ids.is_empty() {
                vec![]
            } else {
                sqlx::query(
                    r#"
                    SELECT
                      e.id AS edge_id,

                      c.id AS claim_id,
                      c.status AS claim_status,
                      c.source AS claim_source,
                      c.confidence AS claim_confidence,
                      c.created_by AS claim_created_by,
                      c.created_at AS claim_created_at,
                      c.updated_at AS claim_updated_at,
                      c.last_verified_at AS claim_last_verified_at,
                      c.import_batch_id AS claim_import_batch_id

                    FROM edges e
                    LEFT JOIN LATERAL (
                      SELECT *
                      FROM edge_claims
                      WHERE edge_id = e.id
                        AND status IN ('active', 'needs_review')
                      ORDER BY created_at DESC
                      LIMIT 1
                    ) c ON TRUE
                    WHERE e.id = ANY($1)
                    ORDER BY e.kind, e.from_id, e.to_id, e.id
                    "#,
                )
                .bind(edge_ids)
                .fetch_all(&state.pool)
                .await
                .map_err(db_error)?
            }
        }
    } else {
        vec![]
    };

    let mut claim_ids: Vec<Uuid> = Vec::new();
    for r in claim_rows.iter() {
        if let Ok(cid) = r.try_get::<Uuid, _>("claim_id") {
            claim_ids.push(cid);
        }
    }

    let flow_map = if !include_flows || claim_ids.is_empty() {
        std::collections::HashMap::new()
    } else {
        load_flow_map_for_claim_ids(&state.pool, &claim_ids).await?
    };

    let mut wb = Workbook::new();

    let title_fmt = Format::new()
        .set_bold()
        .set_font_size(16.0)
        .set_font_color(Color::White)
        .set_background_color(Color::RGB(0x007A3D))
        .set_align(FormatAlign::Center)
        .set_align(FormatAlign::VerticalCenter);

    let sub_fmt = Format::new()
        .set_font_color(Color::RGB(0x005F2E))
        .set_bold()
        .set_align(FormatAlign::Left);

    let header_fmt = Format::new()
        .set_bold()
        .set_background_color(Color::RGB(0xE6F4EA));

    {
        let ws = wb.add_worksheet();
        let ws = ws;
        ws.set_name("Noder").map_err(xlsx_error)?;

        ws.set_row_height(0, 24.0).map_err(xlsx_error)?;
        ws.merge_range(0, 0, 0, 11, "KEAB SoR — Export", &title_fmt)
            .map_err(xlsx_error)?;
        ws.write_string_with_format(1, 0, &format!("Exporterad: {}", exported_at), &sub_fmt)
            .map_err(xlsx_error)?;

        let header_row: u32 = 3;
        ws.set_freeze_panes(header_row + 1, 0).map_err(xlsx_error)?;

        let headers = [
            "id",
            "typ",
            "namn",
            "miljö",
            "os",
            "ägare",
            "roll",
            "kritisk",
            "sla",
            "skapad",
            "uppdaterad",
        ];

        for (c, h) in headers.iter().enumerate() {
            ws.write_string_with_format(header_row, c as u16, *h, &header_fmt)
                .map_err(xlsx_error)?;
        }

        for (i, n) in nodes.iter().enumerate() {
            let r = header_row + 1 + i as u32;

            ws.write_string(r, 0, &n.id.to_string())
                .map_err(xlsx_error)?;
            ws.write_string(r, 1, &n.kind).map_err(xlsx_error)?;
            ws.write_string(r, 2, &n.name).map_err(xlsx_error)?;

            ws.write_string(r, 3, &meta_env(&n.metadata))
                .map_err(xlsx_error)?;
            ws.write_string(r, 4, &meta_os(&n.metadata))
                .map_err(xlsx_error)?;
            ws.write_string(r, 5, &meta_owner(&n.metadata))
                .map_err(xlsx_error)?;
            ws.write_string(r, 6, &meta_role(&n.metadata))
                .map_err(xlsx_error)?;
            ws.write_string(r, 7, &meta_critical(&n.metadata))
                .map_err(xlsx_error)?;
            ws.write_string(r, 8, &meta_sla(&n.metadata))
                .map_err(xlsx_error)?;

            ws.write_string(r, 9, &n.created_at.format(&Rfc3339).unwrap_or_default())
                .map_err(xlsx_error)?;
            ws.write_string(r, 10, &n.updated_at.format(&Rfc3339).unwrap_or_default())
                .map_err(xlsx_error)?;
        }

        set_width_range(ws, 0, 0, 38.0).map_err(xlsx_error)?;
        set_width_range(ws, 1, 1, 16.0).map_err(xlsx_error)?;
        set_width_range(ws, 2, 2, 28.0).map_err(xlsx_error)?;
        set_width_range(ws, 3, 8, 16.0).map_err(xlsx_error)?;
        set_width_range(ws, 9, 10, 24.0).map_err(xlsx_error)?;

        let last_row = header_row + nodes.len() as u32;
        ws.autofilter(header_row, 0, last_row, (headers.len() - 1) as u16)
            .map_err(xlsx_error)?;
    }

    if include_edges {
        {
            let ws = wb.add_worksheet();
            let ws = ws;
            ws.set_name("Kopplingar").map_err(xlsx_error)?;

            ws.set_row_height(0, 24.0).map_err(xlsx_error)?;
            ws.merge_range(0, 0, 0, 12, "KEAB SoR — Export", &title_fmt)
                .map_err(xlsx_error)?;
            ws.write_string_with_format(1, 0, &format!("Exporterad: {}", exported_at), &sub_fmt)
                .map_err(xlsx_error)?;

            let header_row: u32 = 3;
            ws.set_freeze_panes(header_row + 1, 0).map_err(xlsx_error)?;

            let headers = [
                "id",
                "typ",
                "från_id",
                "till_id",
                "miljö",
                "os",
                "ägare",
                "roll",
                "kritisk",
                "sla",
                "skapad",
                "uppdaterad",
            ];

            for (c, h) in headers.iter().enumerate() {
                ws.write_string_with_format(header_row, c as u16, *h, &header_fmt)
                    .map_err(xlsx_error)?;
            }

            for (i, e) in edges.iter().enumerate() {
                let r = header_row + 1 + i as u32;

                ws.write_string(r, 0, &e.id.to_string())
                    .map_err(xlsx_error)?;
                ws.write_string(r, 1, &e.kind).map_err(xlsx_error)?;
                ws.write_string(r, 2, &e.from_id.to_string())
                    .map_err(xlsx_error)?;
                ws.write_string(r, 3, &e.to_id.to_string())
                    .map_err(xlsx_error)?;

                ws.write_string(r, 4, &meta_env(&e.metadata))
                    .map_err(xlsx_error)?;
                ws.write_string(r, 5, &meta_os(&e.metadata))
                    .map_err(xlsx_error)?;
                ws.write_string(r, 6, &meta_owner(&e.metadata))
                    .map_err(xlsx_error)?;
                ws.write_string(r, 7, &meta_role(&e.metadata))
                    .map_err(xlsx_error)?;
                ws.write_string(r, 8, &meta_critical(&e.metadata))
                    .map_err(xlsx_error)?;
                ws.write_string(r, 9, &meta_sla(&e.metadata))
                    .map_err(xlsx_error)?;

                ws.write_string(r, 10, &e.created_at.format(&Rfc3339).unwrap_or_default())
                    .map_err(xlsx_error)?;
                ws.write_string(r, 11, &e.updated_at.format(&Rfc3339).unwrap_or_default())
                    .map_err(xlsx_error)?;
            }

            set_width_range(ws, 0, 0, 38.0).map_err(xlsx_error)?;
            set_width_range(ws, 1, 1, 16.0).map_err(xlsx_error)?;
            set_width_range(ws, 2, 3, 38.0).map_err(xlsx_error)?;
            set_width_range(ws, 4, 9, 16.0).map_err(xlsx_error)?;
            set_width_range(ws, 10, 11, 24.0).map_err(xlsx_error)?;

            let last_row = header_row + edges.len() as u32;
            ws.autofilter(header_row, 0, last_row, (headers.len() - 1) as u16)
                .map_err(xlsx_error)?;
        }
    }

    if include_edges && include_claims {
        {
            let ws = wb.add_worksheet();
            let ws = ws;
            ws.set_name("ClaimsCurrent").map_err(xlsx_error)?;
            ws.set_freeze_panes(1, 0).map_err(xlsx_error)?;

            let headers = [
                "edge_id",
                "claim_id",
                "status",
                "source",
                "confidence",
                "created_by",
                "created_at",
                "updated_at",
                "last_verified_at",
                "import_batch_id",
            ];
            for (c, h) in headers.iter().enumerate() {
                ws.write_string_with_format(0, c as u16, *h, &header_fmt)
                    .map_err(xlsx_error)?;
            }

            for (i, r0) in claim_rows.iter().enumerate() {
                let row = (i + 1) as u32;

                let edge_id: Uuid = r0.try_get("edge_id").map_err(|e| {
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        format!("decode edge_id: {e}"),
                    )
                })?;

                let claim_id: Option<Uuid> = r0.try_get("claim_id").ok();
                let status: Option<String> = r0.try_get("claim_status").ok();
                let source: Option<String> = r0.try_get("claim_source").ok();
                let confidence: Option<i16> = r0.try_get("claim_confidence").ok();
                let created_by: Option<String> = r0.try_get("claim_created_by").ok();
                let created_at: Option<OffsetDateTime> = r0.try_get("claim_created_at").ok();
                let updated_at: Option<OffsetDateTime> = r0.try_get("claim_updated_at").ok();
                let last_verified_at: Option<OffsetDateTime> =
                    r0.try_get("claim_last_verified_at").ok();
                let import_batch_id: Option<Uuid> = r0.try_get("claim_import_batch_id").ok();

                ws.write_string(row, 0, &edge_id.to_string())
                    .map_err(xlsx_error)?;
                ws.write_string(row, 1, &claim_id.map(|x| x.to_string()).unwrap_or_default())
                    .map_err(xlsx_error)?;
                ws.write_string(row, 2, status.as_deref().unwrap_or(""))
                    .map_err(xlsx_error)?;
                ws.write_string(row, 3, source.as_deref().unwrap_or(""))
                    .map_err(xlsx_error)?;
                ws.write_string(
                    row,
                    4,
                    &confidence.map(|x| x.to_string()).unwrap_or_default(),
                )
                .map_err(xlsx_error)?;
                ws.write_string(row, 5, created_by.as_deref().unwrap_or(""))
                    .map_err(xlsx_error)?;
                ws.write_string(
                    row,
                    6,
                    &created_at
                        .map(|t| t.format(&Rfc3339).unwrap_or_default())
                        .unwrap_or_default(),
                )
                .map_err(xlsx_error)?;
                ws.write_string(
                    row,
                    7,
                    &updated_at
                        .map(|t| t.format(&Rfc3339).unwrap_or_default())
                        .unwrap_or_default(),
                )
                .map_err(xlsx_error)?;
                ws.write_string(
                    row,
                    8,
                    &last_verified_at
                        .map(|t| t.format(&Rfc3339).unwrap_or_default())
                        .unwrap_or_default(),
                )
                .map_err(xlsx_error)?;
                ws.write_string(
                    row,
                    9,
                    &import_batch_id.map(|x| x.to_string()).unwrap_or_default(),
                )
                .map_err(xlsx_error)?;
            }

            set_width_range(ws, 0, 1, 38.0).map_err(xlsx_error)?;
            set_width_range(ws, 2, 3, 18.0).map_err(xlsx_error)?;
            set_width_range(ws, 4, 4, 12.0).map_err(xlsx_error)?;
            set_width_range(ws, 5, 5, 20.0).map_err(xlsx_error)?;
            set_width_range(ws, 6, 9, 24.0).map_err(xlsx_error)?;
            ws.autofilter(0, 0, claim_rows.len() as u32, 9)
                .map_err(xlsx_error)?;
        }
    }

    if include_edges && include_claims && include_flows {
        {
            let ws = wb.add_worksheet();
            let ws = ws;
            ws.set_name("FlowsCurrent").map_err(xlsx_error)?;
            ws.set_freeze_panes(1, 0).map_err(xlsx_error)?;

            let headers = [
                "edge_id",
                "claim_id",
                "flow_id",
                "flow_type",
                "direction",
                "data_category_id",
                "protocol",
                "frequency",
                "created_at",
            ];
            for (c, h) in headers.iter().enumerate() {
                ws.write_string_with_format(0, c as u16, *h, &header_fmt)
                    .map_err(xlsx_error)?;
            }

            let mut edge_by_claim: std::collections::HashMap<Uuid, Uuid> =
                std::collections::HashMap::new();
            for r0 in claim_rows.iter() {
                let edge_id: Uuid = match r0.try_get("edge_id") {
                    Ok(v) => v,
                    Err(_) => continue,
                };
                if let Ok(cid) = r0.try_get::<Uuid, _>("claim_id") {
                    edge_by_claim.insert(cid, edge_id);
                }
            }

            let mut row: u32 = 1;
            for (claim_id, flows) in flow_map.iter() {
                let edge_id = edge_by_claim.get(claim_id).cloned();
                for f in flows.iter() {
                    ws.write_string(row, 0, &edge_id.map(|x| x.to_string()).unwrap_or_default())
                        .map_err(xlsx_error)?;
                    ws.write_string(row, 1, &claim_id.to_string())
                        .map_err(xlsx_error)?;
                    ws.write_string(row, 2, &f.id.to_string())
                        .map_err(xlsx_error)?;
                    ws.write_string(row, 3, &f.flow_type).map_err(xlsx_error)?;
                    ws.write_string(row, 4, &f.direction).map_err(xlsx_error)?;
                    ws.write_string(
                        row,
                        5,
                        &f.data_category_id
                            .map(|x| x.to_string())
                            .unwrap_or_default(),
                    )
                    .map_err(xlsx_error)?;
                    ws.write_string(row, 6, f.protocol.as_deref().unwrap_or(""))
                        .map_err(xlsx_error)?;
                    ws.write_string(row, 7, f.frequency.as_deref().unwrap_or(""))
                        .map_err(xlsx_error)?;
                    ws.write_string(row, 8, &f.created_at.format(&Rfc3339).unwrap_or_default())
                        .map_err(xlsx_error)?;
                    row += 1;
                }
            }

            set_width_range(ws, 0, 2, 38.0).map_err(xlsx_error)?;
            set_width_range(ws, 3, 4, 16.0).map_err(xlsx_error)?;
            set_width_range(ws, 5, 5, 38.0).map_err(xlsx_error)?;
            set_width_range(ws, 6, 7, 18.0).map_err(xlsx_error)?;
            set_width_range(ws, 8, 8, 24.0).map_err(xlsx_error)?;

            let last_row = if row == 0 { 0 } else { row.saturating_sub(1) };
            ws.autofilter(0, 0, last_row.max(1), 8)
                .map_err(xlsx_error)?;
        }
    }

    let bytes = wb.save_to_buffer().map_err(xlsx_error)?;

    let mut headers = HeaderMap::new();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ),
    );

    let cd = format!("attachment; filename=\"{}\"", filename);
    headers.insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_str(&cd).unwrap_or_else(|_| HeaderValue::from_static("attachment")),
    );

    let mut resp = Response::new(Body::from(Bytes::from(bytes)));
    *resp.headers_mut() = headers;
    Ok(resp)
}
