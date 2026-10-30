# Identity provider setup (Phase 8.0B)

**Status:** Provider-neutral OIDC SPA foundations **IMPLEMENTED — NOT VERIFIED** against a real IdP.  
**Real login E2E:** **BLOCKED — OPERATOR ACTION REQUIRED** (supply issuer/client values).

Backend already accepts RS256 JWTs via Convex `customJwt` when `AUTH_JWT_ISSUER` + `AUTH_JWKS_URL` are set (`convex/auth.config.ts`). Authorization remains `requirePermission` in Convex — never UI-only.

---

## Operator-supplied values (placeholders only)

| Variable | Where | Example placeholder |
|---|---|---|
| `AUTH_JWT_ISSUER` | Convex env | `https://YOUR_TENANT.auth0.com/` |
| `AUTH_JWKS_URL` | Convex env | `https://YOUR_TENANT.auth0.com/.well-known/jwks.json` |
| `AUTH_JWT_AUDIENCE` | Convex env | `dse-gateway` |
| `VITE_OIDC_ISSUER` | Frontend build | same issuer https URL |
| `VITE_OIDC_CLIENT_ID` | Frontend build | public SPA client id |
| `VITE_OIDC_AUDIENCE` | Frontend build | must match JWT `aud` |
| `VITE_OIDC_REDIRECT_URI` | Frontend build | `https://app.example/auth/callback` |
| `VITE_OIDC_LOGOUT_REDIRECT_URI` | Frontend build | `https://app.example/` |
| `VITE_OIDC_AUTHORIZATION_ENDPOINT` | Optional | discovery default `{issuer}/authorize` |
| `VITE_OIDC_TOKEN_ENDPOINT` | Optional | discovery default `{issuer}/oauth/token` |
| `VITE_OIDC_END_SESSION_ENDPOINT` | Optional | IdP logout URL |

**Never** put client secrets in `VITE_*`. Prefer public SPA + PKCE.

---

## Browser flow

1. User opens `/auth/login` → PKCE + state + nonce stored → redirect to IdP.
2. IdP redirects to `/auth/callback?code=&state=`.
3. SPA exchanges code (public client), validates id_token iss/aud/exp/nonce.
4. Access token stored via `setBearerToken` → Convex `setAuth`.
5. Logout clears bearer (+ optional end-session redirect).

Signature verification for API access is performed by Convex JWKS — client claim checks are an additional guard only.

---

## Tests

- Mocked claim/PKCE tests: `src/auth/oidc.test.ts` — **not** real IdP proof.
- Real Auth0/Cognito/Entra login: **BLOCKED** until operator configures staging/production IdP.
