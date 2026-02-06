ALTER TABLE edges
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill existing rows (in case column existed without default in early experiments)
UPDATE edges SET updated_at = COALESCE(updated_at, created_at, now());

CREATE INDEX IF NOT EXISTS idx_edges_updated_at ON edges(updated_at);

