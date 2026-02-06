use axum::{routing::get, Router};

use crate::routes::AppState;

mod csv;
mod filter_spec;
mod json;
mod util;
mod xlsx;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/snapshot.json", get(json::export_snapshot_json))
        .route("/graph.json", get(json::export_snapshot_json))
        .route("/snapshot.csv", get(csv::export_snapshot_csv))
        .route("/snapshot.xlsx", get(xlsx::export_snapshot_xlsx))
        .route("/nodes.csv", get(csv::export_nodes_csv))
        .route("/edges.csv", get(csv::export_edges_csv))
        .route("/claims_current.csv", get(csv::export_claims_current_csv))
        .route("/flows_current.csv", get(csv::export_flows_current_csv))
}
