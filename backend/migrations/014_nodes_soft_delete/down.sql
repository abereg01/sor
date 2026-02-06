DROP INDEX IF EXISTS idx_nodes_deleted_at;

ALTER TABLE nodes
DROP COLUMN IF EXISTS deleted_at,
DROP COLUMN IF EXISTS deleted_by;
