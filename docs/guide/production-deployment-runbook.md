# Production deployment runbook (Phase 8.2A)

**Date:** 2026-10-31  
**Status:** READY FOR OPERATOR USE — **DO NOT EXECUTE** until written production approval (Phase 8.1 staging restore drill already VERIFIED)  
**Proposed target:** `tremendous-sturgeon-449` (empty env as of 2026-10-31)

Never overwrite `effervescent-kangaroo-10` or `dapper-roadrunner-247` with this procedure.

---

## 0. Preconditions (all required)

- [ ] Staging Auth0 + E2E still green (Phase 8.1 software)  
- [x] Isolated staging restore drill completed (`vivid-mosquito-28`) — prod-sourced DR still optional/residual-risk  
- [ ] Production Auth0 SPA + API configured (issuer/JWKS/audience/callbacks)  
- [ ] Production `INGEST_SECRET` generated (≥32) and stored in operator vault  
- [ ] SPA host chosen; TLS ready; Auth0 allowlists match host  
- [ ] Written authorization to deploy to production  

---

## 1. Pre-deployment checks

1. `pnpm test`  
2. `pnpm build` (with **production** `VITE_*`, not staging)  
3. Confirm no secrets in git (`git status` — no `.env*.local`, no `.jwt/`)  
4. Schema/migrations: prefer additive only; dry-run `convex/migrations.ts` if used  
5. Note current Convex production revision (dashboard) for rollback  

---

## 2. Environment verification

```bash
# Must show AUTH_* + INGEST_SECRET (names). Values never pasted into tickets.
pnpm exec convex env list --deployment production
```

Confirm:

| Check | Expect |
|---|---|
| `AUTH_JWT_ISSUER` / `AUTH_JWKS_URL` | Prod Auth0 https URLs |
| `AUTH_JWT_AUDIENCE` | Matches API id + `VITE_OIDC_AUDIENCE` |
| `INGEST_SECRET` | Set; ≠ staging/dev |
| `TEST_NOTIFY_*` | **Absent** in production |
| `RESEND_*` / `ARKESEL_*` | Only if alerts enabled |

Frontend build env: `VITE_CONVEX_URL` = prod `.convex.cloud` only.

---

## 3. Backup confirmation

1. Convex dashboard → production → **Backup Now** (or confirm Pro schedule).  
2. Record UTC time, operator, include-storage yes/no.  
3. Prefer also having a recent **staging** backup + known recovery path.  

---

## 4. Authentication verification (pre-traffic)

1. `GET https://<prod>.convex.site/.well-known/jwks.json` — if self-host unused, Auth0 JWKS must be reachable instead.  
2. Obtain prod Auth0 **access token** (`aud` = API id).  
3. `GET /me` → 200.  
4. Wrong/missing token → 401.  

---

## 5. Schema compatibility

- Deploy functions that match the schema already applied.  
- Do not run destructive table wipes.  
- Additive optional fields only unless separately approved.  

---

## 6. Deployment procedure

### Backend

```bash
# Example — operator supplies prod deploy key via gitignored env file:
# pnpm exec convex deploy --env-file .env.production.local --yes
#
# Or after linking CLI carefully to production only:
# pnpm exec convex deploy --prod --yes
```

Confirm dashboard shows **tremendous-sturgeon-449** (or approved name) — abort if kangaroo/roadrunner.

### Frontend

```bash
# VITE_* from production build env
pnpm build
# Upload dist/ to HTTPS static host
```

### Collector

Point `INGEST_URL` / `INGEST_SECRET` at production only for approved devices.

---

## 7. Smoke tests (post-deploy)

| Check | Expect |
|---|---|
| SPA loads on prod host | No console secret leaks |
| `/auth/login` → Auth0 → callback | Access token stored; Sign out visible |
| `/me` with access token | 200 |
| Ingest without bearer | 401 |
| Ingest with shared secret + registered identity | Accept or 404 no-generator (not 401) |
| Ops without permission | Forbidden |
| Crons present | Dashboard / `crons.ts` intervals |

---

## 8. Monitoring checks

- Ingest op counters (`auth_failed`, `rate_limited`)  
- Device health sweep running  
- Notification outbox (if enabled) not wedged  
- Sentry (if configured) receiving only expected noise  

---

## 9. Rollback decision criteria

Roll back if any of:

- Auth lockout (issuer/audience mismatch) lasting >15 min after fix attempt  
- Ingest 5xx or mass `auth_failed` for known-good collectors  
- Data corruption / wrong-tenant reads observed  
- Failed deploy leaves functions mismatched to schema  

---

## 10. Rollback procedure

| Surface | Action |
|---|---|
| Frontend | Redeploy previous `dist/` artifact |
| Convex | Redeploy previous function revision (dashboard/CLI) |
| Env | Revert env vars carefully (wrong issuer = total lockout) |
| Schema | **Cannot** roll back applied writes; forward-fix only |
| Collector | Repoint `INGEST_URL`/secret if needed |

### Post-rollback verification

Repeat smoke tests on the rolled-back revision; confirm Auth0 login and one ingest path.

---

## 11. Related

- Env setup: `docs/production-environment-setup.md`  
- Legacy notes: `docs/deployment-runbook.md` (update staging row still accurate for non-prod)
