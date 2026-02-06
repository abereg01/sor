-- Enforce data integrity at the DB layer.
-- Note: if you already have duplicates, this migration will fail.
-- For MVP/early-stage, that's desirable (forces cleanup).

-- Nodes: prevent duplicates by (kind, name)
CREATE UNIQUE INDEX IF NOT EXISTS ux_nodes_kind_name
ON nodes(kind, name);

-- Edges: prevent duplicates by (from_id, to_id, kind)
CREATE UNIQUE INDEX IF NOT EXISTS ux_edges_from_to_kind
ON edges(from_id, to_id, kind);

