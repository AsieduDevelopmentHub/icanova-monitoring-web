# Production Auth0 + SPA hosting (Phase 8.5A / 8.5B)

**Date:** 2026-10-31  
**Status (8.5D):** Host live; operator **accepted temporary shared Auth0 tenant**; production requires a **separate SPA** (`iCaNova Production`) — not yet verified. SPA still targets **staging Convex**. Production Convex env **empty**.  
**Audience:** `icanova` (shared API — do not duplicate)  
**Auth0 tenant (accepted for production temporarily):** `dev-notfczud6xx8hhxf.us.auth0.com`  
**Acceptance record:** `docs/status/phase-8.5d-shared-auth0-acceptance.md`  
**SPA create guide:** `docs/guide/production-auth0-spa-setup.md`

### Hosting / Auth0 / Convex checkpoint (8.5D evidence)

| Field | Status |
|---|---|
| Selected provider | **Cloudflare Pages** |
| Current SPA URL | `https://icanova.pages.dev` |
| Verified callback | `https://icanova.pages.dev/auth/callback` |
| Pages `VITE_OIDC_*` | **SET** (issuer/audience/redirect/logout); **Client ID still staging SPA** |
| Auth0 tenant on Pages | Staging tenant — **temporary production exception accepted** |
| Production Auth0 SPA | **OPEN** — create `iCaNova Production`; leave staging SPA unchanged |
| Pages `VITE_CONVEX_URL` | **Staging** `dapper-roadrunner-247` — **not** sturgeon |
| Production Convex `tremendous-sturgeon-449` | Identity OK; **0 env vars**; `/me` → **404** (functions likely undeployed) |
| Convex prod secrets | **BLOCKED** until production SPA Client ID verified + written deploy authorization |

SPA entry-point UX (Phase 8.2G): header always shows **Sign in** when unsigned (no longer gated on `oidcConfigured()`).

---

## 1. Auth0 design (shared tenant exception + separate SPA)

### Tenant

| Item | Production requirement (8.5D) |
|---|---|
| Tenant / domain | **Temporarily shared** with staging: `dev-notfczud6xx8hhxf.us.auth0.com` |
| Ownership | Named admin + backup admin |
| Future migration | Dedicated production Auth0 tenant remains required |
| SPA isolation | **Mandatory** separate production SPA Client ID |

Verified issuer / JWKS (shared tenant):

- Issuer: `https://dev-notfczud6xx8hhxf.us.auth0.com/` (trailing slash must match JWT `iss`)
- JWKS: `https://dev-notfczud6xx8hhxf.us.auth0.com/.well-known/jwks.json`

### Application (SPA)

| Item | Value |
|---|---|
| Type | Single Page Application |
| Token endpoint auth | **None** (public client) |
| Grant | Authorization Code + **PKCE** (S256) |
| Refresh tokens | Not required for current SPA (deferred) |
| Client ID | Public → `VITE_OIDC_CLIENT_ID` |
| Client secret | **Must not exist in SPA / `VITE_*` / git** |

### Allowed URLs (production host verified)

| Setting | Value |
|---|---|
| Callback | `https://icanova.pages.dev/auth/callback` |
| Logout | `https://icanova.pages.dev` and `https://icanova.pages.dev/` |
| Web origins | `https://icanova.pages.dev` |
| CORS / Allowed Origins (Auth0) | Same as web origins |

No wildcards. Apply these on the **production** SPA only; do not change the staging SPA.

### API / audience

| Item | Value |
|---|---|
| API identifier / audience | **`icanova`** (preferred) |
| Convex `AUTH_JWT_AUDIENCE` | Exact same string |
| SPA `VITE_OIDC_AUDIENCE` | Exact same string |
| Token used by Convex | Auth0 **access token** (not `id_token`) |
| Algorithm | RS256 |

Authorize the production SPA client for the production API (`icanova`).

### Security contract (verified in code)

| Check | Implementation |
|---|---|
| Missing audience fails closed | `auth.config.ts` — no provider without `AUTH_JWT_AUDIENCE`; `readOidcConfig` returns null without `VITE_OIDC_AUDIENCE` |
| No `dse-gateway` fallback | Removed |
| Access token for Convex | `selectConvexBearer` requires API `aud` on access token |
| Issuer / exp / nonce | Client guard + Convex customJwt |
| Org membership | Convex `requirePermission` / membership tables — not Auth0 org claims required today |

---

## 2. Operator Auth0 checklist (shared tenant — separate SPA)

Canonical steps: `docs/guide/production-auth0-spa-setup.md`.

1. Stay on the **existing** Auth0 tenant (do not create a new tenant in 8.5D).  
2. Create production **SPA** `iCaNova Production` (public, PKCE). **Do not** edit the staging SPA.  
3. Reuse existing API identifier `icanova` — **do not** create a duplicate API.  
4. Authorize production SPA → API `icanova`.  
5. Set callback: `https://icanova.pages.dev/auth/callback`.  
6. Set logout: `https://icanova.pages.dev` (+ `/` if needed).  
7. Set allowed web origins: `https://icanova.pages.dev`.  
8. Confirm Authorization Code + PKCE; no SPA client secret.  
9. Obtain a test access token; confirm `aud` includes `icanova`, `iss` matches issuer, RS256.  
10. Confirm JWKS URL returns keys.  
11. Record **non-secret** identifiers (tenant domain, **new** client id, audience, issuer, JWKS URL) in the operator vault inventory.  
12. Store any management secrets **only** in the approved secret store.  
13. Never commit secrets; never put client secrets in `VITE_*`.  
14. Do **not** set Convex production `AUTH_*` / retarget Pages to sturgeon until written authorization (see frontend plan).

---

## 3. SPA hosting — repository facts

| Fact | Evidence |
|---|---|
| Output | `pnpm build` → `dist/` |
| Router | React Router SPA (`/auth/callback`, `/admin/*`, …) |
| SSR / edge API | None in this repo |
| CI / `vercel.json` | **Absent** |
| Staging host | Local / Vite preview only for E2E |
| Backend | Convex (separate from SPA host) |

**Status:** `OPERATOR DECISION REQUIRED`

---

## 4. Hosting options (compatible with this repo)

| Option | Build | Output | SPA fallback | Env (`VITE_*`) | Domain / TLS | Rollback | Deploy workflow | Auth URL impact | Ops complexity | Fit |
|---|---|---|---|---|---|---|---|---|---|---|
| **Cloudflare Pages** (recommended) | `pnpm build` | `dist/` | `public/_redirects` → shipped in `dist/` | Build-time vars in Pages project | Custom domain + free TLS | Deployment history | Dashboard upload or `wrangler pages deploy` (no CI required) | Stable `https://<domain>` for Auth0 | Low | **Best match** for static Vite + manual deploy culture |
| Netlify | same | `dist/` | same `_redirects` | Build env | Custom + TLS | Deploy history | CLI / UI drag-drop | Same | Low | Equivalent alternative |
| Object storage + CDN (S3 / R2 + CloudFront / similar) | same | sync `dist/` | CloudFront error/SPA rules | CI or local build machine | Custom + ACM/TLS | Prior object version / prior sync | Scripted sync | Same | Medium–high | Good if AWS/R2 already mandated |
| GitHub Pages | same | `dist/` | Weaker (404.html hacks) | Actions secrets | Custom possible | Git history | Needs Actions | Same | Medium | Weak SPA story; avoid unless forced |
| Vercel | same | `dist/` | Framework preset | Project env | Custom + TLS | Deploy history | CLI / Git | Same | Low | Compatible but **not assumed**; no `vercel.json` today |
| Self-hosted nginx | same | `dist/` | `try_files … /index.html` | Build host env | Operator TLS | Prior artifact | rsync/scp | Same | Higher | Fine for on-prem |

### Recommendation

**Cloudflare Pages** (or Netlify if the operator already uses it).

Why (this architecture, not generic preference):

1. The product is a **static Vite SPA** talking to **Convex** — no server runtime on the SPA host.  
2. The programme already assumes **manual** deploys (no CI). Pages/Netlify support artifact upload without forcing GitHub Actions.  
3. Auth0 needs a **stable HTTPS origin**; Pages provides custom domain + TLS without inventing infra.  
4. SPA fallback is already prepared via `public/_redirects`.  
5. Rollback is a prior deployment promote — matches the production runbook’s frontend rollback model.

Final choice remains: **`OPERATOR DECISION REQUIRED`**.

---

## 4b. Cloudflare Pages — exact prep (when selected; do not deploy yet)

Verified in-repo 2026-10-31 (local build only):

| Setting | Value |
|---|---|
| Build command | `pnpm build` |
| Output directory | `dist/` |
| Node | Match repo (`packageManager` pnpm 12.x) |
| SPA fallback | `public/_redirects` → `/* /index.html 200` (confirmed present in `dist/_redirects`) |
| Auth routes (React Router) | `/auth/login`, `/auth/callback` |
| Direct refresh | Relies on `_redirects` 200 rewrite (not 404→index) |
| TLS | Cloudflare-managed after custom domain attached |
| Deploy method (later) | Direct Upload of `dist/` **or** `wrangler pages deploy dist` — **not executed** |
| Rollback | Promote previous Pages deployment |
| Build env (later) | Public `VITE_*` only — never secrets |

After operator selects Cloudflare Pages **and** provides `<production-domain>`:

1. Create Pages project (no production traffic required for empty project).  
2. Attach custom domain + wait for TLS.  
3. Fill `.env.production.local` from `.env.production.example` with that domain.  
4. Only then create production Auth0 SPA callbacks for that domain.  
5. Convex prod secrets still wait until Auth0 token contract is verified.

If the operator selects **Netlify** or another host instead, keep the same build/output/Auth0 URL pattern; adjust only provider-specific SPA rules.

---

## 5. Production domain plan (placeholders only)

Do not invent or register a real domain in this task.

| Role | Placeholder |
|---|---|
| SPA | `https://<production-domain>/` |
| Auth callback | `https://<production-domain>/auth/callback` |
| Logout | `https://<production-domain>/` |
| Convex cloud (after approved deploy) | `https://tremendous-sturgeon-449.convex.cloud` *(confirm identity first)* |
| Convex site / ingest | `https://tremendous-sturgeon-449.convex.site` / `/ncu/ingest` |

DNS and Auth0 URL changes wait until the operator selects `<production-domain>`.

---

## 6. Precondition gate — Convex production secrets

`tremendous-sturgeon-449` remains **empty** by design until:

1. Production SPA host selected  
2. Production domain selected  
3. Separate production Auth0 SPA + API configured (callbacks match domain)  
4. Production Convex deployment identity re-confirmed  

**Status:** `BLOCKED — awaiting verified production Auth0 + hosting`

---

## 6b. Auth0 verification procedure (after operator provisions; not run in 8.5B)

1. Login page loads on production SPA.  
2. Auth0 redirect correct (prod tenant only).  
3. PKCE completes; callback succeeds.  
4. Access token obtained; `aud` includes `icanova`; `iss` matches prod issuer.  
5. `/me` against production Convex **only after** prod `AUTH_*` are intentionally set.  
6. Org membership enforced; foreign org denied.  
7. Logout succeeds.  
8. No tokens/secrets in application logs.

Do **not** call production `/me` while Convex prod env is empty.

---

## 7. Frontend env design

### Allowed in Vite / SPA build

`VITE_CONVEX_URL`, `VITE_OIDC_ISSUER`, `VITE_OIDC_CLIENT_ID`, `VITE_OIDC_AUDIENCE`, `VITE_OIDC_REDIRECT_URI`, `VITE_OIDC_LOGOUT_REDIRECT_URI`, optional Sentry/GA.

### Forbidden in `VITE_*` / `dist/`

`INGEST_SECRET`, Auth0 client secrets, Convex deploy keys, Resend/Arkesel keys, device credentials, PEM/private keys, `TEST_NOTIFY_*`, recovery deploy keys.

Validators: `scripts/validate-env-profile.mjs`, `scripts/check-frontend-secrets.mjs`.

Template: `.env.production.example` (no real values).
