# Phase 8 — Final status (canonical)

**Date:** 2026-10-31  
**Overall status:** **COMPLETE WITH DOCUMENTED EXCEPTIONS**  
**Equivalent label:** **COMPLETE — PRODUCTION DEPLOYMENT PENDING EXPLICIT AUTHORIZATION**  
**Production authorization:** **MISSING** → `PRODUCTION: NOT AUTHORIZED`  
**Phase 9:** Software Phase 8 closure is complete; production go-live remains a separate authorized Phase 9 / launch step.

Obsolete Auth0-as-active-IdP production plans (8.5C–8.5D shared-tenant SPA cutover) are **superseded**. Active authentication is **Convex Auth Password → Convex**. Auth0 is **FUTURE / INACTIVE** under `src/auth/integrations/auth0/`.

---

## Phase 8 Final Status

### Overall Status

`COMPLETE WITH DOCUMENTED EXCEPTIONS`

Staging software, Convex Auth, hosted Pages, security package, backup drill evidence, secret inventory, and production readiness plans are complete. Production Convex (`sturgeon`) and Pages→sturgeon cutover were **intentionally not executed** (no explicit production authorization). Remaining items are documented exceptions or operator launch gates, not open Phase 8 implementation blockers.

### Authentication

| Item | Status |
|---|---|
| Convex Auth Password (active) | **VERIFIED** on staging (`roadrunner`) |
| Auth0 | **FUTURE / INACTIVE** — not required for startup/login; isolated under `src/auth/integrations/auth0/` |
| Hosted E2E (Pages → roadrunner) | **4/4 passed** (8.5G) |
| Identity `ensure` + email-rebind | Implemented; memberships preserved by email |
| Org membership / RBAC | Unchanged; auth ≠ org access |
| Password reset email | **Deferred exception** (Resend not wired into auth) |

### Staging

| Item | Status | Evidence |
|---|---|---|
| Convex `dapper-roadrunner-247` | **VERIFIED** | 8.5F: JWT keys, deploy, JWKS/OIDC discovery |
| Pages `icanova` / `icanova.pages.dev` | **VERIFIED** | 8.5G deploy `5e33343b…`; bundle `index-IxHDHlCX.js` → roadrunner |
| Rollback ref | Recorded | Prior Auth0-era `index-Bj2FZgpP.js` |
| Hosted Password E2E | **VERIFIED** | 4/4 |
| Unit/integration tests | **186 passed** / 39 files | This closure run |
| Build | **PASS** | `pnpm build` |

### Production

| Item | Status |
|---|---|
| Convex `tremendous-sturgeon-449` | **EXISTS, EMPTY** — 0 env vars; HTTP routes **404** (functions undeployed) |
| Secrets | **NOT PROVISIONED** (plan complete — see below) |
| Function deploy | **NOT EXECUTED** |
| Frontend cutover to sturgeon | **NOT EXECUTED** — Pages remains on roadrunner |
| Authorization | **`PRODUCTION: NOT AUTHORIZED`** |

#### Production secret inventory (plan only — do not copy staging values)

**Public frontend (build-time)**

| Variable | Required | Purpose |
|---|---|---|
| `VITE_CONVEX_URL` | Yes | `https://tremendous-sturgeon-449.convex.cloud` after authorized cutover |
| `VITE_SENTRY_DSN` / `VITE_GA_*` | Optional | Telemetry |

**Backend (Convex env on sturgeon — independently generate)**

| Variable | Required | Purpose |
|---|---|---|
| `JWT_PRIVATE_KEY` | Yes | Convex Auth RS256 signing (PKCS8, newlines as spaces) |
| `JWKS` | Yes | Public JWK set JSON for Convex Auth |
| `INGEST_SECRET` | Yes | Fleet ingest bearer (**new** production secret) |
| `RESEND_API_KEY` / `RESEND_FROM` | If email alerts enabled | Notify |
| `ARKESEL_API_KEY` / `ARKESEL_SENDER` | If SMS enabled | Notify |
| `EMAIL_ALERTS_ENABLED` / `SMS_ALERTS_ENABLED` | Optional flags | Fail-closed without keys |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | If Web Push | Browser push |
| `INGEST_RATE_*` | Optional | Rate-limit overrides |

**Do not set on production for v1 without need:** `TEST_NOTIFY_*`, staging Auth0 `AUTH_JWT_*` (inactive path).

`CONVEX_SITE_URL` is platform-managed for Convex Auth issuer.

### Security

Reconciled from `docs/status/production-security-audit.md` + Convex Auth transition:

| ID | Severity | Disposition |
|---|---|---|
| S1 | CRITICAL (config) | **Open until authorized provision** — sturgeon empty (expected) |
| S2 | HIGH | **Accepted exception** — shared `INGEST_SECRET` until per-device migration |
| S3 | MEDIUM | **Accepted exception** — prod-sourced DR not drilled; staging restore VERIFIED |
| S4 | MEDIUM | **Accepted** — manual deploy |
| S5 | MEDIUM | **Update** — Convex Auth session (not Auth0 sessionStorage primary); residual XSS risk accepted |
| S6–S7 | MEDIUM | **Accepted** — SMS idempotency; ingest IP header trust |
| S8 | CLOSED | No `dse-gateway` audience fallback |
| S9 | **SUPERSEDED** | Shared Auth0 prod plan obsolete; Convex Auth is active |
| S10 | CLOSED | Pages selected |
| Device cred migration | PLAN ONLY | Explicit exception |
| Hardware ATP | BLOCKED | Physical hardware — out of Phase 8 software |

**No unresolved CRITICAL software defects.** S1 is a configuration hard-gate pending production authorization.

### Backup / Restore

| Item | Status |
|---|---|
| Backup / restore procedures | Documented |
| Isolated restore drill | **VERIFIED** on `vivid-mosquito-28` (quarantined) |
| RPO (drill) | Backup age ≪ 24 h recommended |
| RTO (drill) | Technical restore ≪ 4 h target |
| Prod-sourced DR | **Exception** — not drilled |
| Secrets in ZIP | No — reconstruct from vault |

Evidence: `docs/guide/backup-restore-verification.md` §6.

### Operations

| Area | Status |
|---|---|
| Ops surfaces (gateway / Modbus / freshness / engine separation) | Implemented; missing ≠ zero |
| Alarms / diagnostics / notifications | Code ready; notify providers leave disabled until authorized |
| Rollback | Pages: prior deployment; Convex: redeploy prior revision + env vault |
| Manual deploy runbooks | Present |

### Ingestion security

| Item | Status |
|---|---|
| Dual-auth (`INGEST_SECRET` + optional device creds) | Active design |
| Rate limits / body limits / inactive device | Code verified on staging |
| Shared secret risk | **Documented exception** — migration plan exists, not executed |

### Tests (this closure)

| Suite | Result | Environment |
|---|---|---|
| Unit / convex-test | **186 passed** / 39 files | Local |
| Frontend secret scan | **PASS** (123 files) | Local |
| `pnpm build` | **PASS** | Local |
| `validate-env-profile production` | **FAIL** (expected — sturgeon empty) | Read-only |
| Hosted Auth E2E | **4/4** (8.5G) | Pages + roadrunner = **STAGING VERIFIED** |
| Production auth E2E | **Not run** | **Not PRODUCTION VERIFIED** |

### Cloudflare Pages readiness

| Item | Status |
|---|---|
| Build / `dist/` / `_redirects` | Verified |
| Deploy | Wrangler direct upload; OAuth or `CLOUDFLARE_API_TOKEN` (Pages Edit) |
| Staging cutover | **VERIFIED** (8.5G) |
| Prod Convex URL cutover | Pending authorization |

### Remaining Exceptions

1. **Production deployment not authorized** — sturgeon empty; Pages stays on roadrunner.  
2. **Shared fleet `INGEST_SECRET`** — per-device credential migration deferred (plan only).  
3. **Production-sourced DR restore** not drilled.  
4. **Password reset / email verification** not implemented for Convex Auth.  
5. **Notify providers** intentionally unset/disabled for production until authorized.  
6. **Hardware ATP** requires physical hardware (outside software Phase 8).  
7. Staging still retains unused legacy `AUTH_JWT_*` env names (harmless; Convex Auth uses `JWT_*` / `JWKS`).

### Phase 9 Readiness

**Yes — Phase 9 may begin** for programme work that does not mutate production.  
**Production go-live / sturgeon provision / Pages→sturgeon** requires **explicit written authorization** and is outside completed Phase 8 software closure.

---

## Document index (Phase 8)

| Doc | Role |
|---|---|
| **This file** | Canonical Phase 8 final status |
| `phase8-master-status.md` | Programme index |
| `phase-8.5e` / `8.5f` / `8.5g` | Convex Auth + staging Pages evidence |
| `phase-8.5d-shared-auth0-acceptance.md` | Historical; **superseded** for active IdP |
| `backup-restore-verification.md` | Restore VERIFIED |
| `production-security-audit.md` | Security findings (update dispositions above) |
| `production-launch-checklist.md` | Operator launch gates |

## Controlled production sequence (when authorized)

1. Generate new `JWT_PRIVATE_KEY` / `JWKS` / `INGEST_SECRET` for sturgeon (never copy staging).  
2. `convex env set` on production; verify names only.  
3. Deploy functions to sturgeon; verify JWKS / openid-configuration / `/me` 401.  
4. Controlled Password smoke on sturgeon.  
5. Build SPA with production `VITE_CONVEX_URL`; secret-scan; deploy Pages; smoke.  
6. Record deployment IDs + rollback refs.

Until then: **PRODUCTION: NOT AUTHORIZED.**
