use axum::{routing::get, Json, Router};

use crate::routes::AppState;

mod kinds;
mod types;
mod ui;

#[allow(unused_imports)]
pub use types::*;

pub fn router() -> Router<AppState> {
    Router::<AppState>::new().route("/kinds", get(kinds_handler))
}

async fn kinds_handler() -> Json<types::KindsResponse> {
    Json(kinds::kinds_response())
}
