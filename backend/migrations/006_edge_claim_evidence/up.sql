BEGIN;

-- -------------------------------------------------------------------
-- Edge Claim Evidence
--
-- Evidence references that explain *why* a claim is believed to be true.
--
-- Design principles:
-- - Evidence is attached to claims, not edges
-- - Append-only by nature (claims are immutable)
-- - Optional: claims may exist without evidence
-- - Structured, but flexible for audits
-- -------------------------------------------------------------------

CREATE TABLE edge_claim_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Owning claim
    claim_id UUID NOT NULL
        REFERENCES edge_claims(id)
        ON DELETE CASCADE,

    -- Type of evidence (kept TEXT for future extensibility)
    evidence_type TEXT NOT NULL,

    -- Identifier or reference (ticket ID, URL, rule ID, document ref, etc.)
    reference TEXT NOT NULL,

    -- Optional human note / explanation
    note TEXT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constrain known evidence types, but allow extension via migration
    CHECK (evidence_type IN (
        'ticket',
        'url',
        'contract',
        'firewall_rule',
        'document',
        'other'
    ))
);

-- Fast lookup of evidence per claim
CREATE INDEX idx_edge_claim_evidence_claim_id
    ON edge_claim_evidence(claim_id);

-- Optional filtering / grouping by evidence type
CREATE INDEX idx_edge_claim_evidence_evidence_type
    ON edge_claim_evidence(evidence_type);

COMMIT;

