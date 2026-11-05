---
description: "Use when changing Convex Auth, tenant isolation, authorization, auth UI, fleet, or admin flows."
applyTo: "{convex/auth*.ts,convex/authz.ts,convex/permissions.ts,convex/identity*.ts,convex/organizations.ts,convex/sites.ts,convex/devices.ts,convex/generators.ts,convex/platformAdmin.ts,convex/ingest*.ts,convex/deviceIdentity.ts,src/auth/**,src/fleet/**,src/admin/**}"
---

# Multi-tenant security

- Active auth is Convex Auth Password. Auth0 is future/inactive; do not re-enable it in login paths without an explicit architecture decision.
- Never trust frontend-supplied organization, site, gateway, or generator IDs as ownership proof.
- Validate permissions on the backend (`requirePermission` / authz) and enforce organization ownership on every protected resource.
- Make cross-organization access impossible and protect admin mutations.
- Handle session expiry/logout correctly; do not expose sensitive account data in errors.
- Fail closed when audience/provider configuration is missing; do not add legacy fallbacks.

When changing authorization, cover unauthenticated, unauthorized, cross-org, wrong-role, revoked-session, invalid-device-credential, and invalid/expired-token cases as applicable.
