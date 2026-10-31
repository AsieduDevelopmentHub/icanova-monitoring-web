# Phase 8.5D — Production frontend Auth0 configuration plan

**Date:** 2026-10-31  
**Host:** `https://icanova.pages.dev` (Cloudflare Pages)  
**IdP policy:** Shared staging Auth0 tenant + **separate** production SPA Client ID (operator-created)  
**Backend target (future cutover):** `tremendous-sturgeon-449` — **not** retargeted in this phase

---

## 1. Authentication implementation map (code)

| Concern | Location | Notes |
|---|---|---|
| Public OIDC config | `src/auth/oidc.ts` → `readOidcConfig` | Fail-closed if issuer/client/redirect/audience missing |
| Login | `src/auth/AuthLogin.tsx` → `beginLogin` | Authorization Code + PKCE |
| Callback route | `src/main.tsx` → `auth/callback` → `AuthCallback` | Exact path `/auth/callback` |
| Logout | `src/shell/Shell.tsx` → `logout(readOidcConfig())` | Uses `VITE_OIDC_LOGOUT_REDIRECT_URI` or redirect |
| Bearer storage | `src/platform/bearer.ts` | `sessionStorage` access token |
| Convex bearer selection | `selectConvexBearer` | Requires access token `aud` = API audience; validates ID token separately |
| Convex JWT provider | `convex/auth.config.ts` | `AUTH_JWT_ISSUER` + `AUTH_JWKS_URL` + `AUTH_JWT_AUDIENCE` |
| Identity ensure | `convex/auth.ts` / `users.ensure` | After login |
| Org RBAC | `convex/permissions.ts` / `authz.ts` | Membership required for org data |
| Frontend validators | `scripts/validate-env-profile.mjs`, `scripts/check-frontend-secrets.mjs` | Prod profile fails until vars complete; blocks secrets in `VITE_*` |

---

## 2. Exact production frontend variables (Cloudflare Pages build)

Set at **build time** (Vite embeds `VITE_*`). Do not invent Client ID values.

| Variable | Production intent | Current live Pages (2026-10-31) |
|---|---|---|
| `VITE_CONVEX_URL` | `https://tremendous-sturgeon-449.convex.cloud` after authorized cutover | Still `https://dapper-roadrunner-247.convex.cloud` |
| `VITE_OIDC_ISSUER` | `https://dev-notfczud6xx8hhxf.us.auth0.com` (shared tenant — accepted) | Same staging issuer |
| `VITE_OIDC_CLIENT_ID` | **New** `iCanOva Production` SPA Client ID | Still **staging** SPA Client ID (len=32) |
| `VITE_OIDC_AUDIENCE` | `icanova` | `icanova` |
| `VITE_OIDC_REDIRECT_URI` | `https://icanova.pages.dev/auth/callback` | Same |
| `VITE_OIDC_LOGOUT_REDIRECT_URI` | `https://icanova.pages.dev/` | Same |
| `VITE_OIDC_AUTHORIZATION_ENDPOINT` | Optional; default `{issuer}/authorize` | Unset (default) |
| `VITE_OIDC_TOKEN_ENDPOINT` | Optional; default `{issuer}/oauth/token` | Unset (default) |
| `VITE_OIDC_END_SESSION_ENDPOINT` | Optional | Unset |

**Never** set: Auth0 client secret, Convex deploy key, `INGEST_SECRET`, Resend/Arkesel keys in any `VITE_*` variable.

---

## 3. Exact production Convex authentication variables (sturgeon — plan only)

Do **not** set until written authorization. Do **not** copy staging secret values.

| Variable | Production intent |
|---|---|
| `AUTH_JWT_ISSUER` | `https://dev-notfczud6xx8hhxf.us.auth0.com/` (confirm exact JWT `iss`, including trailing slash) |
| `AUTH_JWKS_URL` | `https://dev-notfczud6xx8hhxf.us.auth0.com/.well-known/jwks.json` |
| `AUTH_JWT_AUDIENCE` | `icanova` |
| `INGEST_SECRET` | **New** production-only secret (never copy from roadrunner) |

Notify providers remain disabled unless separately authorized.

---

## 4. Cutover sequence (after operator creates SPA + supplies Client ID)

1. Operator creates `iCanOva Production` SPA per `docs/guide/production-auth0-spa-setup.md`.  
2. Operator records production Client ID in vault (not git).  
3. **Separate authorization** required before: set sturgeon `AUTH_*` + new `INGEST_SECRET`.  
4. **Separate authorization** required before: deploy Convex functions to production.  
5. Rebuild/redeploy Pages with production Client ID **and** (only when ready) `VITE_CONVEX_URL` → sturgeon.  
6. Verify: Sign in → callback → `users.ensure` → `/me` → org membership on **production**.  
7. Keep staging SPA + roadrunner unchanged.

Until steps 3–6 are authorized and complete, overall status remains **BLOCKED** for production auth cutover; **PRODUCTION DEPLOYMENT NOT AUTHORIZED**.

---

## 5. Live evidence snapshot (this phase)

| Check | Result |
|---|---|
| Pages host | `https://icanova.pages.dev` |
| Callback in live bundle | `https://icanova.pages.dev/auth/callback` |
| Live issuer | staging tenant `dev-notfczud6xx8hhxf…` |
| Live Client ID | staging SPA (not yet production SPA) |
| Live Convex | `dapper-roadrunner-247` |
| Prod Convex env | **empty** (`tremendous-sturgeon-449`) |
