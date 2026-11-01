# Production Auth0 SPA setup (shared tenant — Phase 8.5D)

**Date:** 2026-10-31  
**Tenant policy:** Use the **existing** Auth0 tenant currently serving staging (`dev-notfczud6xx8hhxf.us.auth0.com`). Do **not** create a new tenant in this phase.  
**SPA policy:** Create a **new** Single Page Application named **`iCaNova Production`**. Leave the existing staging SPA unchanged.  
**API policy:** Reuse existing API identifier **`icanova`**. Do **not** create a duplicate API.  
**Secrets:** Public SPA only — **no** frontend client secret; never put secrets in `VITE_*` or git.

---

## Verified application callback (from code)

Router (`src/main.tsx`):

```text
<Route path="auth/callback" element={<AuthCallback />} />
```

Production host (live): `https://icanova.pages.dev`

| Auth0 setting | Exact value (no wildcards) |
|---|---|
| Allowed Callback URLs | `https://icanova.pages.dev/auth/callback` |
| Allowed Logout URLs | `https://icanova.pages.dev` |
| Allowed Web Origins | `https://icanova.pages.dev` |

Optional trailing slash on logout: the live SPA uses `VITE_OIDC_LOGOUT_REDIRECT_URI=https://icanova.pages.dev/` — include **both** `https://icanova.pages.dev` and `https://icanova.pages.dev/` in Allowed Logout URLs if Auth0 treats them as distinct.

---

## Manual operator steps (Auth0 Dashboard)

1. Sign in to the **existing** tenant (`dev-notfczud6xx8hhxf.us.auth0.com`).  
2. **Applications → Create Application**  
   - Name: `iCaNova Production`  
   - Type: **Single Page Application**  
3. Open the new application → **Settings**:  
   - Application Type: SPA  
   - Token Endpoint Authentication Method: **None**  
   - Allowed Callback URLs: `https://icanova.pages.dev/auth/callback`  
   - Allowed Logout URLs: `https://icanova.pages.dev`, `https://icanova.pages.dev/`  
   - Allowed Web Origins: `https://icanova.pages.dev`  
   - Save  
4. Confirm **Authorization Code Flow with PKCE** (SPA default). Do not enable a confidential client secret for this SPA.  
5. **APIs** → open the existing API with identifier **`icanova`**.  
   - Do **not** create another API.  
   - Authorize / enable the new SPA to request this API (Machine-to-Machine not required for SPA).  
6. Copy the new application's **Client ID** only (public). Store it in the operator vault inventory.  
7. **Do not** modify the staging SPA's Client ID, callbacks, or secrets.  
8. Record non-secret inventory:

| Field | Expected / source |
|---|---|
| Tenant domain | `dev-notfczud6xx8hhxf.us.auth0.com` |
| Issuer | `https://dev-notfczud6xx8hhxf.us.auth0.com/` (confirm JWT `iss` match) |
| JWKS | `https://dev-notfczud6xx8hhxf.us.auth0.com/.well-known/jwks.json` |
| Audience | `icanova` |
| Production SPA Client ID | **\<NEW — operator fills after create\>** |
| Staging SPA Client ID | Unchanged (do not document secret values in git) |

---

## What this phase does **not** do

- Does not invent or paste a production Client ID into repo docs as if verified.  
- Does not set Cloudflare Pages build vars to the new Client ID until the operator supplies it.  
- Does not set Convex `AUTH_*` / `INGEST_SECRET` on `tremendous-sturgeon-449`.  
- Does not deploy Convex functions to production.  
- Does not retarget `VITE_CONVEX_URL` from roadrunner to sturgeon.

---

## Security verification checklist (after SPA exists)

| # | Check | How |
|---|---|---|
| 1 | Tenant domain | Dashboard URL = `dev-notfczud6xx8hhxf.us.auth0.com` |
| 2 | Issuer | OIDC discovery `issuer` matches `https://dev-notfczud6xx8hhxf.us.auth0.com/` |
| 3 | Production SPA Client ID | Matches new app; ≠ staging SPA |
| 4 | API audience | API identifier `icanova`; authorize SPA → API |
| 5 | PKCE | Auth request uses `code_challenge` / S256 (SPA code path in `beginLogin`) |
| 6 | Callback | Exact `https://icanova.pages.dev/auth/callback` |
| 7 | Logout URL | `https://icanova.pages.dev` (+ `/` if needed) |
| 8 | Web origin | `https://icanova.pages.dev` |
| 9 | JWKS discovery | `GET …/.well-known/jwks.json` returns keys |
| 10 | Token signature | RS256 access token validates against JWKS |
| 11 | Issuer validation | JWT `iss` matches Convex `AUTH_JWT_ISSUER` when provisioned |
| 12 | Audience validation | Access token `aud` includes `icanova`; Convex `AUTH_JWT_AUDIENCE=icanova` |
| 13 | Expiration | `exp` enforced client-side (`selectConvexBearer`) + Convex |
| 14 | Access vs ID token | Convex bearer = **access token** only; ID token never substituted |

**Hard rules:** Production Convex must never accept an ID token as an API access token. Do **not** restore the legacy `dse-gateway` audience fallback.
