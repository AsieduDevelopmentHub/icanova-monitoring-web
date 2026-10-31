# Phase 8.2 — Production infrastructure & security acceptance (preparation)

**Date:** 2026-10-31  
**Status:** **PREPARATION ONLY — NO PRODUCTION DEPLOYMENT**  
**Depends on:** Phase 8.1 software gates (done). Staging restore drill still open.

Statuses: VERIFIED IN STAGING | READY FOR PRODUCTION | OPERATOR CONFIGURATION REQUIRED | NOT VERIFIED | BLOCKED | NOT APPLICABLE

---

## 1. Authentication

| Item | Status | Notes |
|---|---|---|
| Staging Auth0 `icanova` | VERIFIED IN STAGING | Do **not** copy staging secrets to production |
| Production Auth0 tenant | OPERATOR CONFIGURATION REQUIRED | Separate tenant or prod app recommended |
| Production issuer / JWKS / audience | OPERATOR CONFIGURATION REQUIRED | Confirm `aud` (likely still `icanova` if same API brand) |
| Production redirect / logout URIs | OPERATOR CONFIGURATION REQUIRED | Production SPA origins only |
| Token TTL / key rotation | NOT VERIFIED | Document Auth0 rotation procedure |
| Session handling | VERIFIED IN STAGING | SPA bearer in sessionStorage; logout clears |
| Org membership bootstrap | VERIFIED IN STAGING | Need production invite/role procedure |

---

## 2. Convex production

| Item | Status | Notes |
|---|---|---|
| Existing deploy `tremendous-sturgeon-449` | NOT APPLICABLE as staging | Treat as production candidate only after gates |
| Production env vars | OPERATOR CONFIGURATION REQUIRED | Distinct `INGEST_SECRET`, Auth0 `AUTH_*`, Resend/Arkesel |
| Deploy / rollback procedure | OPERATOR CONFIGURATION REQUIRED | Checklist before any push |
| Execute production deploy | BLOCKED | Explicit authorization required |

---

## 3. Frontend hosting

| Item | Status | Notes |
|---|---|---|
| Vercel | NOT APPLICABLE | Not configured in repo |
| Hosting choice | OPERATOR CONFIGURATION REQUIRED | Vercel / other / existing |
| Production `VITE_*` only | READY FOR PRODUCTION (pattern) | Never put secrets in `VITE_*` |

---

## 4. Ingestion security

| Item | Status | Notes |
|---|---|---|
| Dual-auth + shared secret | VERIFIED IN STAGING | Keep shared secret until fleet cutover |
| Per-device credentials | VERIFIED IN STAGING | HTTP matrix |
| Rate / body limits | VERIFIED IN STAGING (code) | Confirm prod env overrides if any |
| Fleet-wide migration | BLOCKED | Controlled plan only; no auto migration |
| Replay protection | NOT VERIFIED | Audit idempotency / cursors for prod write-up |

---

## 5. Notifications

| Item | Status | Notes |
|---|---|---|
| Lab Resend / TEST_NOTIFY | VERIFIED IN STAGING (config) | Not a production send proof |
| Production email/SMS credentials | OPERATOR CONFIGURATION REQUIRED | Sandbox first |
| Live prod notify send | BLOCKED | Needs authorization |

---

## 6. Backup & recovery

| Item | Status | Notes |
|---|---|---|
| Staging restore drill | BLOCKED | Prerequisite for claiming prod DR |
| Prod backup schedule / retention | OPERATOR CONFIGURATION REQUIRED | |
| Secret reconstruction outside ZIP | READY FOR PRODUCTION (pattern) | Documented in DR docs |

---

## 7. Monitoring & ops ACL

| Item | Status | Notes |
|---|---|---|
| Section ACL | VERIFIED IN STAGING / local | Keep backend `requirePermission` |
| Ingest / gateway / job health | VERIFIED IN STAGING (code paths) | Confirm prod dashboards / alerts |
| Auth failure metrics | NOT VERIFIED | |

---

## 8. Deployment safety (do not execute)

Prepare before any production push:

1. Env verification checklist (Auth, ingest, notify)  
2. Staging smoke replay  
3. Rollback: previous Convex deploy + previous SPA artifact  
4. Post-deploy: `/me`, ingest 401 without secret, one synthetic device  
5. Incident criteria to roll back  

---

## 9. Hardware boundary

ESP32 / RS485 / DSE / field SIM behavior remain **NOT VERIFIED** here — separate hardware ATP.

---

## 10. Operator actions to start Phase 8.2 execution

1. Complete staging restore drill (close Phase 8.1 fully).  
2. Choose production SPA host.  
3. Provision production Auth0 app + API (`icanova` or prod identifier).  
4. Set production Convex env (never clone staging secrets).  
5. Written approval before first production deploy.
