# Staging environment setup (Phase 8.0A / 8.1A)

**Date:** 2026-10-31  
**Activation status:** Staging Convex **live** with lab self-hosted JWKS auth, distinct ingest secret, and lab notify env. Real browser OIDC IdP still **OPERATOR ACTION REQUIRED**.

---

## 1. Current environment

| Item | Actual |
|---|---|
| Development Convex | `effervescent-kangaroo-10` (dev) |
| Staging Convex | `dapper-roadrunner-247` (reference `staging`, type prod-named) |
| Staging cloud URL | `https://dapper-roadrunner-247.convex.cloud` |
| Staging site URL | `https://dapper-roadrunner-247.convex.site` |
| Staging dashboard | https://dashboard.convex.dev/t/asiedudevelopmenthub/dse/dapper-roadrunner-247 |
| Default production | `tremendous-sturgeon-449` (existing; **not** used by this staging work) |
| Local env file for staging | `.env.staging.local` (gitignored) |
| Lab JWT keys | `.jwt/staging/` (gitignored); mint with `python scripts/issue-operator-token.py --staging` |
| `convex.json` in repo | Absent |
| Vercel / CI | Absent — no Vercel project in this repo; SPA may use local preview |
| Operator checklist | `docs/phase8-1-operator-checklist.md` |
| Device cred HTTP script | `node scripts/staging-device-cred-http.mjs` |

**Never** overwrite development (`effervescent-kangaroo-10`) when working on staging. Deploy with `--env-file .env.staging.local` (uses `CONVEX_DEPLOY_KEY`).

---

## 2. Staging environment variable inventory

### Frontend build (public)

| Variable | Required | Notes |
|---|---|---|
| `VITE_CONVEX_URL` | Yes | Staging `.convex.cloud` only |
| `VITE_OIDC_ISSUER` | For SPA login | https issuer — still unset (lab uses bearer injection) |
| `VITE_OIDC_CLIENT_ID` | For SPA login | Public client |
| `VITE_OIDC_AUDIENCE` | For SPA login | Must equal Convex `AUTH_JWT_AUDIENCE` |
| `VITE_OIDC_REDIRECT_URI` | For SPA login | Staging app `/auth/callback` |
| `VITE_OIDC_LOGOUT_REDIRECT_URI` | Optional | |
| `VITE_SENTRY_DSN` / `VITE_GA_MEASUREMENT_ID` | Optional | |

No server secrets in `VITE_*`.

### Convex server (staging deploy only) — configured 2026-10-31

| Variable | Status | Notes |
|---|---|---|
| `AUTH_JWT_ISSUER` | Set | Auth0 `https://dev-notfczud6xx8hhxf.us.auth0.com/` (trailing slash) |
| `AUTH_JWKS_URL` | Set | Auth0 `…/.well-known/jwks.json` |
| `AUTH_JWT_AUDIENCE` | Set | `icanova` (API identifier; intentional brand) |
| `AUTH_JWT_JWKS` | Lab leftover | Optional; Auth0 hosts JWKS now |
| `INGEST_SECRET` | Set | ≥32 chars; **≠** development/production |
| `RESEND_API_KEY` / `RESEND_FROM` | Set | Lab Resend (same as development lab) |
| `TEST_NOTIFY_EMAIL` / `TEST_NOTIFY_PHONE` | Set | Lab destinations only |

---

## 3. Safe staging deployment commands

```bash
# Redeploy functions (does not touch kangaroo):
pnpm exec convex deploy --env-file .env.staging.local --yes

# Mint / refresh lab operator JWT:
python scripts/issue-operator-token.py --staging

# Verify:
# GET https://dapper-roadrunner-247.convex.site/.well-known/jwks.json
# GET https://dapper-roadrunner-247.convex.site/me  Authorization: Bearer <token>

# Optional Convex client bootstrap against staging:
node scripts/operator.mjs ensure --staging
```

Env updates on staging only:

```bash
pnpm exec convex env set NAME value --deployment staging --force
pnpm exec convex env set AUTH_JWT_JWKS --from-file .jwt/staging/jwks.json --deployment staging --force
```

---

## 4. Isolation checklist

- [x] Staging deployment URL ≠ `effervescent-kangaroo-10` ≠ production
- [x] Staging `INGEST_SECRET` distinct
- [x] Staging Auth issuer/JWKS distinct (own RSA key under `.jwt/staging/`)
- [ ] Collectors/firmware for staging devices use staging `.convex.site` only
- [x] Notify credentials are lab/sandbox destinations (not customer MSISDNs/inboxes)
- [x] Synthetic orgs/devices only — no production data clone

---

## 5. Validation checklist (actual results — 2026-10-31)

| Check | Result |
|---|---|
| Convex staging URL | **VERIFIED** — `dapper-roadrunner-247` |
| Functions + schema pushed | **VERIFIED** — `convex deploy --env-file .env.staging.local` |
| Distinct `INGEST_SECRET` | **VERIFIED** — set on staging (value only in `.env.staging.local`) |
| Auth configuration | **VERIFIED** — Convex staging pointed at Auth0 (`icanova`) |
| Auth0 JWKS reachable | **VERIFIED** — discovery + JWKS 200 |
| Lab mint `/me` after Auth0 cutover | **VERIFIED** — lab JWT correctly **401** (issuer no longer self-host) |
| Real OIDC SPA login | **BLOCKED** — Auth0 app callback URL allowlist (see below) |
| Frontend staging OIDC env | **SET** in `.env.staging.local` (`VITE_OIDC_*`, audience `icanova`) |
| Scheduled jobs after deploy | **IMPLEMENTED NOT VERIFIED** — crons deployed with functions |
| Notify live send | **IMPLEMENTED NOT VERIFIED** — Resend + `TEST_NOTIFY_*` set; send not exercised this pass |
| Device credential HTTP matrix | **VERIFIED** — `node scripts/staging-device-cred-http.mjs` PASSED |
| Database separation | **VERIFIED** — separate deployment from kangaroo |

See `docs/phase8-1-staging-acceptance.md`.
