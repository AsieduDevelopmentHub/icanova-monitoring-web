# Production / staging operations runbook (Phase 8.2E)

**Date:** 2026-10-31  
**Scope:** Operator response for software/cloud issues. Hardware bench procedures: `docs/guide/hardware-acceptance-test-plan.md`.  
**Authority:** Backend `requirePermission` is authoritative — UI hiding is not access control.

Never paste secrets into tickets. Prefer Ops ACL sections the caller is entitled to see.

---

## State model (do not conflate)

| Observation | Means | Does **not** mean |
|---|---|---|
| Gateway offline / no heartbeat | Connectivity or device down | Generator stopped |
| Modbus / link fail | RS485/DSE path unhealthy | Generator stopped |
| Telemetry stale | Freshness threshold exceeded | Value is zero |
| Telemetry unavailable / null quality | No trustworthy sample | Treat as 0 |
| Generator stopped / running | From DSE operating fields when present | Inferred from gateway alone |

Unavailable telemetry must never be rendered or stored as zero.

---

## Incident playbooks

### 1. Gateway offline
1. Confirm last heartbeat / contact in device health.  
2. Check site power/network/SIM (field).  
3. Confirm ingest URL/host for that environment.  
4. Do not open generator “stopped” alarms from offline alone.

### 2. Modbus communication failure
1. Diagnostics: CRC/timeouts vs gateway online.  
2. Check A/B polarity, baud, termination (hardware ATP).  
3. Keep gateway-online separate from link-fail in operator notes.

### 3. Stale telemetry
1. Confirm gateway heartbeat still fresh.  
2. If heartbeat OK + stale readings → Modbus/controller path.  
3. If both stale → treat as connectivity first.

### 3b. Telemetry unavailable / null quality
1. Treat as **no trustworthy sample** — never coerce to zero in UI or storage.  
2. Confirm decoder/quality flags; distinguish unavailable vs zero reading.  
3. Do not raise “generator stopped” from null alone.

### 3c. Generator stopped / running / unknown
1. Use DSE operating-mode / engine fields when present and fresh.  
2. **Unknown** when fields missing, stale, or quality bad — show unknown, do not invent.  
3. Never infer generator state from gateway online/offline or network alone.

### 4. Ingestion authentication failure
1. Ops ingest counters: `auth_failed` spike.  
2. Confirm environment (`INGEST_URL` + secret) matches Convex deployment.  
3. If device-cred path: rotation/revoke/inactive.  
4. Rotate shared secret only with fleet coordination.

### 5. Rate limiting (429)
1. Identify identity vs IP bucket.  
2. Check collector retry storms.  
3. Temporary limit increase is a last resort (env) — prefer fix source.

### 6. Device credential failure
1. `hasIngestCredential` true?  
2. Shared secret still works? (fallback)  
3. Re-provision or `clearIngestCredential` + shared path.  
4. See `docs/guide/device-credential-migration-plan.md`.

### 7. Notification provider outage
1. Outbox / dispatch status in notifications Ops section.  
2. Resend/Arkesel dashboards.  
3. Uncertain SMS may duplicate on retry — avoid blind resend storms.  
4. Do not enable prod sends without authorization.

### 8. Convex deployment issue
1. Dashboard status; recent deploy revision.  
2. Rollback functions per `docs/guide/production-deployment-runbook.md`.  
3. Schema writes are not rolled back by function rollback.

### 9. Auth0 login issue
1. Callback/origin allowlists for the SPA host.  
2. API audience authorization for the SPA client.  
3. Confirm access token `aud` matches Convex `AUTH_JWT_AUDIENCE`.  
4. Never accept `id_token` as Convex bearer.

### 10. Failed background jobs
1. Crons: telemetry prune, health sweep, rate-limit prune (`convex/crons.ts`).  
2. Job status / Ops jobs section (permissioned).  
3. Redeploy matching revision if code stuck; avoid duplicate global scanners.

### 11. Backup failure
1. Retry Backup Now; check plan limits.  
2. Off-platform copy of last good ZIP.  
3. Escalate — DR depends on viable backups (`docs/guide/production-backup-recovery-plan.md`).

### 12. Suspected tenant access violation
1. Preserve audit logs.  
2. Confirm membership/role for subject.  
3. Revoke sessions (Auth0) / remove membership.  
4. Do not weaken ACL to “unblock” the user.

### 13. Rate limiting (ops view)
See §5. Confirm which bucket (device vs IP) before raising limits.

### 14. Notification failure
See §7. Prefer email for critical paths; SMS may duplicate under timeout.

### 15. Backup failure
See §11. Quarantined recovery (`vivid-mosquito-28`) is evidence only — not a live failover target for writers.

---

## Diagnostics hygiene

Ops/diagnostics must not display: ingest secrets, JWT/PEM material, provider API keys, raw bearer tokens, or full credential hashes.
