# Phase 8 — Master status

**Date:** 2026-10-31  
**Overall programme status:** **NOT READY** (for production launch)  
**Closest accurate review label:** **READY FOR OPERATOR REVIEW** (8.5C BLOCKED on prod Auth0 + sturgeon env). **PRODUCTION DEPLOYMENT NOT AUTHORIZED.**

Git: `master` @ `c552261` (iCanOva branding). Working tree includes Phase 8 docs/scripts from this programme.

---

## Reconciliation inventory (repo-grounded)

| Item | Classification | Evidence | Remaining | Auto-safe? |
|---|---|---|---|---|
| Staging Convex `dapper-roadrunner-247` | VERIFIED | Deploy + Auth0 + E2E + device matrix | Keep isolated | Yes (read-only checks) |
| Staging Auth0 `aud=icanova` | VERIFIED | `/me`, Playwright | — | Yes |
| Phase 8.1 restore drill | VERIFIED | `vivid-mosquito-28`; RPO/RTO recorded | Keep quarantined | Yes (read-only) |
| Dev Convex kangaroo-10 | VERIFIED | Linked CLI default | Do not overwrite | Yes |
| Prod Convex sturgeon-449 | BLOCKED (8.5C) | Identity OK; **0 env**; `/me` 404 | AUTH_*/INGEST + function deploy auth | **No** |
| Prod Auth0 | NOT VERIFIED | Pages still uses staging Auth0 issuer | Dedicated tenant or written interim acceptance | No |
| Hosting | Cloudflare Pages live | `https://icanova.pages.dev`; OIDC set | Point `VITE_CONVEX_URL` at sturgeon after prod ready | No |
| Prod Convex secrets | BLOCKED | Empty — staging secrets not copied | After Auth0 verified + written auth | No |
| Dual-auth server | VERIFIED | Staging HTTP matrix | Fleet migration deferred | Yes (tests) |
| Fleet credential migration | PLAN ONLY | Plan docs | Authorize batches | No |
| Notify prod providers | OPERATOR CONFIGURATION REQUIRED | Controlled test procedure documented | Creds + auth to send | No |
| Audience fail-closed | VERIFIED (code) | No `dse-gateway` fallback | — | Yes |
| Env profile validator | VERIFIED (tooling) | 4 profiles | Empty prod must FAIL | Yes |
| Hardware ATP | BLOCKED | Physical | Equipment | No |
| Ops ACL | VERIFIED | Tests + staging | — | Yes |

---

## Workstream status

| Workstream | Status |
|---|---|
| 8.1 Staging activation | COMPLETED |
| 8.2A Security/architecture audit | COMPLETE + remediation pass (S8 closed; residual MEDIUM accepted) |
| 8.2B Production env blueprint | COMPLETE (docs + 4-profile validator) |
| 8.2C Deploy/rollback engineering | COMPLETE (runbook sequence) — **not executed** |
| 8.2D Backup/BCP | Staging restore VERIFIED; prod DR still operator |
| 8.2E Operations readiness | COMPLETE (ops runbook expanded) |
| 8.2F Automated acceptance | See latest test run in programme report |
| 8.3 Device migration prep | PLAN ONLY — not executed |
| 8.4 Hardware ATP prep | Plan COMPLETE — physical BLOCKED |
| 8.5 Launch readiness | **NOT READY** |
| 8.5A Auth0 + hosting readiness | **COMPLETE** (docs/templates) |
| 8.5B Host + Auth0 preflight | Pages live; OIDC set (staging Auth0) |
| 8.5C Production Convex provisioning | **BLOCKED** — see `docs/status/phase-8.5c-production-convex-provisioning.md` |

---

## Document index

| Doc |
|---|
| `docs/status/phase8-1-closure.md` |
| `docs/status/phase8-1-operator-checklist.md` |
| `docs/status/phase8-2-production-acceptance.md` |
| `docs/status/phase8-2-production-security-audit.md` |
| `docs/guide/production-environment-setup.md` |
| `docs/guide/production-deployment-runbook.md` |
| `docs/guide/device-credential-migration-plan.md` |
| `docs/guide/production-backup-recovery-plan.md` |
| `docs/guide/production-operations-runbook.md` |
| `docs/guide/hardware-acceptance-test-plan.md` |
| `docs/status/phase8-5-launch-readiness.md` |
| `docs/guide/production-auth0-and-hosting.md` |
| `docs/status/phase-8.5c-production-convex-provisioning.md` |
| `docs/guide/production-environment-inventory.md` |
| `docs/status/production-integration-verification.md` |
| `docs/status/production-launch-checklist.md` |
| This file |

## Tooling

| Script | Purpose |
|---|---|
| `scripts/validate-env-profile.mjs` | Non-destructive env checks (development/staging/recovery/production) |
| `scripts/restore-drill-check.mjs` | Restore boundary + path validation |
| `scripts/verify-auth0-staging.mjs` | Auth0 → Convex staging verify |
| `scripts/staging-device-cred-http.mjs` | Dual-auth HTTP matrix |

---

## Next single safest action

**Verify or create a dedicated production Auth0 tenant (or accept staging Auth0 as interim IdP in writing), then authorize AUTH_*/new INGEST_SECRET on `tremendous-sturgeon-449` and a separate production function deploy.** Do not copy staging secrets. Keep Pages on roadrunner until sturgeon is ready.

Canonical: `docs/status/phase-8.5c-production-convex-provisioning.md`  
**PRODUCTION DEPLOYMENT NOT AUTHORIZED.**
