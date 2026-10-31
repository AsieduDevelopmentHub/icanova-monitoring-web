# Production security audit (Phase 8.2A)

**Date:** 2026-10-31  
**Scope:** Code + configuration evidence in `dse-gateway-web`. No production deploy. No speculative CVEs without evidence.  
**Method:** Repository inspection, staging verification history, Convex prod env probe.

Severity: CRITICAL | HIGH | MEDIUM | LOW | INFORMATIONAL

---

## Findings

| ID | Severity | Finding | Evidence | Recommendation |
|---|---|---|---|---|
| S1 | **CRITICAL** (config) | Proposed production deployment `tremendous-sturgeon-449` has **no Convex environment variables** | `convex env list --deployment production` → empty | Do not serve traffic until Auth + ingest + notify env set and verified |
| S2 | **HIGH** | Shared `INGEST_SECRET` remains fleet-wide auth for ESP32/NCU1 | Dual-auth design; staging matrix keeps shared path | Keep until approved per-device cutover; rotate if leaked; monitor `auth_failed` |
| S3 | **MEDIUM** | Production-sourced DR restore **not drilled** (staging isolated restore **VERIFIED** on `vivid-mosquito-28`) | `docs/backup-restore-verification.md` §6 | Run prod-sourced empty-recovery drill before claiming prod DR |
| S4 | **MEDIUM** | No CI/CD workflows; deploy is fully manual | No `.github/workflows` | Operator runbook discipline; optional future CI with env isolation |
| S5 | **MEDIUM** | SPA stores access token in `sessionStorage` | `src/platform/bearer.ts` | XSS would expose bearer; keep CSP/deps clean; short Auth0 token TTL |
| S6 | **MEDIUM** | SMS (Arkesel) has no provider idempotency key | `convex/notify.ts` / `notifyDelivery.ts` comments | Treat uncertain timeouts as possible duplicates; prefer email idempotency (Resend) |
| S7 | **MEDIUM** | Ingest IP rate limit trusts `X-Forwarded-For` / `CF-Connecting-IP` | `convex/http.ts` `ipKeyFromRequest` | Ensure Convex/CDN provides real client IP; spoofing weakens IP bucket only (device bucket still applies) |
| S8 | **LOW** | Code default audience fallback remains `dse-gateway` if env unset | `auth.config.ts`, `oidc.ts` | Always set `AUTH_JWT_AUDIENCE` / `VITE_OIDC_AUDIENCE` explicitly (staging uses `icanova`) |
| S9 | **LOW** | Production Auth0 tenant not provisioned in-repo | Staging Auth0 only | Separate prod SPA + API; never copy staging client secrets (there should be none in SPA) |
| S10 | **INFORMATIONAL** | Frontend hosting undecided | No `vercel.json` | Operator chooses static HTTPS host |
| S11 | **INFORMATIONAL** | Lab self-hosted JWKS pattern still documented for offline mint | `.jwt/` gitignored | Prod should use Auth0 JWKS only; clear `AUTH_JWT_JWKS` if unused |
| S12 | **INFORMATIONAL** | Hardware/SIM/RS485 not in software threat model for this audit | Hardware ATP separate | Do not claim physical security from this audit |

---

## Controls that are in good shape (evidence)

| Control | Status | Evidence |
|---|---|---|
| Access-token-only Convex bearer | VERIFIED IN STAGING | `selectConvexBearer`; Auth0 `aud=icanova` → `/me` |
| Backend `requirePermission` (not UI-only) | VERIFIED IN STAGING / local | Ops section ACL tests; foreign-org denial |
| Credential hashes never returned | VERIFIED IN STAGING | Device-cred HTTP matrix |
| Inactive device rejection | VERIFIED IN STAGING | HTTP 403 |
| Ingest body size limit | READY FOR PRODUCTION (code) | `INGEST_MAX_BODY` 8 KiB |
| Device + IP rate limits | READY FOR PRODUCTION (code) | Defaults + env overrides |
| Ingest order / idempotent cursor | READY FOR PRODUCTION (code) | `order.ts` + `ingestCursors` |
| Notify email idempotency (Resend) | READY FOR PRODUCTION (code) | Idempotency-Key header |
| Secret inventory separation | READY FOR PRODUCTION (docs) | `docs/env-inventory.md` |
| `productionConfig` rejects `disabled`/placeholders | READY FOR PRODUCTION (code) | Unit tests |

---

## Explicit non-findings

- No evidence of client secrets committed in `VITE_*` source.  
- No production deploy was performed during this audit.  
- Dependency CVE scan was **not** run in this phase → do not claim supply-chain clean beyond pnpm lockfile policy note from CLI.

---

## Related

- Environment design: `docs/production-environment-setup.md`  
- Deploy runbook: `docs/production-deployment-runbook.md`  
- Acceptance matrix: `docs/phase8-2-production-acceptance.md`
