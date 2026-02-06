-- 016_claims_rejected_status/down.sql

-- Revert claim status set to the original set without 'rejected'.

ALTER TABLE edge_claims
  DROP CONSTRAINT IF EXISTS edge_claims_status_check;

ALTER TABLE edge_claims
  ADD CONSTRAINT edge_claims_status_check
  CHECK (status IN ('active', 'needs_review', 'deprecated'));

ALTER TABLE node_claims
  DROP CONSTRAINT IF EXISTS node_claims_status_check;

ALTER TABLE node_claims
  ADD CONSTRAINT node_claims_status_check
  CHECK (status IN ('active', 'needs_review', 'deprecated'));
