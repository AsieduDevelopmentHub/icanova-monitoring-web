# Phase 8.2A — Production architecture & security acceptance

**Date:** 2026-10-31  
**Status:** **AUDIT COMPLETE — NO PRODUCTION DEPLOYMENT**  
**Phase 8.1 dependency:** Staging restore drill **VERIFIED** (`vivid-mosquito-28`); prod-sourced DR still open  
**Proposed prod Convex:** `tremendous-sturgeon-449` — **env empty** as of audit

Classifications: VERIFIED IN STAGING | READY FOR PRODUCTION | OPERATOR CONFIGURATION REQUIRED | IMPLEMENTATION REQUIRED | BLOCKED | NOT APPLICABLE | NOT VERIFIED

---

## Deliverables map

| Doc | Purpose |
|---|---|
| `docs/production-environment-setup.md` | Three-env design + variable split |
| `docs/production-security-audit.md` | Findings by severity |
| `docs/production-deployment-runbook.md` | Deploy / smoke / rollback (do not execute) |
| `docs/device-credential-migration-plan.md` | Controlled fleet migration |
| `docs/production-backup-recovery-plan.md` | Prod DR requirements |
| This file | Acceptance matrix |

---

## 1. Environment & architecture

| Requirement | Classification | Notes |
|---|---|---|
| Dev / staging / prod separation | READY FOR PRODUCTION (design) | kangaroo / roadrunner / sturgeon |
| Prod target identity | OPERATOR CONFIGURATION REQUIRED | `tremendous-sturgeon-449` exists; **0 env vars** |
| Hosting platform | OPERATOR CONFIGURATION REQUIRED | Not Vercel-assumed; static HTTPS |
| CI/CD | IMPLEMENTATION REQUIRED (optional) | No workflows today |
| Rollback commands | READY FOR PRODUCTION (docs) | Runbook §10 |

## 2. Auth0 production

| Requirement | Classification | Notes |
|---|---|---|
| Staging Auth0 `icanova` | VERIFIED IN STAGING | Do not copy secrets |
| Prod tenant/app/API | OPERATOR CONFIGURATION REQUIRED | Separate from staging |
| Access-token-only bearer | VERIFIED IN STAGING | Preserve in prod |
| Issuer / JWKS / aud / callbacks | OPERATOR CONFIGURATION REQUIRED | Exact values from Auth0 console |
| Token TTL / key rotation | NOT VERIFIED | Operator Auth0 settings |
| Org membership process | IMPLEMENTATION REQUIRED (ops) | Invite/role runbook |

## 3. Convex production

| Requirement | Classification | Notes |
|---|---|---|
| Schema / HTTP / crons | READY FOR PRODUCTION (code) | Same codebase as staging |
| Prod secrets set | BLOCKED | Empty env on sturgeon |
| Pre/post smoke | READY FOR PRODUCTION (docs) | Runbook |
| Migrations | READY FOR PRODUCTION (policy) | Additive / dry-run |

## 4. Ingestion security

| Requirement | Classification | Notes |
|---|---|---|
| Dual-auth + matrix | VERIFIED IN STAGING | Keep shared secret |
| Rate / size limits | READY FOR PRODUCTION (code) | |
| Order / cursors | READY FOR PRODUCTION (code) | Replay/idempotency at batch level |
| Fleet migration | IMPLEMENTATION REQUIRED | Plan documented; not executed |
| Cutover remove shared secret | BLOCKED | Needs approval post-migration |

## 5. Notifications

| Requirement | Classification | Notes |
|---|---|---|
| Resend/Arkesel code paths | READY FOR PRODUCTION (code) | |
| Prod provider credentials | OPERATOR CONFIGURATION REQUIRED | |
| `TEST_NOTIFY_*` in prod | NOT APPLICABLE | Must stay unset |
| Controlled test send | BLOCKED | Needs authorization |
| SMS idempotency | NOT VERIFIED / MEDIUM risk | See security audit S6 |

## 6. Backup & DR

| Requirement | Classification | Notes |
|---|---|---|
| Staging restore drill | VERIFIED | `vivid-mosquito-28` — see backup-restore-verification §6 |
| Prod backup schedule | OPERATOR CONFIGURATION REQUIRED | |
| Artifact validation tooling | READY FOR PRODUCTION (code) | `backupArtifact.ts` |
| Claimed RPO/RTO | Staging measured; prod NOT VERIFIED | See §6 evidence |

## 7. Monitoring & ops

| Requirement | Classification | Notes |
|---|---|---|
| Section ACL | VERIFIED IN STAGING | |
| Health / freshness / ingest ops | READY FOR PRODUCTION (code) | Distinguish online/Modbus/freshness in product model |
| Auth failure monitoring dashboards | NOT VERIFIED | Counters exist; alerting operator-owned |
| Hardware Modbus/SIM field proof | NOT APPLICABLE | Hardware ATP |

## 8. Security findings summary

See `docs/production-security-audit.md`.

| Severity | Count (this audit) |
|---|---|
| CRITICAL | 1 (empty prod env) |
| HIGH | 1 (shared ingest) |
| MEDIUM | 5 (includes prod-sourced DR open) |
| LOW | 2 |
| INFORMATIONAL | 3 |

## 9. Deployment readiness

| Item | Classification |
|---|---|
| Runbook complete | READY FOR PRODUCTION (docs) |
| Execute prod deploy | BLOCKED |

## 10. Operator actions (ordered)

1. Quarantine recovery `vivid-mosquito-28`; schedule prod-sourced DR drill **or** accept residual prod DR risk in writing.  
2. Choose production SPA host + TLS.  
3. Create production Auth0 SPA + API; set callbacks.  
4. Set Convex prod env on approved deployment (never clone staging values).  
5. Build SPA with prod `VITE_*`; smoke Auth + ingest.  
6. Written approval → follow `docs/production-deployment-runbook.md`.  
7. Plan device credential batches per migration plan (no mass cutover yet).  

## 11. Hardware boundary

No ESP32 / RS485 / DSE / SIM verification in Phase 8.2A.
