# Living Infrastructure Graph
## System of Record for IT Relationships & Data Flows

---

## 0) Core vision

This system models our IT environment as a **directed graph**, but **the graph UI is not the product**.

The product is:

> **Trusted, explainable, auditable truth about relationships in our IT environment.**

### Graph model

- **Nodes** = entities  
  (systems, services, databases, hosts, vendors, teams, apps, containers, data categories, external dependencies, etc.)

- **Edges** = relationships  
  (`depends_on`, `runs_on`, `stores_data`, `flows_to`, `owned_by`, `external_dependency`, etc.)

### Core principle: *“Claims are the truth”*

- Edges are **structural only**
- **Truth lives in append-only claims** attached to edges
- Claims represent *assertions*, not facts carved in stone

Every relationship must be able to answer:

- **Who says this is true?** → `created_by`
- **Why do we believe it?** → `source` (+ evidence)
- **How sure are we?** → `confidence`
- **When was it last verified?** → `last_verified_at`
- **Is it current or questionable?** → `status`

The system explicitly supports **soft truth**  
(`confidence`, `needs_review`) instead of binary true/false.

---

## 1) Hard constraints (never violated)

- One phase at a time
- Each phase ends with:
  - working backend
  - working frontend (if applicable)
  - acceptance checks
- **No Grafana integration yet**
- **No auto-discovery until Phase 6**
- Prefer **Swedish UI**, **English code & discussion**

### Backend
- Rust + Axum
- SQLx + PostgreSQL
- Manual migrations (`psql -f`)
- Optimistic locking (ETags / `If-Match`)
- Audit logging exists and must not break

### Frontend
- React + TypeScript
- D3 for graph rendering
- UI-first workflows (no curl-based usage)
- **POST FULL FILES ONLY** when changing code

---

## 2) Phase 1 — Claims Core ✅ DONE

### Delivered

- `edge_claims` table (append-only)
- Partial unique index:
  - at most **one** `active` / `needs_review` claim per edge
- Endpoints:
  - `POST /edges/:id/claims`
    - auto-deprecates previous current claim
  - `GET /edges/:id/claims` (full history)
  - `GET /edges/:id`
    - includes `current_claim`
- `created_by` sourced from `X-Request-Id` (auth postponed)

### Guarantees

- No regressions in:
  - edge CRUD
  - ETags
  - merge-patch semantics

---

## 2.1) Phase 1.1 — Acceptance checks ✅ DONE

Verified end-to-end:

- create edge
- add claim #1
- add claim #2 → claim #1 deprecated
- list history
- fetch edge with `current_claim`
- ETag behavior intact

---

## 2.2) Phase 1.2 — Needs Review API ✅ DONE

- Endpoint: `GET /edges/needs-review`
- Definition:
  - `status = needs_review`
  - OR `confidence < threshold`
  - OR `last_verified_at IS NULL`
- Returns:
  - edges + current_claim

Purpose: surface *uncertain truth* for human review.

---

## 3) Phase 2 — UX humans can actually use ✅ DONE

### 2A — Sidebar foundations ✅  
### 2B — Koppling (Quick Connect) ✅  
### 2C — Guided fields everywhere ✅

### Backend alignment

- `/graph` returns:
  - D3-safe ids
  - per-edge `etag`
- Delete operations require `If-Match`

### Outcome

Non-developers can:

- add nodes
- connect systems
- remove incorrect relations
- edit structured metadata

…without knowing JSON, claims, audit logs, or backend internals.

---

## 4) Phase 3 — Evidence & audit value ✅ DONE

### Phase 3A — Evidence on claims ✅

- `edge_claim_evidence` table (append-only)
- Evidence attached at claim creation
- Backend returns evidence for:
  - current claims
  - historical claims
- UI intentionally does **not** surface evidence yet

### Phase 3B — Audit UI  
⏸ Deferred (explicitly not done)

---

## 5) Phase 5 — Killer queries ✅ DONE / MOSTLY DONE

### Implemented

- **5.0A** Blast radius ✅
- **5.0B** Bidirectional relationship visibility  
  (UI semantic mirroring) ✅
- **5.0C** Dependents ✅
- **5.0D** Needs-review propagation  
  (with human-readable reasons) ✅
- **5.0E** Vendor exposure  
  (`external_dependency` edge kind + query) ✅

---

## 6) Phase 5.5 — Data flow semantics & visualization ✅ DONE

### Phase 5.5A — Flow semantics on claims ✅

- `edge_claim_flows` table (append-only)
- Flows belong to claims
- Claim creation can insert flows
- Claim reads return flows (current + history)

#### Backend behavior (confirmed)

- `/graph` includes:
  - `links[].current_claim_id`
  - `links[].flows`
- Current claim selection:
  - latest of (`active`, `needs_review`)
- Flow fetch is batched

#### Default flow policy (non-negotiable)

> **A connection implies a flow**

If an edge has:
- no current claim **and/or**
- no explicit flows  

→ API still returns **one implicit flow**:

- `flow_type`: `"data_flow"`
- `frequency`: `"continuous"`
- `direction`: inferred (`source → target`)
- `data_category_id`: `null`
- `implicit`: `true`

---

### Phase 5.5B — Visualization ✅

- Global flow overlay (all edges)
- Animated direction (marching dashes)
- Frequency via dash pattern + speed
- Stable color per data category
- Hover tooltips
- Swedish **Datatrafik** panel
- Filters: direction, category, type
- Click-to-filter
- Bidirectional flows rendered as parallel lanes

Acceptance verified in UI.

---

## 7) Phase 6 — Import & reconciliation ✅ DONE (initial scope)

### Key decision

- **Database + UI are the System of Record**
- Excel is **offline-only**, never live-synced

Workflow:
1. Export snapshot
2. Edit offline (Excel / CSV / JSON)
3. Import as **proposals**
4. Humans approve / reject

---

### Phase 6A — Import batches & proposals ✅

- `import_batches` table
- Proposal claims use `status = needs_review`
- UI Inbox for review
- Optimistic locking preserved

---

### Phase 6B — Approve / Reject reconciliation ✅

- UI-first workflow
- Side-by-side compare: proposal vs published truth
- Approve → new active claim
- Reject → proposal retired
- Evidence + flows copied on approval
- Audit log intact

---

### Phase 6C — Export (Excel support) ✅

- Deterministic JSON snapshot
- CSV exports:
  - nodes
  - edges
  - current claims
  - current flows (incl. implicit)
- Flat sidebar UI for export

---

## 8) Current state summary

- Claims are authoritative
- Flows are first-class
- Soft truth is explicit
- Humans reconcile uncertainty
- Excel users supported without undermining SoR
- UI is the operational interface
- Audit + optimistic locking preserved
- No auth yet (intentional)

---

## 19) Phase 19 — Containerization ✅ DONE

### Why

We closed the gap between “it runs” and “we can ship it repeatedly”.

The goal was **boring, reproducible delivery**:

- same images in dev/prod
- no environment-specific image forks
- CI blocks deploys if build/tests fail
- external database only (no Postgres container)

### What changed

- Added a canonical **`docker/`** packaging layout:
  - `docker/backend/Dockerfile` (Rust API, distroless runtime)
  - `docker/frontend/Dockerfile` (static UI, unprivileged nginx, `/api` reverse proxy)
  - `docker/docker-compose.yml` for Docker-first validation
- Reworked `./release.sh` to be the **single pipeline entrypoint**:
  - runs containerized build/test gates (backend tests + frontend build)
  - builds both service images
  - supports local builds (`--load`) and multi-arch registry builds (`PUSH=1`)
  - deterministic tagging: SemVer + `sha-<git>` (plus major/minor/latest convenience tags)
- Added CI workflow that calls `./release.sh` and fails fast on any errors.

### Guarantees we now have

- **Reproducibility:** same commit + same VERSION ⇒ same image outputs
- **Portability:** images run on plain Docker, and are ready for Swarm/Traefik and Kubernetes
- **No baked secrets:** all configuration via environment variables
- **External DB only:** backend connects via `DATABASE_URL` from `backend/.env`
