# Production security audit (Phase 8.2A)

**Date:** 2026-10-31 (remediation pass)  
**Scope:** Code + configuration evidence in `icanova-monitoring-web`. No production deploy. No speculative CVEs without evidence.  
**Method:** Repository inspection, staging verification history, Convex prod/recovery env probe.

Severity: CRITICAL | HIGH | MEDIUM | LOW | INFORMATIONAL

---

## Findings

| ID | Severity | Finding | Evidence | Recommendation / disposition |
|---|---|---|---|---|
| S1 | **CRITICAL** (config) | Proposed production deployment `tremendous-sturgeon-449` has **no Convex environment variables** | `convex env list --deployment production` → empty | Hard gate: do not serve traffic until Auth + ingest (+ optional notify) env set and verified. **Do not copy staging secrets.** |
| S2 | **HIGH** | Shared `INGEST_SECRET` remains fleet-wide auth for ESP32/NCU1 | Dual-auth design; staging matrix keeps shared path | Keep until approved per-device cutover (`docs/guide/device-credential-migration-plan.md`); rotate if leaked; monitor `auth_failed` |
| S3 | **MEDIUM** | Production-sourced DR restore **not drilled** (staging isolated restore **VERIFIED** on `vivid-mosquito-28`) | `docs/guide/backup-restore-verification.md` §6 | Run prod-sourced empty-recovery drill before claiming prod DR, or accept residual risk in writing |
| S4 | **MEDIUM** | No CI/CD workflows; deploy is fully manual | No `.github/workflows` | **Accepted residual risk** for v1: operator runbook discipline (`docs/guide/production-deployment-runbook.md`); optional future CI |
| S5 | **MEDIUM** | SPA stores access token in `sessionStorage` | `src/platform/bearer.ts` | **Accepted residual risk** with mitigations: XSS would expose bearer; keep CSP/deps clean; short Auth0 token TTL; no refresh-token in SPA |
| S6 | **MEDIUM** | SMS (Arkesel) has no provider idempotency key | `convex/notify.ts` / `notifyDelivery.ts` | **Accepted residual risk**: treat uncertain timeouts as possible duplicates; prefer email (Resend) for critical alerts; avoid blind SMS retry storms |
| S7 | **MEDIUM** | Ingest IP rate limit trusts `X-Forwarded-For` / `CF-Connecting-IP` | `convex/http.ts` `ipKeyFromRequest` | **Accepted residual risk**: spoofing weakens IP bucket only; device identity bucket still applies |
| S8 | **LOW → CLOSED** | Code default audience fallback `dse-gateway` | Removed 2026-10-31 | `auth.config.ts` requires `AUTH_JWT_AUDIENCE`; `readOidcConfig` requires `VITE_OIDC_AUDIENCE` (null if missing) |
| S9 | **LOW** | Production Auth0 tenant not provisioned in-repo | Staging Auth0 only | Separate prod SPA + API; never copy staging client secrets |
| S10 | **INFORMATIONAL** | Frontend hosting undecided | No `vercel.json` / CI | Operator chooses static HTTPS host — see hosting checklist in `docs/guide/production-environment-setup.md` |
| S11 | **INFORMATIONAL** | Lab self-hosted JWKS pattern still documented for offline mint | `.jwt/` gitignored | Prod should use Auth0 JWKS only |
| S12 | **INFORMATIONAL** | Hardware/SIM/RS485 not in software threat model for this audit | Hardware ATP separate | Do not claim physical security from this audit |

---

## Controls that are in good shape (evidence)

| Control | Status | Evidence |
|---|---|---|
| Access-token-only Convex bearer | VERIFIED IN STAGING | `selectConvexBearer`; Auth0 `aud=icanova` → `/me` |
| Fail-closed audience (no lab default) | VERIFIED (code) | `auth.config.ts`, `oidc.ts` + unit tests |
| Backend `requirePermission` (not UI-only) | VERIFIED IN STAGING / local | Ops section ACL tests; foreign-org denial |
| Credential hashes never returned | VERIFIED IN STAGING | Device-cred HTTP matrix |
| Inactive device rejection | VERIFIED IN STAGING | HTTP 403 |
| Ingest body size limit | READY FOR PRODUCTION (code) | `INGEST_MAX_BODY` 8 KiB |
| Device + IP rate limits | READY FOR PRODUCTION (code) | Defaults + env overrides |
| Ingest order / idempotent cursor | READY FOR PRODUCTION (code) | `order.ts` + `ingestCursors` |
| Isolated restore drill | VERIFIED | `vivid-mosquito-28`; recovery quarantined (no notify) |
| Env profile validator | READY FOR PRODUCTION (tooling) | `scripts/validate-env-profile.mjs` (dev/staging/recovery/production) |

---

## Counts (after remediation)

| Severity | Open | Closed / accepted residual |
|---|---|---|
| CRITICAL | 1 (empty prod env — expected pre-provision) | — |
| HIGH | 1 (shared ingest) | Restore drill closed as MEDIUM/prod-sourced |
| MEDIUM | 1 open (prod DR) + 4 accepted residual (CI, sessionStorage, SMS idempotency, IP header) | — |
| LOW | 1 (prod Auth0) | S8 closed |
| INFORMATIONAL | 3 | — |
