-- 015_node_claims/up.sql

CREATE TABLE IF NOT EXISTS node_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,

  source TEXT NOT NULL,
  confidence SMALLINT NOT NULL,

  status TEXT NOT NULL DEFAULT 'active',
  created_by TEXT NOT NULL DEFAULT 'system',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_verified_at TIMESTAMPTZ NULL,

  CHECK (confidence >= 0 AND confidence <= 100),
  CHECK (status IN ('active', 'needs_review', 'deprecated'))
);

CREATE INDEX IF NOT EXISTS idx_node_claims_node_id
  ON node_claims(node_id);

CREATE INDEX IF NOT EXISTS idx_node_claims_node_created_at
  ON node_claims(node_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_node_claims_status
  ON node_claims(status);

CREATE INDEX IF NOT EXISTS idx_node_claims_updated_at
  ON node_claims(updated_at DESC);

-- Only one "current" claim per node (active OR needs_review)
CREATE UNIQUE INDEX IF NOT EXISTS ux_node_claims_one_current_per_node
  ON node_claims(node_id)
  WHERE status IN ('active', 'needs_review');
