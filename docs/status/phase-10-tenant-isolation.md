# Phase 10 — Workstream E: tenant isolation & telemetry integrity

**Date:** 2026-10-31  
**Status:** AUDITED — no new critical isolation defect found in sampled paths  
**Method:** Code review of `identity.ts` permission helpers + org-scoped mutations; existing convex-test suites  

---

## Authorization model

| Control | Location | Behavior |
|---|---|---|
| Identity required | `requireIdentity` / `ensureUser` | Unauthenticated → throw |
| Membership + permission | `requirePermission(ctx, organizationId, …)` | No membership / missing perm → Unauthorized |
| Device/site/generator ops | `devices.ts`, `sites.ts`, `generators.ts` | Take `organizationId` / parent ids and check org ownership server-side |

New accounts get **no** automatic org admin (Phase 8.5E–G E2E).

## Telemetry integrity rules (standing)

Documented and largely enforced in decode/UI paths:

- Missing ≠ zero  
- Gateway / Modbus / freshness / engine remain separate  
- Soft‑AP config is not cloud state  

No invented register/alarm names in Phase 10.

## Gaps / residual

| Item | Notes |
|---|---|
| Exhaustive query audit | Not every public query was line-audited this phase; pattern is consistent org-scoping |
| Public ingest | Authenticated by secret/device cred; returns no tenant listing |
| Shared `INGEST_SECRET` | Fleet-wide; impersonation mitigated by registered device identity check |

## Tests

Rely on existing fleet/notify/device convex tests + Auth E2E. Phase 10 did not remove coverage.
