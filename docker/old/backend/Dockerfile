# =========================
# Builder
# =========================
FROM rust:1.88-bookworm AS builder

WORKDIR /app

# Cache dependencies
COPY backend/Cargo.toml backend/Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm -rf src

# Build real binary
COPY backend/ ./
RUN cargo build --release --locked


# =========================
# Runtime
# =========================
FROM gcr.io/distroless/cc-debian12

WORKDIR /app

COPY --from=builder /app/target/release/infra_graph /app/infra_graph

USER nonroot:nonroot
EXPOSE 8080

# IMPORTANT PART:
# infra_graph is a CLI – we must tell it to run the server
ENTRYPOINT ["/app/infra_graph"]
CMD ["serve"]
