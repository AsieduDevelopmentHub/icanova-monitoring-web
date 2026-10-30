# Production authentication setup (Phase 7B)

This guide documents how operators configure real JWT validation for the DSE gateway web app.  
**Do not invent issuer, JWKS, audience, or signing keys.** The agent and CI never generate production credentials.

## What the app expects

Convex custom JWT auth (`convex/auth.config.ts`) enables only when both are set to real **https** URLs:

| Convex env | Meaning |
|---|---|
| `AUTH_JWT_ISSUER` | Exact JWT `iss` claim from your identity provider |
| `AUTH_JWKS_URL` | HTTPS JWKS document that validates RS256 tokens |
| `AUTH_JWT_AUDIENCE` | Expected `aud` (default `dse-gateway` if omitted in code; **set explicitly in production**) |

Optional (only if this deployment **hosts** JWKS itself):

| Convex env | Meaning |
|---|---|
| `AUTH_JWT_JWKS` | Public JWK set JSON served at `GET /.well-known/jwks.json` |

The private signing key must **never** be stored in this repo, in `VITE_*` variables, or in Convex env as a signing secret for the browser.

## How to obtain issuer / JWKS / audience

### Auth0

1. Create an API (or SPA + API) in the Auth0 tenant.
2. **Issuer:** Authentication → Domain → `https://<tenant>.<region>.auth0.com/` (trailing slash must match tokens).
3. **JWKS:** `https://<tenant>.<region>.auth0.com/.well-known/jwks.json`
4. **Audience:** the API Identifier you configured (set the same string as `AUTH_JWT_AUDIENCE`).

### Amazon Cognito

1. Create a user pool and an app client.
2. **Issuer:** `https://cognito-idp.<region>.amazonaws.com/<userPoolId>`
3. **JWKS:** `https://cognito-idp.<region>.amazonaws.com/<userPoolId>/.well-known/jwks.json`
4. **Audience:** app client id (or resource server identifier), matching token `aud`.

### Azure AD / Entra ID

1. Register an application and expose an API / use a SPA.
2. **Issuer:** usually `https://login.microsoftonline.com/<tenantId>/v2.0`
3. **JWKS:** `https://login.microsoftonline.com/<tenantId>/discovery/v2.0/keys`
4. **Audience:** application (client) ID or API URI, matching token `aud`.

### Self-hosted JWKS on Convex (lab only)

1. Generate an RS256 key pair **offline**.
2. Put **public** JWKS JSON in `AUTH_JWT_JWKS`.
3. Set `AUTH_JWT_ISSUER` to `https://<deployment>.convex.site` (or the issuer you embed in tokens).
4. Set `AUTH_JWKS_URL` to `https://<deployment>.convex.site/.well-known/jwks.json`.
5. Keep the private key in your token minting service only.

## Validation rules enforced in code

`convex/productionConfig.ts`:

- Rejects empty / `disabled`
- Requires `https:` URLs
- Rejects placeholder hosts (`example.com`, `localhost`, `issuer.example`, `changeme`, …)
- Requires a non-empty audience for `productionReady()`
- Requires `INGEST_SECRET` length ≥ 32 for production ingest readiness

`auth.config.ts` only registers a provider when `authProviderReady(issuer, jwks)` is true.

## Operator checklist (outstanding until you complete it)

1. [ ] Create or select a production IdP application.
2. [ ] Copy the real issuer URL into Convex production env: `AUTH_JWT_ISSUER`.
3. [ ] Copy the real JWKS URL: `AUTH_JWKS_URL`.
4. [ ] Set `AUTH_JWT_AUDIENCE` to match issued tokens.
5. [ ] Confirm `GET $AUTH_JWKS_URL` returns a key set.
6. [ ] Confirm `GET https://<prod>.convex.site/me` with a valid bearer succeeds.
7. [ ] Confirm missing / expired / wrong-aud tokens return 401.
8. [ ] Keep development (`effervescent-kangaroo-10`) credentials separate from production.

## Frontend session

The React app stores a bearer via `setBearerToken` and calls Convex with that JWT.  
It never receives `INGEST_SECRET`, Resend, or Arkesel keys. Only `VITE_*` public values belong in the browser build.

## What remains unresolved without operator action

- Real production issuer / JWKS / audience values
- Production backup / RPO verification in the Convex dashboard
- Production deploy itself (explicitly out of scope for Phase 7.2)
