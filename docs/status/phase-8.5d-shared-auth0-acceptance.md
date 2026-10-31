# Phase 8.5D — Shared Auth0 tenant acceptance (production)

**Date:** 2026-10-31  
**Decision authority:** Operator (explicit written acceptance in programme prompt)  
**Status:** **SUPERSEDED** (2026-10-31) — active authentication is Convex Auth Password (Phases 8.5E–G). This document remains historical evidence of the interim Auth0 shared-tenant decision only.  
**Does not authorize:** production Convex secret provisioning, function deploy, or Pages retarget to sturgeon

---

## Explicit operator acceptance (recorded)

The operator has **explicitly accepted** temporarily using the **existing staging Auth0 tenant** for production authentication.

| Rule | Commitment |
|---|---|
| Separate Auth0 **tenant** | **Not** created in this phase |
| Separate Auth0 **SPA application** | **Required** — production must use its own Client ID |
| Staging SPA | **Must remain unchanged** |
| API audience | **`icanova`** — shared (do not duplicate the API) |
| Exception type | **Temporary** — dedicated production Auth0 tenant remains a future migration |
| Authorization after login | Enforced by **Convex membership + RBAC**, not Auth0 alone |
| Org access | Auth0 authentication **does not** grant organization access |

---

## Why this is an exception (not the preferred end state)

Preferred production design remains a dedicated Auth0 tenant. Sharing the staging tenant is accepted only to unblock SPA isolation and Auth0 URL correctness while Convex production (`tremendous-sturgeon-449`) is still empty and **PRODUCTION DEPLOYMENT NOT AUTHORIZED**.

---

## Risks (shared tenant)

| Risk | Impact |
|---|---|
| Shared identity database | Staging and production users/identities live in one IdP store |
| Shared SSO sessions | Browser SSO cookies may cross environment UX expectations |
| Shared tenant-level security config | MFA, attack protection, logging, branding apply to both |
| Shared API audience (`icanova`) | Access tokens for the same API can be presented to whichever Convex deployment trusts that issuer+audience |
| Shared availability / rate limits | Auth0 tenant outage or throttle hits staging and production UX together |
| Larger compromise blast radius | Tenant admin compromise or misconfiguration affects both environments |
| Staging/production identity confusion | Same `sub` may appear in both Convex deployments if both trust the same issuer |

---

## Mitigations (in force or required before cutover)

| Mitigation | Status / owner |
|---|---|
| Separate production SPA Client ID + distinct Allowed Callback / Logout / Web Origins | **Operator** — create `iCanOva Production` SPA (see `docs/guide/production-auth0-spa-setup.md`) |
| Staging SPA URLs and Client ID left unchanged | **Operator** — do not edit staging app for prod URLs |
| Convex membership + RBAC gate org data | **Code** — `convex/authz.ts` / permissions; Auth0 login alone is insufficient |
| Access token only for Convex (`aud=icanova`); never ID token | **Code** — `selectConvexBearer`; `auth.config.ts` customJwt |
| Fail-closed audience (no `dse-gateway` fallback) | **Code** — verified |
| Production Convex `AUTH_*` / `INGEST_SECRET` empty until authorized | **Ops** — sturgeon still 0 env vars (8.5C evidence) |
| Pages remains on roadrunner until sturgeon ready + written deploy auth | **Ops** — live bundle still staging Convex |
| Do not copy staging Convex secrets to production | **Hard rule** |
| Future dedicated production Auth0 tenant migration | **Backlog** — track as residual acceptance debt |

---

## Migration considerations (future)

1. Provision a dedicated production Auth0 tenant.  
2. Create production SPA + API (`icanova` or approved identifier).  
3. Dual-run or cut over Pages `VITE_OIDC_*` and Convex `AUTH_JWT_*` issuer/JWKS together.  
4. Re-verify login → `users.ensure` → org membership on sturgeon.  
5. Retire production use of the staging tenant; keep staging SPA on staging tenant.  
6. Update security audit disposition from temporary exception to closed.

---

## Related documents

- SPA create checklist: `docs/guide/production-auth0-spa-setup.md`
- Hosting / Auth0 guide: `docs/guide/production-auth0-and-hosting.md`
- Security audit: `docs/status/production-security-audit.md` (S9 updated)
- Launch checklist: `docs/status/production-launch-checklist.md`
- Prior gate: `docs/status/phase-8.5c-production-convex-provisioning.md`
