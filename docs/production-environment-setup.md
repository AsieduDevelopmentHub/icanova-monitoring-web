# Production environment setup (Phase 8.2A)

**Date:** 2026-10-31  
**Status:** Design / operator checklist — **NO PRODUCTION DEPLOYMENT EXECUTED**  
**Proposed Convex target:** `tremendous-sturgeon-449` (project default prod) — **currently has zero Convex env vars** (`convex env list --deployment production`).

Do not copy staging or development secrets into production.

---

## 1. Three-environment separation

| Env | Convex deployment | Local env file | Frontend build |
|---|---|---|---|
| Development | `effervescent-kangaroo-10` (dev) | `.env.local` | `pnpm dev` / default build |
| Staging | `dapper-roadrunner-247` (reference `staging`) | `.env.staging.local` | `vite --mode staging` / `vite build --mode staging` |
| Production | **Proposed** `tremendous-sturgeon-449` | `.env.production.local` (gitignored; create when ready) | Build with prod `VITE_*` only |

**Never** overwrite kangaroo or roadrunner when targeting production. Use an explicit prod deploy key / `--prod` / dedicated env file.

Hosting (SPA): **OPERATOR DECISION** — no Vercel/CI in this repo. Ship `dist/` to any HTTPS static host.

CI: **None** (no `.github/workflows`). Deploys are manual.

---

## 2. Public frontend variables (`VITE_*` only)

| Variable | Prod required | Notes |
|---|---|---|
| `VITE_CONVEX_URL` | Yes | `https://tremendous-sturgeon-449.convex.cloud` (if that target is approved) |
| `VITE_OIDC_ISSUER` | Yes (for login) | Production Auth0 issuer https URL |
| `VITE_OIDC_CLIENT_ID` | Yes | Production **SPA** client id (public) |
| `VITE_OIDC_AUDIENCE` | Yes | Must equal Convex `AUTH_JWT_AUDIENCE` (brand API id, e.g. `icanova`) |
| `VITE_OIDC_REDIRECT_URI` | Yes | `https://<prod-host>/auth/callback` |
| `VITE_OIDC_LOGOUT_REDIRECT_URI` | Recommended | `https://<prod-host>/` |
| `VITE_SENTRY_DSN` / `VITE_GA_MEASUREMENT_ID` | Optional | |

**Forbidden in `VITE_*`:** client secrets, `INGEST_SECRET`, Resend/Arkesel keys, PEM private keys, `AUTH_JWT_JWKS`.

Full inventory: `docs/env-inventory.md`.

---

## 3. Convex server variables (production)

### Required for authenticated product

| Variable | Secret? | Notes |
|---|---|---|
| `AUTH_JWT_ISSUER` | No (URL) | Exact Auth0 issuer (trailing slash must match JWT `iss`) |
| `AUTH_JWKS_URL` | No (URL) | Auth0 JWKS URL |
| `AUTH_JWT_AUDIENCE` | No | API identifier (staging uses `icanova`) |
| `INGEST_SECRET` | **Yes** | ≥32 chars; **≠** staging/dev |

### Optional / conditional

| Variable | When |
|---|---|
| `AUTH_JWT_JWKS` | Only if self-hosting JWKS (not needed with Auth0) |
| `INGEST_RATE_LIMIT_*` | Override defaults |
| `RESEND_API_KEY` / `RESEND_FROM` | If `EMAIL_ALERTS_ENABLED` |
| `ARKESEL_API_KEY` / `ARKESEL_SENDER` | If `SMS_ALERTS_ENABLED` |
| `EMAIL_ALERTS_ENABLED` / `SMS_ALERTS_ENABLED` | Fail-closed validators when set |
| `TEST_NOTIFY_*` | **Staging/lab only — do not set in production** |

---

## 4. Collector / firmware (outside this repo)

| Variable | Notes |
|---|---|
| `INGEST_URL` | `https://<prod>.convex.site/ncu/ingest` |
| `INGEST_SECRET` | Same as Convex production |
| `NCU_KEY` | AES key; never in Vite |

---

## 5. Verification (before any prod traffic)

```bash
# Names only — confirm expected keys exist (after operator sets them):
pnpm exec convex env list --deployment production

# SPA build must target prod Convex URL only:
# VITE_CONVEX_URL=https://tremendous-sturgeon-449.convex.cloud
pnpm build
```

Smoke: `GET /me` 401 without token; 200 with prod Auth0 access token (`aud` match); ingest 401 without secret.

---

## 6. Production blueprint checklist (8.2B)

| # | Item | Owner | Status |
|---|---|---|---|
| 1 | Production Auth0 tenant/application | Operator | OPEN |
| 2 | Production Auth0 API audience (e.g. `icanova`) | Operator | OPEN |
| 3–5 | Callback / logout / allowed origins | Operator | OPEN |
| 6 | Issuer + JWKS on Convex | Operator | OPEN |
| 7 | Production Convex deployment confirmed | Operator | Proposed `tremendous-sturgeon-449` — **unverified purpose; env empty** |
| 8–9 | JWT config + secrets (ingest, notify) | Operator | OPEN |
| 10–12 | Frontend host, domain, TLS, DNS | Operator | OPEN |
| 13 | Monitoring/alerting | Operator | OPEN |
| 14 | Backup/recovery | Operator | Depends on restore drill |
| 15 | Notification providers | Operator | OPEN |
| 16 | Device credential provisioning process | Operator | Plan ready |
| 17 | Operator access / admin accounts | Operator | OPEN |
| 18 | Rollback procedure | Docs | `docs/production-deployment-runbook.md` |

Validate local/staging profiles (non-destructive):

```bash
node scripts/validate-env-profile.mjs staging
node scripts/validate-env-profile.mjs production
```

## 7. Related docs

- Auth0 contract: `docs/identity-provider-setup.md`, `docs/production-auth-setup.md`
- Deploy/rollback: `docs/production-deployment-runbook.md`
- Security findings: `docs/production-security-audit.md`
- Master status: `docs/phase8-master-status.md`
