DROP INDEX IF EXISTS audit_log_actor_username_idx;

ALTER TABLE audit_log
    DROP COLUMN IF EXISTS actor_role,
    DROP COLUMN IF EXISTS actor_username;
