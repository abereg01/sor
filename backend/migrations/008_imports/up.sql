-- 008_imports/up.sql
-- Phase 6 — Import & reconciliation (human-truth-first)

-- Groups imported proposal claims into a single auditable batch.
CREATE TABLE IF NOT EXISTS import_batches (
    id UUID PRIMARY KEY,

    -- Source system identifier, e.g. "excel", "fortigate", ...
    source TEXT NOT NULL,

    -- Request correlation id (auth is deferred; created_by is request id)
    created_by TEXT NOT NULL,

    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ NULL,

    -- Optional context such as sheet name, snapshot time, device id, etc.
    metadata JSONB NULL
);

CREATE INDEX IF NOT EXISTS idx_import_batches_source_started
    ON import_batches (source, started_at DESC);

-- Link edge claims to an import batch (NULL means human-created claim).
ALTER TABLE edge_claims
    ADD COLUMN IF NOT EXISTS import_batch_id UUID NULL
        REFERENCES import_batches(id)
        ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_edge_claims_import_batch_id
    ON edge_claims (import_batch_id);

-- Claims also need optimistic locking for approve/reject.
-- We add updated_at and keep it explicit in UPDATE statements.
ALTER TABLE edge_claims
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_edge_claims_updated_at
    ON edge_claims (updated_at DESC);

