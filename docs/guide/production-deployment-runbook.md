# Production deployment runbook (Phase 8.2A / 8.2C)

**Date:** 2026-10-31  
**Status:** READY FOR OPERATOR USE — **DO NOT EXECUTE** until written production approval  
**Proposed target:** `tremendous-sturgeon-449` (empty env as of 2026-10-31 — re-verify identity before any push)

Never overwrite `effervescent-kangaroo-10`, `dapper-roadrunner-247`, or `vivid-mosquito-28` with this procedure.

---

## 0. Preconditions (all required)

- [ ] Staging Auth0 + E2E still green (Phase 8.1 software)  
- [x] Isolated staging restore drill completed (`vivid-mosquito-28`) — prod-sourced DR still optional/residual-risk  
- [ ] Production Auth0 SPA + API configured (issuer/JWKS/audience/callbacks)  
- [ ] Production `INGEST_SECRET` generated (≥32) and stored in operator vault (**≠** staging/dev/recovery)  
- [ ] SPA host chosen; TLS ready; Auth0 allowlists match host  
- [ ] `node scripts/validate-env-profile.mjs production` **PASS**  
- [ ] Written authorization to deploy to production  

---

## 1. Exact deployment sequence

Stop immediately if any step fails or the Convex dashboard shows the wrong deployment.

| Step | Action | Stop if |
|---|---|---|
| 1 | Verify source commit (`git rev-parse HEAD`) and tag/note for rollback | Wrong branch / unreviewed commit |
| 2 | Verify clean tree for secrets (`git status` — no `.env*.local`, `.jwt/`, deploy keys staged) | Secrets present in staging area |
| 3 | `pnpm test` | Any failure |
| 4 | `node scripts/validate-env-profile.mjs production` | FAIL |
| 5 | Verify Auth0 prod issuer/JWKS/audience/`icanova` (or approved aud) + callbacks | Staging Auth0 host used |
| 6 | Verify Convex identity is `tremendous-sturgeon-449` (or newly approved prod name) | kangaroo / roadrunner / mosquito |
| 7 | Verify prod secrets present (names only via `convex env list --deployment production`) | Missing `AUTH_*` / `INGEST_SECRET`; `TEST_NOTIFY_*` present |
| 8 | Deploy backend: `pnpm exec convex deploy --env-file .env.production.local --yes` | Dashboard ≠ approved prod |
| 9 | Deploy frontend: `pnpm build` with prod `VITE_*`; upload `dist/` | Build used staging URLs |
| 10 | Verify Auth0 login on prod host | Callback mismatch |
| 11 | `GET /me` with prod access token → 200 | 401 after valid login |
| 12 | Foreign-org query denied | Cross-tenant data visible |
| 13 | Read-only telemetry / sites / devices views | Wrong deployment data |
| 14 | Ingest without bearer → 401; with prod secret → not 401 | Mass auth_failed |
| 15 | Alarm list/detail ACL smoke | Permission bypass |
| 16 | Device health / freshness views | Conflating offline with generator stopped |
| 17 | Notification config present **without** sending unless authorized | Accidental fan-out |
| 18 | Monitor ingest counters + errors 15–30 min | Sustained 5xx / lockout |
| 19 | Declare success **or** execute §3 rollback | — |

Prefer **backward-compatible** schema changes only. Do not assume schema rollback is possible.

---

## 2. Smoke expectations (post-deploy)

| Check | Expect |
|---|---|
| SPA loads on prod host | No console secret leaks |
| `/auth/login` → Auth0 → callback | Access token stored; Sign out visible |
| `/me` with access token | 200; subject matches JWT |
| Ingest without bearer | 401 |
| Ingest with shared secret + registered identity | Accept or 404 no-generator (not 401) |
| Ops without permission | Forbidden |
| Crons present | Dashboard / `crons.ts` intervals |

---

## 3. Rollback procedures

### Frontend

1. Redeploy previous known-good `dist/` artifact to the same host.  
2. Confirm domain DNS unchanged (or revert DNS if cutover used a new host).  
3. Account for CDN/cache TTLs; hard-refresh verification.  

### Convex / backend

1. Redeploy previous known-good function revision (dashboard/CLI) to the **same** prod deployment.  
2. Confirm function revision matches the schema already applied.  
3. **Schema writes cannot be rolled back** by function rollback — forward-fix only.  

### Configuration

1. Env var rollback: restore previous vault values carefully (wrong issuer = total Auth lockout).  
2. Auth0: revert SPA callbacks/origins if host rolled back.  
3. Notify providers: disable `EMAIL_ALERTS_ENABLED` / `SMS_ALERTS_ENABLED` or remove keys if send storm.  

### Devices

Do **not** automatically roll back device credentials. Shared `INGEST_SECRET` remains the fleet safety net until an approved cutover. See `docs/guide/device-credential-migration-plan.md`.

### Rollback decision criteria

Roll back if any of:

- Auth lockout (issuer/audience mismatch) lasting >15 min after fix attempt  
- Ingest 5xx or mass `auth_failed` for known-good collectors  
- Data corruption / wrong-tenant reads observed  
- Failed deploy leaves functions mismatched to schema  

### Post-rollback verification

Repeat smoke tests on the rolled-back revision; confirm Auth0 login and one ingest path.

---

## 4. Related

- Env setup: `docs/guide/production-environment-setup.md`  
- Security: `docs/status/production-security-audit.md`  
- Legacy notes: `docs/guide/deployment-runbook.md`
