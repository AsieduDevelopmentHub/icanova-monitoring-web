# Phase 8.5G — Cloudflare Pages Convex Auth staging cutover

**Date:** 2026-10-31  
**Pages project:** `icanova`  
**Public URL:** `https://icanova.pages.dev`  
**Convex target:** `dapper-roadrunner-247`  
**Final status:**  
- **STAGING FRONTEND: BLOCKED** — Cloudflare API authorization unavailable  
- **PRODUCTION: NOT AUTHORIZED**

---

## Preflight

| Check | Result |
|---|---|
| Pages project / domain | Existing `icanova` / `icanova.pages.dev` (live) |
| Live Pages bundle (before cutover) | `index-Bj2FZgpP.js` (prior Auth0-era build) |
| Verified `dist/` rebuild | `index-IxHDHlCX.js` — embeds `dapper-roadrunner-247`, **no** Auth0 host, **no** sturgeon, **no** PEM secrets |
| `_redirects` | Present in `dist/` |
| Auth0 env required | **No** |
| Sturgeon / prod | Untouched |

`dist/` was rebuilt only because the on-disk bundle no longer contained the roadrunner URL (preflight fail). Build used empty `VITE_OIDC_*` overrides.

## Cloudflare authorization (stop gate)

| Source | Result |
|---|---|
| `CLOUDFLARE_API_TOKEN` / `CF_API_TOKEN` (process/user/machine) | **Absent** |
| `.env.local` / `.env.staging.local` / `.env.recovery.local` | **No CF keys** |
| `wrangler whoami` | **Not authenticated** |

**Deploy was not attempted** (no invent/bypass of credentials).

### Operator setup (minimum permissions)

1. Cloudflare Dashboard → **My Profile** → **API Tokens** → **Create Token**.  
2. Custom token with **Account → Cloudflare Pages → Edit** (covers `wrangler pages deploy` / Pages Write).  
3. Restrict to the account that owns project `icanova` if prompted.  
4. Optionally set Account ID as `CLOUDFLARE_ACCOUNT_ID` (Wrangler may prompt otherwise).  
5. Export in the **local shell only** (never commit, never put in `VITE_*`):

```powershell
$env:CLOUDFLARE_API_TOKEN = "<token>"
# optional:
$env:CLOUDFLARE_ACCOUNT_ID = "<account_id>"
```

6. Deploy the verified tree:

```powershell
npx wrangler pages deploy dist --project-name icanova
```

7. Record previous deployment id (rollback) and new deployment id from Wrangler output.  
8. Smoke Password login on `https://icanova.pages.dev` (no Auth0 redirect).

Do **not** paste the token into source, chat history intentionally, or git.

## Deploy / hosted verification

| Step | Status |
|---|---|
| Pages deploy | **NOT RUN** |
| Hosted Password E2E | **NOT RUN** |
| Rollback ids | Live pre-cutover bundle ref: `index-Bj2FZgpP.js`; new deploy id: N/A |

## Remaining risks

- Live Pages still serves Auth0-era SPA until operator deploy.  
- Roadrunner Convex Auth remains VERIFIED (8.5F); only the public host is stale.

## Boundaries

No sturgeon changes, no Auth0 tenant edits, no production retarget.

**PRODUCTION DEPLOYMENT NOT AUTHORIZED.**
