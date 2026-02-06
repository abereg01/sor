use axum::{
    routing::{get, patch, post},
    Router,
};

use crate::routes::AppState;

pub mod claims;
pub mod crud;
pub mod details;
pub mod needs_review;
pub mod queries;
pub mod walk;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(crud::list_nodes).post(crud::create_node))
        .route("/lookups/suppliers", get(details::lookup_suppliers))
        .route("/lookups/owners", get(details::lookup_owners))
        .route(
            "/:id/details",
            get(details::get_node_details).put(details::put_node_details),
        )
        .route(
            "/:id",
            get(crud::get_node)
                .put(crud::update_node)
                .delete(crud::delete_node),
        )
        .route("/:id/metadata", patch(crud::patch_node_metadata))
        .route("/:id/restore", post(crud::restore_node))
        .route("/:id/duplicate", post(crud::duplicate_node))
        .route("/:id/blast-radius", get(queries::get_blast_radius))
        .route("/:id/dependents", get(queries::get_dependents))
        .route(
            "/:id/blast-radius/needs-review",
            get(queries::get_needs_review_in_blast_radius),
        )
        .route("/:id/vendor-exposure", get(queries::get_vendor_exposure))
        .route(
            "/needs-review",
            get(needs_review::list_nodes_needing_review),
        )
        .route(
            "/:id/needs-review",
            post(needs_review::mark_node_needs_review),
        )
        .route(
            "/:id/claims",
            get(claims::list_node_claims).post(claims::create_node_claim),
        )
}
