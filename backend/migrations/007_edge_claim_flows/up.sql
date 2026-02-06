-- Edge claim flows
-- Describes semantic data flows attached to a specific claim
-- Append-only, auditable, claim-scoped

CREATE TABLE edge_claim_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    claim_id UUID NOT NULL
        REFERENCES edge_claims(id)
        ON DELETE CASCADE,

    -- Semantic meaning of the flow
    flow_type TEXT NOT NULL,
    -- Examples:
    -- flows_to
    -- stores_data
    -- sends_data_to
    -- receives_data_from

    -- What kind of data is involved (PII, logs, financial, etc.)
    data_category_id UUID NULL
        REFERENCES nodes(id),

    -- Optional technical context
    protocol TEXT NULL,
    frequency TEXT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_edge_claim_flows_claim_id
    ON edge_claim_flows (claim_id);

CREATE INDEX idx_edge_claim_flows_data_category_id
    ON edge_claim_flows (data_category_id);
