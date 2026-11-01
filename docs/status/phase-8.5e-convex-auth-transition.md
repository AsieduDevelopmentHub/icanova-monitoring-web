# Phase 8.5E — Convex Auth primary; Auth0 retained inactive

**Date:** 2026-10-31  
**Status:** **IMPLEMENTED (code)** — staging operator key setup still required for live login  
**Production:** **UNCHANGED** — `PRODUCTION DEPLOYMENT NOT AUTHORIZED`

---

## Why Convex Auth is primary

iCaNova authentication is now owned by **Convex Auth (Password)** so the SPA does not depend on Auth0 for registration, login, logout, or session renewal. Convex continues to own organization membership, roles, and permissions. Successful authentication still does **not** grant organization access.

## Active architecture

```text
SPA (email+password) → Convex Auth → Convex JWT session → identity.ts → users → memberships/RBAC
```

| Concern | Owner |
|---|---|
| Register / login / logout / session | Convex Auth (`convex/auth.ts`, `ConvexAuthProvider`) |
| App user row + email-rebind | `convex/identity.ts` `ensureUser` / `createOrUpdateUser` |
| Org membership / RBAC | Unchanged (`requirePermission`, memberships, roles) |
| Device ingest auth | Unchanged (`INGEST_SECRET` / device credentials) |

## Auth0 retention (future enterprise IdP)

| Asset | Location | Default |
|---|---|---|
| OIDC PKCE helpers | `src/auth/integrations/auth0/oidc.ts` | Inactive — not required for startup |
| Auth0 callback UI | `src/auth/integrations/auth0/AuthCallback.tsx` | Stub / inactive path |
| customJwt example | `convex/integrations/auth0AuthConfig.example.ts` | Not imported |
| `VITE_OIDC_*` | Optional | Not required for login |

Do **not** dual-register Auth0 and Convex Auth in `auth.config.ts` (competing identities).

## User migration (non-destructive)

1. Existing `users` rows and memberships are **not** deleted.  
2. On Password sign-up/sign-in, `createOrUpdateUser` reuses a row with the same normalized email.  
3. `ensureUser` patches `tokenIdentifier` to the Convex Auth identity (email-rebind).  
4. Users **without email** cannot auto-rebind — operator recovery required.  
5. Auth0 `sessionStorage` bearers are obsolete against Convex Auth JWT verification.

## Environment variables

| Variable | Role | Notes |
|---|---|---|
| `VITE_CONVEX_URL` | SPA → Convex | Required |
| `JWT_PRIVATE_KEY` | Convex Auth signing | Dev/staging operator setup; **not** production in this phase |
| `JWKS` | Convex Auth public keys | Same |
| `INGEST_SECRET` | Device ingest | Unrelated to SPA login |
| `VITE_OIDC_*` / `AUTH_JWT_*` | Future Auth0 | Inactive |

Password reset / email verification: **follow-up** (Resend not wired into auth yet).

## Staging verification

| Check | Evidence |
|---|---|
| Unit / convex-test | `pnpm test` — identity email-rebind + Auth0 isolation |
| Production build | `pnpm build` |
| Live roadrunner Password login | **Operator** — set `JWT_PRIVATE_KEY` / `JWKS` on staging, deploy functions, rebuild SPA **without** requiring `VITE_OIDC_*` |
| Production sturgeon | **Not touched** |

## Known limitations / risks

- Open self-registration creates users with **no** org membership until admin grant (same as Auth0-era).  
- No password-reset email in this phase.  
- Live Pages (`icanova.pages.dev`) still embeds staging Auth0 until an authorized SPA rebuild.  
- Staging Auth0 SPA / tenant intentionally **not** deleted.  
- Email-less legacy users need manual operator linking.

## Production readiness

**NOT READY** / **PRODUCTION DEPLOYMENT NOT AUTHORIZED**.
