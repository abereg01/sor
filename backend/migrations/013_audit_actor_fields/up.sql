ALTER TABLE audit_log
    ADD COLUMN IF NOT EXISTS actor_username TEXT;

ALTER TABLE audit_log
    ADD COLUMN IF NOT EXISTS actor_role TEXT;

CREATE INDEX IF NOT EXISTS audit_log_actor_username_idx ON audit_log (actor_username);
