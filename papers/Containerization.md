# Containerization (Phase 19)

This repo ships **two container images**:

- **Backend** (Rust API): `infra_graph-backend`
- **Frontend** (static UI + reverse proxy): `infra_graph-frontend`

The database is **external** (no Postgres container). The backend reads connection details from environment variables (typically via `backend/.env`).

## Canonical build command

Always build through:

```sh
./release.sh
```

This script is the single entrypoint for:

- running containerized build/test gates
- producing reproducible images
- tagging images deterministically (SemVer + git SHA)

## Docker → Swarm → Kubernetes

The images are designed to behave the same everywhere:

1) **Docker (local validation)** — use `docker/docker-compose.yml`  
2) **Docker Swarm + Traefik** — re-use the same images (no rebuilds)  
3) **Kubernetes** — images are already compatible (non-root frontend, config via env)

Swarm/Kubernetes are orchestration layers; they must not change image definitions.

## Local Docker validation

Prerequisites:

- A reachable PostgreSQL instance
- `backend/.env` configured with required variables:
  - `DATABASE_URL`
  - `LOCAL_ADMIN_USERNAME`
  - `LOCAL_ADMIN_PASSWORD`
  - `AUTH_JWT_SECRET`

Build images locally:

```sh
./release.sh
```

Run:

```sh
docker compose -f docker/docker-compose.yml up -d
```

Open:

- UI: `http://localhost:8080`
- API: `http://localhost:8080/api/...` (proxied to backend)

Notes:

- The frontend proxies `/api/*` to the backend service (`backend:8080`) to keep the UI same-origin.
- For local runs, ensure `CORS_ORIGINS` includes `http://localhost:8080`.

## CI behavior

CI must fail fast:

- backend: `cargo test`
- frontend: `npm run build`

The CI job calls `./release.sh` in **DRY_RUN** mode, so it builds and tests without pushing.

## Production configuration

- No secrets are baked into images.
- All configuration is provided via environment variables.
- Backend defaults `BIND_ADDR=0.0.0.0:8080`, but required secrets must be provided.

## Kubernetes readiness checklist (future)

- Backend listens on `0.0.0.0`
- Frontend runs unprivileged (port 8080)
- Health endpoint: `/healthz` (frontend) — backend health should be handled by an API route (or a TCP check)
