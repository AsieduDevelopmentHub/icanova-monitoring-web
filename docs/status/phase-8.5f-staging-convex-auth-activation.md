# Phase 8.5F — Staging Convex Auth activation

**Date:** 2026-10-31  
**Staging deployment:** `dapper-roadrunner-247` (roadrunner)  
**Production:** `tremendous-sturgeon-449` — **untouched**  
**Final status:**  
- **STAGING (Convex Auth backend + live Password E2E via preview): VERIFIED**  
- **STAGING (Cloudflare Pages cutover): BLOCKED** — no `CLOUDFLARE_API_TOKEN` in this environment  
- **PRODUCTION: NOT AUTHORIZED**

---

## 1. Preflight

| Check | Result |
|---|---|
| Target | `dapper-roadrunner-247` / `--deployment staging` |
| Production env | Empty (0 vars) before and after |
| Key format | RS256 PKCS8 PEM with newlines→spaces + JWKS JSON (`use: sig`) — matches `@convex-dev/auth` `generateKeys` |
| Auth0 | Left inactive; `AUTH_JWT_*` remain on staging but unused by active `auth.config.ts` |

## 2. Staging credentials

| Variable | Status on roadrunner |
|---|---|
| `JWT_PRIVATE_KEY` | **SET** (value not logged) |
| `JWKS` | **SET** (value not logged) |

Keys generated locally to gitignored `.jwt/staging/`, applied via `convex env set --deployment staging --from-file`, then local key file removed. Not copied to production.

## 3. Function deploy

| Step | Result |
|---|---|
| First push | Failed: legacy `/.well-known/jwks.json` conflicted with Convex Auth routes |
| Fix | Removed lab `AUTH_JWT_JWKS` HTTP route from `convex/http.ts` |
| Deploy | **Success** → `https://dapper-roadrunner-247.convex.cloud` |
| Auth tables | Indexes added for `authAccounts`, `authSessions`, `authRefreshTokens`, … + `users.email` / `users.phone` |
| JWKS HTTP | `GET /.well-known/jwks.json` → 200, 1 RSA key |
| OIDC discovery | `GET /.well-known/openid-configuration` → 200 |
| `/me` no bearer | 401 |

Deploy key confirmed to name `dapper-roadrunner-247` only (not sturgeon/kangaroo/mosquito).

## 4. Frontend build

| Check | Result |
|---|---|
| `VITE_CONVEX_URL` | `https://dapper-roadrunner-247.convex.cloud` |
| Auth0 `VITE_OIDC_*` | Forced empty at build; bundle **clean** of Auth0 host / staging client id |
| Secrets in bundle | No PEM / ingest secret; `JWT_PRIVATE_KEY` string only in UI help text |
| `_redirects` | Present |
| Cloudflare Pages deploy | **BLOCKED** — `wrangler pages deploy` requires `CLOUDFLARE_API_TOKEN` (not available) |
| Live `icanova.pages.dev` | Still prior Auth0-era bundle until operator deploys `dist/` |

## 5. Live authentication evidence (roadrunner)

Playwright `e2e/convex-auth-staging.spec.ts` with `E2E_CONVEX_AUTH=1` against local preview of Auth0-free `dist/` → roadrunner:

| Test | Result |
|---|---|
| Auth0 isolation (password form, no Auth0 redirect) | **PASS** |
| Registration + session + no auto org membership | **PASS** |
| Login + create organization (membership) + settings | **PASS** |
| Logout + invalid credentials rejected | **PASS** |
| **Total** | **4 passed** |

Distinguishes from mocked `convex-test` / `withIdentity` suite.

## 6. Regression

| Check | Result |
|---|---|
| `pnpm test` | **182 passed** / 38 files (8.5E baseline was 181) |
| `pnpm build` | **PASS** |

## 7. Outstanding risks

- Pages host not yet serving Convex Auth SPA (operator CF token required).  
- Staging still has unused Auth0 `AUTH_JWT_*` env (harmless while `auth.config.ts` is Convex-only).  
- Open sign-up remains; org access still requires create/grant.  
- Password reset email still deferred.  
- Email-less legacy Auth0 users still need manual recovery if rebound.

## Next safest action

Operator sets `CLOUDFLARE_API_TOKEN` and runs `wrangler pages deploy dist --project-name icanova` with the Auth0-free roadrunner build, then smoke Sign in on `https://icanova.pages.dev`. Do not touch sturgeon.

**PRODUCTION DEPLOYMENT NOT AUTHORIZED.**
