# Phase 8.5C — Production Convex provisioning & integration preflight

**Date:** 2026-10-31  
**Overall:** **BLOCKED** (required production Auth0 + frontend→Convex wiring not verified)  
**Production deployment authorization:** **NOT AUTHORIZED**  
**Convex code deploy to production:** **NOT PERFORMED** (forbidden in this phase)

---

## 1. Verified deployment identity

| Check | Result |
|---|---|
| `convex env list --deployment production` | Targets **`tremendous-sturgeon-449`** |
| Env before this phase | **Empty** (0 variables) |
| Confusion with kangaroo / roadrunner / mosquito | **No** — those remain separate |
| `GET https://tremendous-sturgeon-449.convex.site/me` (no token) | **404** (staging returns **401**) — strongly indicates **no production HTTP functions** on sturgeon yet |

---

## 2. Live Cloudflare Pages configuration (evidence from public bundle)

URL: `https://icanova.pages.dev`  
Asset observed during this preflight: `assets/index-Bj2FZgpP.js` (hash changes per deploy).

| Public variable | Value in live build |
|---|---|
| `VITE_CONVEX_URL` | `https://dapper-roadrunner-247.convex.cloud` (**staging**) |
| `VITE_CONVEX_SITE_URL` | `https://dapper-roadrunner-247.convex.site` (**staging**) |
| `VITE_OIDC_ISSUER` | `https://dev-notfczud6xx8hhxf.us.auth0.com` (**staging Auth0 tenant**) |
| `VITE_OIDC_CLIENT_ID` | Present (32 chars; not printed) |
| `VITE_OIDC_AUDIENCE` | `icanova` |
| `VITE_OIDC_REDIRECT_URI` | `https://icanova.pages.dev/auth/callback` |
| `VITE_OIDC_LOGOUT_REDIRECT_URI` | `https://icanova.pages.dev/` |
| `tremendous-sturgeon-449` in bundle | Only in UX copy (“prod still empty”) — **not** as Convex URL |

**Conclusion:** Production frontend host is live, but the **SPA is still integrated with staging Auth0 + staging Convex**, not `tremendous-sturgeon-449`.

---

## 3. Auth0 production verification

| Requirement | Status |
|---|---|
| Dedicated production Auth0 tenant | **NOT VERIFIED** — live issuer is staging `dev-notfczud6xx8hhxf…` |
| Production SPA + API `icanova` | Audience `icanova` present; tenant separation **not** proven |
| Callback / logout / origin for Pages | Callback/logout for `icanova.pages.dev` present in SPA env |
| PKCE / access-token-only contract | Implemented in code; staging path previously exercised |
| Production-only Auth0 integration test | **NOT RUN** — no verified production tenant credentials |

JWKS for the **live (staging) issuer** is reachable (`200`, keys present). That does **not** prove a separate production tenant exists.

---

## 4. Convex production env provisioning decision

**No production Convex environment variables were set in this phase.**

Reasons (fail-closed):

1. Live Pages does not yet target sturgeon.  
2. Live Auth0 issuer is the **staging** tenant; phase rules forbid inventing a production tenant and discourage treating staging IdP as production without explicit acceptance.  
3. Copying staging `INGEST_SECRET` / notify keys is forbidden.  
4. `convex deploy` to production is **not authorized** here; empty AUTH on a deployment without functions cannot complete integration preflight.

### Required production Convex variables (names only)

| Variable | Class | Production status |
|---|---|---|
| `AUTH_JWT_ISSUER` | Required public | **MISSING** |
| `AUTH_JWKS_URL` | Required public | **MISSING** |
| `AUTH_JWT_AUDIENCE` | Required public (`icanova`) | **MISSING** |
| `INGEST_SECRET` | Required secret (≥32, ≠ staging/dev/recovery) | **MISSING** |
| `AUTH_JWT_JWKS` | Optional (self-host JWKS) | Must stay **unset** with Auth0 |
| `RESEND_*` / `ARKESEL_*` | Optional notify | **Absent** — leave delivery disabled |
| `EMAIL_ALERTS_ENABLED` / `SMS_ALERTS_ENABLED` | Optional flags | **Must stay unset** until approved |
| `TEST_NOTIFY_*` | Staging/lab only | **Forbidden** on production |

---

## 5. Integration results (what was / was not proven)

| Path | Result |
|---|---|
| Pages → Auth0 (staging tenant) → staging Convex | Previously exercised; not re-claimed as production |
| Pages → production Auth0 → production Convex | **NOT PROVEN** |
| Production `/me` auth | **BLOCKED** (404 / no functions + empty env) |
| Production ingest | **BLOCKED** (no `INGEST_SECRET`, no verified HTTP ingest route) |
| Notifications | **Disabled** — no prod providers set; **no messages sent** |
| Tenant isolation | Covered by existing automated tests; **not** proven on sturgeon data |

---

## 6. Environment isolation

| Env | Deployment | Status |
|---|---|---|
| Development | `effervescent-kangaroo-10` | Preserved |
| Staging | `dapper-roadrunner-247` | Preserved (still serves Pages) |
| Recovery | `vivid-mosquito-28` | Quarantined (Auth+ingest only) |
| Production | `tremendous-sturgeon-449` | Identity confirmed; **env empty**; functions likely undeployed |

---

## 7. Tests run this phase

| Suite | Result |
|---|---|
| `pnpm test` | **166 passed** |
| `pnpm build` | **PASS** |
| `check-frontend-secrets --dist` | **PASS** |
| Validator development/staging/recovery | **PASS** |
| Validator production | **FAIL** (expected — not provisioned) |

---

## 8. Exact next operator actions (order)

1. **Confirm production Auth0:** dedicated tenant **or** written acceptance that staging Auth0 may temporarily mint tokens for sturgeon.  
2. Record production issuer, JWKS URL, SPA client id, audience `icanova`, callbacks for `https://icanova.pages.dev`.  
3. **Authorize** setting on `tremendous-sturgeon-449` only: `AUTH_JWT_ISSUER`, `AUTH_JWKS_URL`, `AUTH_JWT_AUDIENCE=icanova`, new `INGEST_SECRET` (vault).  
4. **Separate authorization** to `convex deploy` functions to production (not done in 8.5C).  
5. Point Cloudflare Pages `VITE_CONVEX_URL` / `SITE_URL` at `tremendous-sturgeon-449` and rebuild.  
6. Verify login → `users.ensure` → org membership against **production**.  
7. Keep notify providers off until approved.

**PRODUCTION DEPLOYMENT NOT AUTHORIZED.**
