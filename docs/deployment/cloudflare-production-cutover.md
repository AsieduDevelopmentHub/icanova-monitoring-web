# Cloudflare Pages production cutover (Phase 10)

**Date:** 2026-10-31  
**Pages project:** `icanova`  
**Status:** PLAN ONLY — **do not cut over without written authorization**  
**Must remain:** Cloudflare Pages continues to serve the **staging** Convex backend until authorization. Do not configure a custom production domain in this phase. Do not deploy a sturgeon-pointed SPA without approval.

Related evidence:

- `docs/status/phase-8.5g-pages-convex-auth-cutover.md`
- `docs/status/phase-10-data-persistence.md`
- `docs/guide/production-auth0-and-hosting.md` §4b
- `scripts/assert-dist-convex-url.mjs`
- `package.json` → `build:staging` / `build:production`

---

## 1. Audit — current Pages project `icanova`

| Field | Value (repo evidence) |
|---|---|
| Project name | `icanova` |
| Staging / live alias | `https://icanova.pages.dev` |
| Example verified deployment | `https://5e33343b.icanova.pages.dev` (8.5G Convex Auth cutover) |
| Current backend intent | **Staging** `dapper-roadrunner-247` |
| Live bundle check (2026-10-31) | Embeds `dapper-roadrunner-247` only; kangaroo / sturgeon absent (`phase-10-data-persistence.md`) |
| Output directory | `dist/` |
| SPA fallback | `public/_redirects` → `/* /index.html 200` (copied into `dist/`) |
| Deploy command (operator) | `npx wrangler pages deploy dist --project-name icanova` |
| Preview deployments | Per-deploy `https://<hash>.icanova.pages.dev`; production alias serves the promoted deployment |
| Custom domain | **Not configured** in this programme; do not attach without separate authorization |
| Auth on staging Pages | Convex Auth Password (Auth0 inactive for live login; Auth0-era rollback refs exist historically) |

### Required public build-time variables

Only `VITE_*` (and similar public) values may enter the SPA build. Never embed secrets.

| Variable | Staging (current) | Production cutover (authorized only) |
|---|---|---|
| `VITE_CONVEX_URL` | `https://dapper-roadrunner-247.convex.cloud` | `https://tremendous-sturgeon-449.convex.cloud` |
| Other public `VITE_*` | As needed for staging UX (OIDC may be unused when Convex Auth is active) | Match production host + Auth contract |

**Backend URL rule:** The baked `VITE_CONVEX_URL` **is** the backend. Wrong host = empty/wrong org/gateway/generator data (see Phase 10 data-persistence root cause).

Forbidden in `VITE_*` / `dist/`: `INGEST_SECRET`, JWT private keys, deploy keys, Resend/Arkesel, device credentials, `TEST_NOTIFY_*`. Gate: `scripts/check-frontend-secrets.mjs --dist`.

---

## 2. Deployment identity map (prevent mixups)

| Alias | Convex host | Role |
|---|---|---|
| **kangaroo** | `effervescent-kangaroo-10.convex.cloud` | Development |
| **roadrunner** | `dapper-roadrunner-247.convex.cloud` | Staging (Pages today) |
| **sturgeon** | `tremendous-sturgeon-449.convex.cloud` | Production (empty / not authorized) |
| **mosquito** | `vivid-mosquito-28.convex.cloud` | Quarantined recovery — never point Pages here |

**Hard rules**

1. Staging Pages builds must embed **roadrunner** only.  
2. Production cutover builds must embed **sturgeon** only — and only after written authorization.  
3. Never bake kangaroo into Pages `icanova`.  
4. Never bake mosquito into any customer-facing Pages deploy.  
5. Never use bare `pnpm build` for Pages deploy prep (loads `.env.local` → often kangaroo).

---

## 3. Build commands (mandatory gates)

| Intent | Command | Assert |
|---|---|---|
| Staging Pages deploy | **`pnpm build:staging`** | `vite build --mode staging` → `scripts/assert-dist-convex-url.mjs staging` → frontend secret scan |
| Production cutover (authorized only) | **`pnpm build:production`** | `vite build --mode production` → `scripts/assert-dist-convex-url.mjs production` → frontend secret scan |
| Re-check existing `dist/` | `pnpm check:dist-staging` or `node scripts/assert-dist-convex-url.mjs production` | Same host rules |

`scripts/assert-dist-convex-url.mjs` behaviour:

- **staging** must include `dapper-roadrunner-247.convex.cloud`; forbids kangaroo, sturgeon, mosquito.  
- **production** must include `tremendous-sturgeon-449.convex.cloud`; forbids kangaroo, roadrunner, mosquito.  
- Scans `dist/**/*.{js,html,css,map}`; fails closed on missing or forbidden hosts.

Operator rule before every staging upload:

```bash
pnpm build:staging
# confirm PASS dist-convex-url profile=staging
npx wrangler pages deploy dist --project-name icanova
```

**Do not run production cutover** (`pnpm build:production` + Pages promote to sturgeon) without written authorization. Running the production assert locally is fine for dry-run; uploading that `dist/` is not.

---

## 4. Authorized cutover sequence (do not execute without approval)

Stop if any step fails or the wrong Convex host appears in `dist/` or the live bundle.

| Step | Action | Stop if |
|---|---|---|
| 0 | Written production authorization + sturgeon secrets/functions ready (separate Convex readiness docs) | Missing authorization or empty/undeployed sturgeon |
| 1 | Record current live Pages deployment URL / bundle hash (rollback ref) | No known-good staging artifact |
| 2 | `pnpm build:production` | Assert fails; forbidden host present; secret scan fails |
| 3 | Manually confirm `dist/` contains sturgeon host only (spot-check + assert log) | roadrunner/kangaroo/mosquito found |
| 4 | `npx wrangler pages deploy dist --project-name icanova` | Wrong project name; deploy error |
| 5 | Verify `https://icanova.pages.dev` (and new hash URL) embeds sturgeon only | Staging URL still expected for rollback path |
| 6 | Auth smoke: login, protected routes, logout/session expiry | Auth lockout / wrong backend |
| 7 | Critical routes: dashboard, sites/devices/generators lists, alarms | Blank fleet due to empty prod DB is expected until seeded — distinguish from wrong-host |
| 8 | Error/offline handling spot-check | Uncaught secret leaks in console |
| 9 | Declare cutover success **or** execute §5 rollback | — |

### Post-cutover SPA expectations

1. Production frontend uses production Convex URL only.  
2. No staging backend URL in the production build.  
3. No production backend URL left in future staging builds (`build:staging` assert).  
4. No private credentials in the bundle.  
5. Authentication works against sturgeon.  
6. Protected routes require a session.  
7. Logout and session expiry behave correctly.  
8. Critical dashboard routes load.  
9. Error and offline states remain usable.

---

## 5. Rollback to last verified staging deploy

**Default rollback for unauthorized or failed cutover:** restore the last **roadrunner**-pointed Pages deployment (not mosquito, not kangaroo).

| Step | Action |
|---|---|
| 1 | Cloudflare dashboard → Pages → `icanova` → Deployments → promote/rollback to last known-good **staging** deployment **or** rebuild with `pnpm build:staging` and redeploy that `dist/` |
| 2 | Confirm live alias `https://icanova.pages.dev` embeds `dapper-roadrunner-247` only (`assert` / bundle search) |
| 3 | Hard-refresh / account for CDN cache; re-run Auth + fleet smoke on staging |
| 4 | Leave sturgeon untouched unless a separate backend rollback was authorized |

Historical rollback reference (8.5G): prior Auth0-era bundle `assets/index-Bj2FZgpP.js`; prefer the latest verified **Convex Auth + roadrunner** deployment over ancient Auth0 bundles unless specifically required.

---

## 6. Explicit non-actions (this document)

- Do **not** cut over without authorization.  
- Do **not** attach or change custom domains here.  
- Do **not** set production Convex secrets or deploy sturgeon functions from this doc alone.  
- Do **not** point Pages at mosquito.  
- Do **not** treat a successful staging Pages deploy as production cutover.
