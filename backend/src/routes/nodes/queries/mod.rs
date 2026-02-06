pub mod blast_radius;
pub mod dependents;
pub mod needs_review;
pub mod vendor_exposure;

pub use blast_radius::get_blast_radius;
pub use dependents::get_dependents;
pub use needs_review::get_needs_review_in_blast_radius;
pub use vendor_exposure::get_vendor_exposure;

use axum::http::StatusCode;

fn internal_error<E: std::fmt::Display>(e: E) -> (StatusCode, String) {
    (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
}
