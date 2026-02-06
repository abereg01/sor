mod audit;
mod auth;
mod config;
mod db;
mod graph;
mod metrics;
mod models;
mod routes;
mod validation;

use axum::body::Body;
use axum::http::{HeaderName, HeaderValue, Request, StatusCode};
use axum::response::Response;
use axum::{middleware, routing::get, Router};
use axum_prometheus::PrometheusMetricLayer;
use std::time::Duration;
use tower::limit::ConcurrencyLimitLayer;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::services::{ServeDir, ServeFile};
use tower_http::timeout::TimeoutLayer;
use tower_http::trace::TraceLayer;
use tracing_subscriber::prelude::*;
use tracing_subscriber::{fmt, EnvFilter};
use uuid::Uuid;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .with(fmt::layer().compact())
        .init();

    let cfg = config::Config::from_env().map_err(|e| {
        eprintln!("❌ configuration error: {:#}", e);
        e
    })?;

    let pool = db::connect(&cfg.database_url).await?;

    if std::env::var("SEED_DEMO").ok().as_deref() == Some("1") {
        db::seed_if_empty(&pool).await?;
    }

    let app_state = routes::AppState {
        pool,
        auth: routes::AuthState {
            local_admin_username: cfg.local_admin_username.clone(),
            local_admin_password: cfg.local_admin_password.clone(),
            jwt_secret: cfg.auth_jwt_secret.clone(),
            token_ttl_seconds: cfg.auth_token_ttl_seconds,
        },
    };

    let (prometheus_layer, metric_handle) = PrometheusMetricLayer::pair();

    let allowed_origins: Vec<HeaderValue> = cfg
        .cors_origins
        .iter()
        .map(|o| o.parse::<HeaderValue>())
        .collect::<Result<Vec<_>, _>>()?;

    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list(allowed_origins))
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::PATCH,
            axum::http::Method::DELETE,
        ])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::IF_MATCH,
            axum::http::header::AUTHORIZATION,
        ])
        .expose_headers([
            axum::http::header::ETAG,
            HeaderName::from_static("x-request-id"),
        ]);

    async fn attach_request_id(mut req: Request<Body>, next: middleware::Next) -> Response {
        let request_id = Uuid::new_v4();

        req.extensions_mut()
            .insert(audit::RequestContext { request_id });

        let mut res = next.run(req).await;
        let _ = res.headers_mut().insert(
            HeaderName::from_static("x-request-id"),
            HeaderValue::from_str(&request_id.to_string())
                .unwrap_or_else(|_| HeaderValue::from_static("invalid")),
        );
        res
    }

    async fn attach_api_security_headers(
        req: Request<Body>,
        next: middleware::Next,
    ) -> Response {
        let mut res = next.run(req).await;

        res.headers_mut().insert(
            HeaderName::from_static("x-content-type-options"),
            HeaderValue::from_static("nosniff"),
        );
        res.headers_mut().insert(
            HeaderName::from_static("x-frame-options"),
            HeaderValue::from_static("DENY"),
        );
        res.headers_mut().insert(
            HeaderName::from_static("referrer-policy"),
            HeaderValue::from_static("no-referrer"),
        );
        res.headers_mut().insert(
            HeaderName::from_static("content-security-policy"),
            HeaderValue::from_static(
                "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
            ),
        );

        res
    }

    let default_body_limit = axum::extract::DefaultBodyLimit::max(1 * 1024 * 1024);
    let import_body_limit = axum::extract::DefaultBodyLimit::max(10 * 1024 * 1024);

    let timeout =
        TimeoutLayer::with_status_code(StatusCode::REQUEST_TIMEOUT, Duration::from_secs(20));

    let global_concurrency_limit = ConcurrencyLimitLayer::new(200);
    let import_concurrency_limit = ConcurrencyLimitLayer::new(10);

    // -------------------------
    // Public API (NO AUTH)
    // -------------------------
    let public_api = Router::new()
        .route("/health", get(routes::health::health))
        .nest("/auth", routes::auth::router());

    // -------------------------
    // Protected API (AUTH REQUIRED)
    // -------------------------
    let protected_api = Router::new()
        .nest("/nodes", routes::nodes::router())
        .nest("/edges", routes::edges::router())
        .nest("/graph", routes::graph::router())
        .nest("/schema", routes::schema::router())
        .nest("/query", routes::query::router())
        .nest("/search", routes::search::router())
        .nest("/data-domains", routes::data_domains::router())
        .nest("/audit", routes::audit::router())
        .nest("/export", routes::export::router())
        .nest(
            "/imports",
            routes::imports::router()
                .layer(import_body_limit)
                .layer(import_concurrency_limit),
        )
        .nest("/claims", routes::claims::router())
        .nest("/node-claims", routes::node_claims::router())
        .route(
            "/metrics",
            get(move || async move { metric_handle.render() }),
        )
        .layer(middleware::from_fn_with_state(
            app_state.clone(),
            auth::require_auth_for_writes,
        ));

    // -------------------------
    // API root
    // -------------------------
    let api = Router::new()
        .merge(public_api)
        .merge(protected_api)
        .with_state(app_state.clone())
        .layer(middleware::from_fn(attach_api_security_headers));

    // -------------------------
    // Frontend
    // -------------------------
    let frontend = ServeDir::new("/app/frontend")
        .fallback(ServeFile::new("/app/frontend/index.html"));

    // -------------------------
    // App
    // -------------------------
    let app = Router::new()
        .nest("/api", api)
        .fallback_service(frontend)
        .layer(prometheus_layer)
        .layer(middleware::from_fn(attach_request_id))
        .layer(TraceLayer::new_for_http())
        .layer(timeout)
        .layer(default_body_limit)
        .layer(global_concurrency_limit)
        .layer(cors);

    tracing::info!("listening on {}", cfg.bind_addr);

    let listener = tokio::net::TcpListener::bind(&cfg.bind_addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
