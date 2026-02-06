# =========================
# Frontend build
# =========================
FROM node:20-bookworm AS frontend-builder
WORKDIR /frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ .
RUN npm run build


# =========================
# Backend build
# =========================
FROM rust:1.88-bookworm AS backend-builder
WORKDIR /backend

COPY backend/Cargo.toml backend/Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm -rf src

COPY backend/ .
RUN cargo build --release --locked


# =========================
# Runtime (distroless)
# =========================
FROM gcr.io/distroless/cc-debian12:nonroot

WORKDIR /app

# backend binary
COPY --from=backend-builder /backend/target/release/infra_graph /app/infra_graph

# frontend assets (served by backend / reverse proxy)
COPY --from=frontend-builder /frontend/dist /app/frontend

# distroless runs as nonroot by default
EXPOSE 8080

ENTRYPOINT ["/app/infra_graph"]
