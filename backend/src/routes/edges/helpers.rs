use axum::http::StatusCode;

pub fn internal_error(err: impl std::fmt::Display) -> (StatusCode, String) {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        format!("Internt fel: {err}"),
    )
}

pub fn map_sqlx_error(err: sqlx::Error) -> (StatusCode, String) {
    match err {
        sqlx::Error::Database(db_err) => (
            StatusCode::BAD_REQUEST,
            format!("Ogiltig begäran: {}", db_err.message()),
        ),
        _ => (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Internt fel: {err}"),
        ),
    }
}
