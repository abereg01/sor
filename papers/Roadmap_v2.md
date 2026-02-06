## Phase 2.0

## Phase 1 — Backups & Restore Verification

**Goal:** Operational safety.

### Scope
- Backup strategy documented:
  - Postgres
  - Evidence storage
- Perform and verify a full restore
- Write a short runbook
- Restore deleted nodes

### Acceptance
- Restore proven, not theoretical
- Incident response confidence

---

## Phase 2 - Keycloak 

**Goal:** Implement Keycloak for users 

### Scope 
- Connect Keycloak to app 
- Keep local rescue user 
- Make functions work with both Keycloak and local account 
- Let Keycloak determine if a user is admin or view only. 
- Phase 8

## ~~Phase 8 — Authentication & Roles~~

**Goal:** Enable safe multi-user operation.

### Scope
- Local rescue account in case of Keycloak being down. 
- OIDC via Keycloak
- Roles:
  - viewer
  - admin
- Backend-enforced permissions
- UI adapts to read-only mode
- Audit logs include identities

### Acceptance
- Unauthorized edits impossible
- Clear separation of responsibility
