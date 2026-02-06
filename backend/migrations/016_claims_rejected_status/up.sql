-- 016_claims_rejected_status/up.sql

-- Allow 'rejected' as a first-class claim status.
-- This is required so rejection can persist (non-destructive) without abusing 'deprecated'.
-- The partial unique indexes remain scoped to ('active', 'needs_review').

ALTER TABLE edge_claims
  DROP CONSTRAINT IF EXISTS edge_claims_status_check;

ALTER TABLE edge_claims
  ADD CONSTRAINT edge_claims_status_check
  CHECK (status IN ('active', 'needs_review', 'deprecated', 'rejected'));

ALTER TABLE node_claims
  DROP CONSTRAINT IF EXISTS node_claims_status_check;

ALTER TABLE node_claims
  ADD CONSTRAINT node_claims_status_check
  CHECK (status IN ('active', 'needs_review', 'deprecated', 'rejected'));
