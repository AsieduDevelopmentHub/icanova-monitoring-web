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
| 8.5D Shared Auth0 tenant + separate prod SPA | **SUPERSEDED for login** by 8.5E (Auth0 retained inactive); SPA checklist still valid for future IdP |
| 8.5E Convex Auth primary | **CODE COMPLETE** — `docs/status/phase-8.5e-convex-auth-transition.md` |
| 8.5F Staging Convex Auth activation | **VERIFIED** (roadrunner + live E2E) — `docs/status/phase-8.5f-staging-convex-auth-activation.md` |
| 8.5G Pages Convex Auth cutover | **BLOCKED** — Cloudflare API token missing — `docs/status/phase-8.5g-pages-convex-auth-cutover.md` |

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
| `docs/status/phase-8.5d-shared-auth0-acceptance.md` |
| `docs/guide/production-auth0-spa-setup.md` |
| `docs/status/phase-8.5d-production-frontend-auth-plan.md` |
| `docs/status/phase-8.5e-convex-auth-transition.md` |
| `docs/status/phase-8.5f-staging-convex-auth-activation.md` |
| `docs/status/phase-8.5g-pages-convex-auth-cutover.md` |
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

**Create a Cloudflare API token (Account → Cloudflare Pages → Edit), set `CLOUDFLARE_API_TOKEN` in the local shell, then `npx wrangler pages deploy dist --project-name icanova` and smoke Password login on `https://icanova.pages.dev`.** Verified Auth0-free `dist/` is ready. Do **not** touch sturgeon.

Canonical: `docs/status/phase-8.5g-pages-convex-auth-cutover.md`  
**PRODUCTION DEPLOYMENT NOT AUTHORIZED.**
