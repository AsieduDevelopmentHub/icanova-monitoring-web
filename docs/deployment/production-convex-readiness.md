# Production Convex readiness — `tremendous-sturgeon-449` (Phase 10)

**Date:** 2026-10-31  
**Authorization:** **`PRODUCTION: NOT AUTHORIZED`**  
**This document is PREPARED ONLY.** Do **not** set env vars, deploy functions, cut over Pages, flash hardware, or print secrets.

Companion inventories: `docs/security/production-secret-inventory.md`, `docs/status/phase-8-final.md`, `docs/status/phase-9-final.md`.

---

## 1. Identity verification (read-only)

| Check | Result (Phase 10) |
|---|---|
| Deployment name | `tremendous-sturgeon-449` (designated production) |
| `pnpm exec convex env list --deployment tremendous-sturgeon-449` | **No environment variables set** |
| `pnpm exec convex env list --deployment production` | Same — empty |
| Modified in this phase? | **No** |

Other deployments (do not overwrite):

| Role | Name |
|---|---|
| Staging (live Pages) | `dapper-roadrunner-247` |
| Development | `effervescent-kangaroo-10` |
| Recovery | `vivid-mosquito-28` |

### HTTP probe (no credentials sent)

| Request | Result | Interpretation |
|---|---|---|
| `POST https://tremendous-sturgeon-449.convex.site/ncu/ingest` (empty JSON, no `Authorization`) | **503** | Consistent with deployed ingest handler + missing `INGEST_SECRET` (`unconfigured` path in `convex/http.ts`) |
| `GET …/me` (no token) | **401** | Auth HTTP surface responds (not a bare 404) |

**Gap vs Phase 8.5C / phase-8-final:** those docs recorded **404** on sturgeon HTTP (interpreted as undeployed functions). Phase 10 observes **503/401** with **still-empty env**. Treat as: platform/routes may already exist while secrets remain unset. **Re-confirm in Convex dashboard before any authorized action.** Do not deploy or mutate from this documentation pass.

---

## 2. Active auth model (accuracy vs older runbooks)

| Item | Current truth |
|---|---|
| Active SPA login | **Convex Auth Password** (`JWT_PRIVATE_KEY` + `JWKS`; `auth.config.ts` uses `CONVEX_SITE_URL`) |
| Auth0 | **FUTURE / INACTIVE** (`src/auth/integrations/auth0/`, example config only) |
| Staging host | Pages `icanova.pages.dev` → **roadrunner**, not sturgeon |

Older production runbooks that require Auth0 `AUTH_JWT_*` before first prod deploy are **superseded for the active path**. When production is authorized, provision **Convex Auth keys**, not staging Auth0 env copies.

---

## 3. Init sequence (PREPARED ONLY — do not execute)

Stop if written authorization is missing or the dashboard shows the wrong deployment.

1. **Authorize** — written approval to provision and deploy `tremendous-sturgeon-449`.  
2. **Generate new secrets offline** (never copy staging):  
   - `JWT_PRIVATE_KEY` + `JWKS` (Convex Auth `generateKeys` style)  
   - `INGEST_SECRET` (≥32 chars, unique)  
   - Optional later: `AUTH_RESEND_KEY` / `AUTH_EMAIL_FROM`, notify keys, VAPID  
3. **Set Convex env** on production only (`convex env set --deployment production` / sturgeon) — names verified via `env list`; values never logged.  
4. **Forbid** on production: `TEST_NOTIFY_*`, `AUTH_PASSWORD_RESET_DEV=1`, staging secret reuse.  
5. **Deploy functions** — e.g. `pnpm exec convex deploy` with production deploy key / `--env-file .env.production.local` targeting sturgeon only.  
6. **Smoke (prod):** openid/JWKS discovery as applicable; `/me` without token → 401; ingest without bearer → 401/503→401 once secret set; Password login smoke on a controlled host.  
7. **Frontend cutover:** build SPA with production `VITE_CONVEX_URL=https://tremendous-sturgeon-449.convex.cloud`; secret-scan; deploy Cloudflare Pages; smoke.  
8. **Record** commit SHA, Pages deployment id, Convex revision, rollback refs.

Detailed historical checklist: `docs/guide/production-deployment-runbook.md` (update Auth0-centric steps mentally to Convex Auth when executing under authorization).

---

## 4. Deploy instructions (prepared commands — NOT RUN)

```text
# Verify identity (safe)
pnpm exec convex env list --deployment tremendous-sturgeon-449

# AFTER authorization only — examples, placeholders:
# pnpm exec convex env set JWT_PRIVATE_KEY "<from-vault>" --deployment production
# pnpm exec convex env set JWKS "<from-vault-json>" --deployment production
# pnpm exec convex env set INGEST_SECRET "<new-unique-secret>" --deployment production
# pnpm exec convex deploy --env-file .env.production.local --yes
# pnpm build   # with production VITE_CONVEX_URL only
# wrangler pages deploy dist --project-name icanova
```

**Phase 10 did not run** env set, deploy, Pages cutover, or secret generation against production.

---

## 5. Rollback limits

| Layer | Can roll back? | Notes |
|---|---|---|
| Cloudflare Pages | Yes | Redeploy prior `dist/` / deployment id |
| Convex function revision | Usually yes | Redeploy prior revision to **same** deployment |
| Schema / table shape | **No** easy rollback | Prefer backward-compatible migrations; forward-fix |
| Env vars | Careful restore from vault | Wrong JWT keys = auth lockout |
| Device credential hashes | Do not mass-clear | Shared `INGEST_SECRET` remains safety net until approved cutover |
| Copied staging data | N/A | Prod should start empty; do not import staging blindly |

---

## 6. Required env inventory (production)

### Must have before go-live (Convex)

| Name | Class |
|---|---|
| `JWT_PRIVATE_KEY` | Private |
| `JWKS` | Public JWK JSON |
| `INGEST_SECRET` | Private (new; ≠ staging/dev/recovery) |

`CONVEX_SITE_URL` is platform-managed for Convex Auth.

### Optional (enable only when authorized)

| Name | Notes |
|---|---|
| `AUTH_RESEND_KEY`, `AUTH_EMAIL_FROM` | Password-reset mail (prefer dedicated key) |
| `RESEND_*`, `ARKESEL_*`, `EMAIL_ALERTS_ENABLED`, `SMS_ALERTS_ENABLED` | Notify |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web Push |
| `INGEST_RATE_LIMIT_*` | Overrides; defaults OK |

### Frontend build (public)

| Name | Notes |
|---|---|
| `VITE_CONVEX_URL` | `https://tremendous-sturgeon-449.convex.cloud` after cutover |
| `VITE_SENTRY_DSN` / `VITE_GA_MEASUREMENT_ID` | Optional |

### Operator / CI (not runtime Convex)

| Name | Notes |
|---|---|
| `CONVEX_DEPLOY_KEY` / `CONVEX_DEPLOYMENT` | Vault only |
| `CLOUDFLARE_API_TOKEN` | Pages deploy |

Full table: `docs/security/production-secret-inventory.md`.

---

## 7. Alignment with Phase 8 / 9 finals

| Source claim | Phase 10 note |
|---|---|
| Phase 8/9: production **NOT AUTHORIZED** | **Still true** |
| Phase 8/9: sturgeon env empty | **Still true** (re-verified) |
| Phase 8: HTTP 404 / functions undeployed | **Stale relative to 503/401 probes** — re-check dashboard; do not assume blank slate for code |
| Phase 8 exception: password reset deferred | **Superseded by Phase 9** (reset implemented; live Resend inbox proof still outstanding) |
| Phase 9: shared `INGEST_SECRET` still valid by design | **Still true** — not eliminated |
| Phase 9 next: Phase 10 production authorization package | This doc is the **prepared** package; execution still gated |

---

## 8. Explicit non-actions (this phase)

- No `convex env set` on production  
- No `convex deploy` to sturgeon  
- No Pages `VITE_CONVEX_URL` cutover to sturgeon  
- No production secret generation printed to logs/chat  
- No hardware flash / ATP  

**Status:** Ready for operator execution **only after** written production authorization.
