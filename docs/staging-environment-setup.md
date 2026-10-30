# Staging environment setup (Phase 8.0A)

**Date:** 2026-10-30  
**Status:** Documentation COMPLETE. Staging Convex deployment **not provisioned by agent** — **OPERATOR ACTION REQUIRED**.

---

## 1. Current environment

| Item | Actual |
|---|---|
| Development Convex | `effervescent-kangaroo-10` |
| Staging Convex | **Does not exist** |
| Production Convex | **Not started** |
| `convex.json` in repo | Absent — CLI uses linked local project |
| Vercel / CI | Absent |
| Frontend host | Operator-chosen static HTTPS; Vite `dist/` |

Do **not** overwrite development configuration while provisioning staging.

---

## 2. Required staging resources

1. Separate Convex project/deployment (name distinct from kangaroo / production).
2. Staging frontend build with staging-only `VITE_CONVEX_URL`.
3. Distinct `INGEST_SECRET` (never copy production or development).
4. Staging Auth env (`AUTH_JWT_ISSUER`, `AUTH_JWKS_URL`, `AUTH_JWT_AUDIENCE`) — operator IdP or lab JWKS.
5. Optional `TEST_NOTIFY_EMAIL` / `TEST_NOTIFY_PHONE` only (never customer destinations).
6. Synthetic organizations, sites, devices, generators — no production data clone.

---

## 3. Provisioning sequence (operator)

```bash
# From a clean checkout; do not switch the linked kangaroo project blindly.
# Create / select a NEW Convex project in the dashboard, then:
pnpm exec convex dev --configure=new
# or link an existing empty staging deployment:
# pnpm exec convex deploy --cmd '...'   # only against the staging deploy

pnpm exec convex env set INGEST_SECRET "<staging-secret-32+>"
pnpm exec convex env set AUTH_JWT_ISSUER "<staging-issuer-https>"
pnpm exec convex env set AUTH_JWKS_URL "<staging-jwks-https>"
pnpm exec convex env set AUTH_JWT_AUDIENCE "dse-gateway"

# Frontend staging build (CI or local):
# VITE_CONVEX_URL=https://<staging>.convex.cloud pnpm build
```

Isolation checks before first traffic:

- [ ] Staging deployment URL ≠ kangaroo ≠ production
- [ ] Staging `INGEST_SECRET` ≠ development ≠ production
- [ ] Collector / firmware for staging devices point at staging `.convex.site` only
- [ ] No production notify credentials in staging unless intentionally shared sandbox keys

---

## 4. Validation checklist (actual results)

| Check | Result |
|---|---|
| Convex staging URL | **NOT RUN — OPERATOR** |
| Auth configuration | **NOT RUN — OPERATOR** |
| Frontend `VITE_CONVEX_URL` | **NOT RUN — OPERATOR** |
| API / `GET /me` | **NOT RUN — OPERATOR** |
| Scheduled jobs present | **NOT RUN — OPERATOR** (same `crons.ts` after deploy) |
| Ingestion endpoint | **NOT RUN — OPERATOR** |
| Notify test config | **NOT RUN — OPERATOR** |
| Database separation | **NOT RUN — OPERATOR** |

Software E2E against synthetic data continues via Vitest/`convex-test` on the developer machine; see `docs/staging-e2e-report.md` and `docs/browser-e2e-report.md`.

---

## 5. Access restrictions

- Limit Convex team membership on staging.
- Do not grant production deploy keys to staging CI.
- Keep `.env.staging.local` (or host secrets) out of git.
