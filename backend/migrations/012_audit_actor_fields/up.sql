ALTER TABLE audit_log
    ADD COLUMN actor_username TEXT NULL,
    ADD COLUMN actor_role TEXT NULL;

CREATE INDEX IF NOT EXISTS audit_log_actor_username_idx ON audit_log (actor_username);
