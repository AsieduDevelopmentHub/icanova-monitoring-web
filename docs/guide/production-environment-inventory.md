# Production environment inventory (Phase 8.5C)

**Date:** 2026-10-31  
**Secret policy:** names and classifications only — **no secret values**

---

## 1. Deployments

| Role | Convex name | Notes |
|---|---|---|
| Production | `tremendous-sturgeon-449` | Designated prod; env **empty** as of 8.5C |
| Staging | `dapper-roadrunner-247` | Currently serves live Pages SPA |
| Development | `effervescent-kangaroo-10` | Preserved |
| Recovery | `vivid-mosquito-28` | Quarantined |

Frontend host: Cloudflare Pages → `https://icanova.pages.dev`

---

## 2. Frontend public variables (Pages build)

| Name | Required | Secret | Live Pages (8.5C) |
|---|---|---|---|
| `VITE_CONVEX_URL` | Yes | No | **staging** roadrunner URL |
| `VITE_CONVEX_SITE_URL` | Optional | No | **staging** |
| `VITE_OIDC_ISSUER` | Yes (login) | No | staging Auth0 host |
| `VITE_OIDC_CLIENT_ID` | Yes (login) | No | set (32 chars) |
| `VITE_OIDC_AUDIENCE` | Yes | No | `icanova` |
| `VITE_OIDC_REDIRECT_URI` | Yes | No | `https://icanova.pages.dev/auth/callback` |
| `VITE_OIDC_LOGOUT_REDIRECT_URI` | Recommended | No | `https://icanova.pages.dev/` |
| `VITE_SENTRY_DSN` | Optional | No | unset / unused |
| `VITE_GA_MEASUREMENT_ID` | Optional | No | unset / unused |

Forbidden in `VITE_*`: client secrets, `INGEST_SECRET`, Resend/Arkesel keys, deploy keys, PEMs.

---

## 3. Convex production server variables

| Name | Class | Production status |
|---|---|---|
| `AUTH_JWT_ISSUER` | Required public | **MISSING** |
| `AUTH_JWKS_URL` | Required public | **MISSING** |
| `AUTH_JWT_AUDIENCE` | Required public | **MISSING** (must be `icanova`) |
| `INGEST_SECRET` | Required secret | **MISSING** (generate new; ≠ other envs) |
| `AUTH_JWT_JWKS` | Optional lab JWKS body | Keep **unset** with Auth0 |
| `INGEST_RATE_LIMIT_*` | Optional | Defaults OK |
| `RESEND_API_KEY` / `RESEND_FROM` | Optional notify | Absent — delivery off |
| `ARKESEL_API_KEY` / `ARKESEL_SENDER` | Optional notify | Absent — delivery off |
| `EMAIL_ALERTS_ENABLED` / `SMS_ALERTS_ENABLED` | Optional flags | Keep unset until approved |
| `TEST_NOTIFY_EMAIL` / `TEST_NOTIFY_PHONE` | Staging only | **Forbidden** in production |

---

## 4. Staging Convex (reference — do not copy secrets)

Present names on roadrunner: `AUTH_JWT_*`, `AUTH_JWKS_URL`, `AUTH_JWT_JWKS`, `INGEST_SECRET`, `RESEND_*`, `TEST_NOTIFY_*`.

Production must not inherit `TEST_NOTIFY_*` or staging ingest/notify secrets.

---

## 5. Collector / firmware (outside SPA)

| Name | Notes |
|---|---|
| `INGEST_URL` | Eventually `https://tremendous-sturgeon-449.convex.site/ncu/ingest` |
| `INGEST_SECRET` | Must match production Convex |
| `NCU_KEY` | Device AES; never in Vite |

No firmware changes in 8.5C.
