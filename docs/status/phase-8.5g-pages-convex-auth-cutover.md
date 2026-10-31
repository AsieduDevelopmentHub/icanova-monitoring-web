# Phase 8.5G — Cloudflare Pages Convex Auth staging cutover

**Date:** 2026-10-31  
**Pages project:** `icanova`  
**Public URL:** `https://icanova.pages.dev`  
**Convex target:** `dapper-roadrunner-247`  
**Final status:**  
- **STAGING FRONTEND: VERIFIED**  
- **PRODUCTION: NOT AUTHORIZED**

---

## Deployment

| Field | Value |
|---|---|
| Deploy command | `npx wrangler pages deploy dist --project-name icanova` (operator OAuth login) |
| Exit | **0** |
| New deployment URL | `https://5e33343b.icanova.pages.dev` |
| Production alias | `https://icanova.pages.dev` (serves same bundle) |
| New bundle | `assets/index-IxHDHlCX.js` |
| Previous live bundle (rollback ref) | `assets/index-Bj2FZgpP.js` (Auth0-era) |

Rollback: promote/redeploy prior Pages deployment that served `index-Bj2FZgpP.js`, or `wrangler pages deployment` history in the Cloudflare dashboard.

## Bundle verification (live)

| Check | `icanova.pages.dev` |
|---|---|
| HTTPS load | OK |
| `/auth/login` SPA | 200 |
| Convex URL | `https://dapper-roadrunner-247.convex.cloud` (3 embeds) |
| Auth0 host | **Absent** |
| Sturgeon | **Absent** |
| Private key material | **Absent** |

Note: Convex client error text may mention placeholder `happy-otter-123`; that is not the configured deployment URL.

## Hosted Password E2E

`E2E_CONVEX_AUTH=1 E2E_BASE_URL=https://icanova.pages.dev pnpm exec playwright test --config=playwright.hosted.config.ts e2e/convex-auth-staging.spec.ts`

| Test | Result |
|---|---|
| Auth0 isolation | **PASS** |
| Registration + no auto org admin | **PASS** |
| Login + create organization | **PASS** |
| Logout + bad password | **PASS** |
| **Total** | **4 passed** |

## Regression

| Check | Result |
|---|---|
| Unit tests | **186 passed** / 39 files |
| Roadrunner Convex Auth (8.5F) | Remains VERIFIED |

## Boundaries

- Sturgeon / production Convex: **not modified**  
- Auth0 tenant: **not modified**  
- Pages project/domain: unchanged (`icanova` / `icanova.pages.dev`)

**PRODUCTION DEPLOYMENT NOT AUTHORIZED.**
