# Identity provider setup (Phase 8.0B / 8.1B)

**Status:** Provider-neutral OIDC SPA foundations **IMPLEMENTED**.  
**Staging Convex Auth0 wiring:** **VERIFIED** (issuer/JWKS/audience `icanova` on `dapper-roadrunner-247`).  
**Real browser login E2E:** Callback URLs **fixed**. Next blocker: Auth0 SPA client must be **authorized for API `icanova`** (`Client is not authorized to access resource server "icanova"`).

Backend accepts RS256 JWTs via Convex `customJwt` when `AUTH_JWT_ISSUER` + `AUTH_JWKS_URL` are set (`convex/auth.config.ts`). Authorization remains `requirePermission` in Convex — never UI-only.

---

## Critical: OIDC token vs Convex JWT

**Do not assume every OIDC access token is valid for Convex.**

| Token | Typical `aud` | Use for Convex? |
|---|---|---|
| `id_token` | SPA client id | **No** (wrong audience for API) |
| API `access_token` | API identifier (e.g. `dse-gateway`) | **Yes**, when iss/aud/JWKS match Convex env |

Required architecture (no insecure token-exchange in this product yet):

1. Configure the IdP to issue an **API / application JWT** whose `iss`, `aud`, and JWKS match Convex `AUTH_JWT_*`.
2. Auth0 pattern: create an API with identifier `dse-gateway`; SPA requests that audience; Convex `AUTH_JWT_AUDIENCE=dse-gateway`.
3. SPA stores **that access token** as the Convex bearer after client-side iss/aud/exp checks (`selectConvexBearer` in `src/auth/oidc.ts`).
4. Convex verifies signature via JWKS.

Alternatives (token-exchange service or custom minting backend) are **not implemented**. Do not add a hardcoded signing secret in the SPA.

Refresh tokens / silent renew: **DEFERRED** (public SPA without client secret).

---

## Exact mapping (staging readiness)

| Concept | Config / claim | Staging lab (current) | Real IdP (required for browser E2E) |
|---|---|---|---|
| OIDC issuer | `VITE_OIDC_ISSUER` | unset | `https://YOUR_TENANT.auth0.com` (example) |
| OIDC client ID | `VITE_OIDC_CLIENT_ID` | unset | Public SPA client id |
| OIDC API audience | `VITE_OIDC_AUDIENCE` | would be `dse-gateway` | Must equal Convex audience |
| Access token | OIDC `access_token` | N/A (lab mints JWT directly) | RS256 JWT with `aud=dse-gateway` |
| Application JWT | Same as access token when configured correctly | Lab-minted RS256 JWT | IdP API access token |
| Convex issuer | `AUTH_JWT_ISSUER` + JWT `iss` | `https://dapper-roadrunner-247.convex.site` | Must equal IdP issuer URL |
| Convex audience | `AUTH_JWT_AUDIENCE` + JWT `aud` | `dse-gateway` | `dse-gateway` |
| JWKS endpoint | `AUTH_JWKS_URL` | `{site}/.well-known/jwks.json` | IdP JWKS URL |
| Public JWKS body | `AUTH_JWT_JWKS` (self-host only) | Set (`kid=dse-staging-1`) | Usually empty (IdP hosts JWKS) |

**Does the current SPA obtain a Convex-validatable token?**

- **With lab mint + bearer injection:** Yes — proven by staging `GET /me` → 200.
- **With OIDC PKCE as coded today:** Only if the IdP returns an **API access token** whose `iss`/`aud`/signature match Convex `AUTH_*`. Browser claim checks (`selectConvexBearer`) are a client guard only; Convex `customJwt` is authoritative. An `id_token` alone will **not** authenticate to Convex.

---

## Operator-supplied values (placeholders only)

| Variable | Where | Example placeholder |
|---|---|---|
| `AUTH_JWT_ISSUER` | Convex env | `https://YOUR_TENANT.auth0.com/` |
| `AUTH_JWKS_URL` | Convex env | `https://YOUR_TENANT.auth0.com/.well-known/jwks.json` |
| `AUTH_JWT_AUDIENCE` | Convex env | `dse-gateway` |
| `VITE_OIDC_ISSUER` | Frontend build | same issuer https URL |
| `VITE_OIDC_CLIENT_ID` | Frontend build | public SPA client id |
| `VITE_OIDC_AUDIENCE` | Frontend build | **must match** `AUTH_JWT_AUDIENCE` |
| `VITE_OIDC_REDIRECT_URI` | Frontend build | `https://app.example/auth/callback` or `http://127.0.0.1:5173/auth/callback` |
| `VITE_OIDC_LOGOUT_REDIRECT_URI` | Frontend build | `https://app.example/` |
| `VITE_OIDC_*_ENDPOINT` | Optional | authorize / token / end-session overrides |

**Never** put client secrets in `VITE_*`.

---

## Browser flow

1. `/auth/login` → PKCE + state + nonce → IdP.
2. `/auth/callback` → code exchange.
3. Validate `id_token` (iss, aud=client id, nonce, exp).
4. Validate `access_token` (iss, aud=application audience, exp).
5. Store access token via `setBearerToken` → Convex `setAuth`.
6. Logout clears bearer (+ optional end-session).

---

## Staging verification procedure (real IdP)

Do **not** mark VERIFIED until each step succeeds on staging infrastructure.

1. Complete real OIDC login (`/auth/login` → IdP → `/auth/callback`).
2. Confirm stored bearer is the **access token** with `aud=dse-gateway` (not `id_token`).
3. `GET https://dapper-roadrunner-247.convex.site/me` with that bearer → 200 + expected `subject`.
4. Execute an authenticated Convex query (e.g. `organizations.mine`).
5. Verify authenticated subject matches IdP `sub`.
6. Verify organization membership for that subject.
7. Verify unauthorized access is denied (no bearer / wrong org).
8. Logout clears local bearer; subsequent Convex calls fail until login.

Lab substitute for steps 3–6 only:

```bash
python scripts/issue-operator-token.py --staging
# GET /me with .jwt/staging/session.token
node scripts/operator.mjs ensure --staging
```

---

## Tests

| Kind | Status |
|---|---|
| Mocked PKCE / claims / bearer selection | Local Vitest — **not** IdP proof |
| Staging lab JWT + Convex `/me` (self-hosted JWKS) | **VERIFIED** — `python scripts/issue-operator-token.py --staging` |
| Real staging IdP login (Auth0/etc.) + browser E2E | **BLOCKED** |
