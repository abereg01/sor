CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    at TIMESTAMPTZ NOT NULL DEFAULT now(),

    actor_id UUID NULL,
    actor_type TEXT NOT NULL DEFAULT 'system',

    entity_type TEXT NOT NULL, -- node | edge
    entity_id UUID NOT NULL,

    action TEXT NOT NULL, -- create | patch | delete

    before JSONB,
    patch JSONB,
    after JSONB,

    correlation_id UUID,

    CHECK (
        action IN ('create', 'patch', 'delete')
    )
);

CREATE INDEX audit_log_entity_idx ON audit_log (entity_type, entity_id);
CREATE INDEX audit_log_time_idx ON audit_log (at);

