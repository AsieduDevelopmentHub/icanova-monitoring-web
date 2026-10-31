# Deployment runbook (Phase 7K)

**Status:** Documentation COMPLETE for actual repo architecture. Production deploy is **not** started.  
**Development deployment:** `effervescent-kangaroo-10`  
**Date:** 2026-10-30

A green `productionReady` / `productionProfileReady` check is **not** production approval. It does not prove backup restore, live IdP login, or physical DSE communication.

---

## 1. Actual deployment architecture

| Layer | How it ships today |
|---|---|
| Frontend | Vite → `dist/` via `pnpm build`. No `vercel.json`. Host is operator-chosen static HTTPS. |
| Backend | Convex functions via Convex CLI (`pnpm exec convex dev --once` or `convex deploy`) |
| Collector | `icanova-edge-gateway/tools/ncu_inbox.py` → `INGEST_URL` + `INGEST_SECRET` |
| Firmware | Separate repo; uplink host/path/bearer in NVS — not flashed by this web deploy |
| CI | None in-repo (no `.github/workflows`) |

There is **no** checked-in `convex.json` at repo root; the CLI uses the linked project / local env.

---

## 2. Environment separation

| Env | Convex | Frontend | Secrets |
|---|---|---|---|
| Local | `convex dev` | `pnpm dev` + `.env.local` | Dev-only |
| Development | `effervescent-kangaroo-10` | Build with that `VITE_CONVEX_URL` | Dev secrets; never copy to prod |
| Staging | `dapper-roadrunner-247` | `.env.staging.local` | Auth0 `icanova` + distinct ingest; E2E verified |
| Production | **Proposed** `tremendous-sturgeon-449` (env empty) | Operator host + prod `VITE_*` | See Phase 8.2A docs — **do not deploy** until gates clear |

Required operator values for production/staging (never invented by agents):

- `AUTH_JWT_ISSUER`, `AUTH_JWKS_URL`, `AUTH_JWT_AUDIENCE`
- `INGEST_SECRET` (≥32 chars, non-placeholder, unique per env)
- `VITE_CONVEX_URL` (https, matching that Convex deployment)
- Resend / Arkesel only if email/SMS alerts enabled
- Static host domain + TLS certificate

See `docs/env-inventory.md` and `docs/production-auth-setup.md`.

---

## 3. Build and deploy sequence (non-production)

### Pre-checks

1. `pnpm test`
2. `pnpm exec tsc --noEmit`
3. `pnpm build`
4. Confirm no secrets in `VITE_*` or committed `.env*`
5. Confirm target is development or isolated staging — **not** production while gates remain open

### Backend (development)

```text
pnpm exec convex dev --once
```

For a named production deploy (when operator gates clear):

```text
pnpm exec convex deploy
```

Do **not** run destructive migrations automatically. Use `convex/migrations.ts` dry-run first. Additive optional schema fields are the default path.

### Frontend

```text
pnpm build
```

Upload `dist/` to the static host. Set build-time `VITE_CONVEX_URL` to the **target** Convex cloud URL only.

### Collector / firmware

Point `INGEST_URL` at `https://<deployment>.convex.site/ncu/ingest`. Keep firmware protocol unchanged. Do not flash from this runbook.

---

## 4. Smoke tests (post-deploy)

| Check | Expect |
|---|---|
| `GET /me` without token | Unauthorized / empty identity |
| `GET /me` with valid JWT | Identity when IdP configured |
| `POST /ncu/ingest` without secret | 401 |
| Inactive registered device | 403 |
| Oversized body | 413 / reject |
| `api.ops.overview` without ops perms | Forbidden |
| SPA without bearer | Soft “Not signed in” notices; no live org data |
| Demo pages | Still labelled fixtures |

---

## 5. Release checklist

- [ ] Target environment identified (dev / staging / prod)
- [ ] Auth + ingest env validated (`productionReady` / profile helper)
- [ ] Notify providers validated **if** enabled
- [ ] Migrations reviewed (additive or dry-run)
- [ ] Crons unchanged or intentionally updated (`convex/crons.ts`)
- [ ] Tests + tsc + build green
- [ ] Smoke tests above
- [ ] Rollback artifact retained (previous `dist/` + prior Convex revision note)
- [ ] No production claim while IdP / backup restore / hardware gates open

---

## 6. Rollback

| Surface | Rollback | Caveat |
|---|---|---|
| Frontend | Redeploy previous `dist/` | Immediate |
| Convex functions | Redeploy previous revision via Convex dashboard/CLI | Schema **writes already applied are not reversed** |
| Schema | Prefer forward-compatible optional fields | Destructive down-migrations are out of policy |
| Scheduled jobs | Restore prior `crons.ts` and redeploy | In-flight scheduler work may complete |
| Auth env | Revert Convex env vars carefully | Wrong issuer locks everyone out |
| Notify providers | Disable flags / restore keys | Outbox rows already sent stay sent |
| Collector | Point `INGEST_URL` / secret back | Firmware NVS may still hold old host |

**Prefer backward-compatible releases.** Rolling back code does not undo telemetry, alarms, audits, or lifecycle changes already written.

---

## 7. Dev-only helpers

- `scripts/operator.mjs` hardcodes the development Convex URL — do not use as a production client.
- `pnpm dev:mock` is local demo mode only.
