-- 005_edge_claims/up.sql

CREATE TABLE IF NOT EXISTS edge_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  edge_id UUID NOT NULL REFERENCES edges(id) ON DELETE CASCADE,

  source TEXT NOT NULL,
  confidence SMALLINT NOT NULL,

  status TEXT NOT NULL DEFAULT 'active',
  created_by TEXT NOT NULL DEFAULT 'system',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_verified_at TIMESTAMPTZ NULL,

  CHECK (confidence >= 0 AND confidence <= 100),
  CHECK (status IN ('active', 'needs_review', 'deprecated'))
);

CREATE INDEX IF NOT EXISTS idx_edge_claims_edge_id
  ON edge_claims(edge_id);

CREATE INDEX IF NOT EXISTS idx_edge_claims_edge_created_at
  ON edge_claims(edge_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_edge_claims_status
  ON edge_claims(status);

-- Only one "current" claim per edge (active OR needs_review)
CREATE UNIQUE INDEX IF NOT EXISTS ux_edge_claims_one_current_per_edge
  ON edge_claims(edge_id)
  WHERE status IN ('active', 'needs_review');

