use axum::{
    routing::{get, patch, post},
    Router,
};

use crate::routes::AppState;

pub mod claims;
pub mod create;
pub mod delete;
pub mod evidence;
pub mod flows;
pub mod get;
pub mod helpers;
pub mod list;
pub mod needs_review;
pub mod typed_flows;
pub mod update;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list::list_edges).post(create::create_edge))
        .route(
            "/needs-review",
            get(needs_review::list_edges_needing_review),
        )
        .route(
            "/:id",
            get(get::get_edge)
                .put(update::update_edge)
                .delete(delete::delete_edge),
        )
        .route(
            "/:id/needs-review",
            post(needs_review::mark_edge_needs_review),
        )
        .route("/:id/metadata", patch(update::patch_edge_metadata))
        .route(
            "/:id/typed-flows",
            get(typed_flows::get_edge_typed_flows).put(typed_flows::put_edge_typed_flows),
        )
        .route(
            "/:id/claims",
            get(claims::list_edge_claims).post(claims::create_edge_claim),
        )
}
