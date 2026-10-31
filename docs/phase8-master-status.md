# Phase 8 — Master status

**Date:** 2026-10-31  
**Overall programme status:** **NOT READY** (for production launch)  
**Closest accurate review label:** **READY FOR OPERATOR REVIEW** on software/docs; launch remains **NOT READY** until restore + prod env + Auth0 + hosting + authorization.

Git: `master` @ `c552261` (iCanOva branding). Working tree may include uncommitted Phase 8 docs/scripts from this programme.

---

## Reconciliation inventory (repo-grounded)

| Item | Classification | Evidence | Remaining | Auto-safe? |
|---|---|---|---|---|
| Staging Convex `dapper-roadrunner-247` | VERIFIED | Deploy + Auth0 + E2E + device matrix | Keep isolated | Yes (read-only checks) |
| Staging Auth0 `aud=icanova` | VERIFIED | `/me`, Playwright 13/13 | — | Yes |
| Phase 8.1 restore drill | BLOCKED | No recovery restore evidence | Operator auth + empty recovery | **No** |
| Dev Convex kangaroo-10 | VERIFIED | Linked CLI default | Do not overwrite | Yes |
| Prod Convex sturgeon-449 | READY FOR OPERATOR ACTION | Exists; **0 env vars** | Configure + approve | **No** (config is operator) |
| Prod Auth0 | READY FOR OPERATOR ACTION | Not provisioned in-repo | Create tenant/app | No |
| Hosting | READY FOR OPERATOR ACTION | No Vercel/CI | Choose host | No |
| Dual-auth server | VERIFIED | Staging HTTP matrix | Fleet migration deferred | Yes (tests) |
| Fleet credential migration | IMPLEMENTATION REQUIRED (ops) | Plan only | Authorize batches | No |
| Notify prod providers | READY FOR OPERATOR ACTION | Code ready | Creds + auth to send | No |
| CI workflows | NOT APPLICABLE / IMPLEMENTATION REQUIRED | None present | Optional | Yes (add later) |
| Hardware ATP | BLOCKED | No DSE on bench | Physical equipment | No |
| Ops ACL | VERIFIED | convex-test + staging surface | — | Yes |
| Docs consistency | IMPLEMENTED BUT NOT VERIFIED continuously | This master + 8.2A set | Keep aligned | Yes |

---

## Workstream status

| Workstream | Status |
|---|---|
| 8.1 Staging activation | PARTIALLY COMPLETED — OPERATOR ACTION REQUIRED (restore) |
| 8.2A Security/architecture audit | COMPLETE (audit) |
| 8.2B Production env blueprint | COMPLETE (docs + validate script) |
| 8.2C Deploy/rollback engineering | COMPLETE (runbook + validate script) — not executed |
| 8.2D Backup/BCP | DOCUMENTED — restore drill BLOCKED |
| 8.2E Operations readiness | COMPLETE (ops runbook) |
| 8.2F Automated acceptance | VERIFIED this run: `pnpm test` 155; `pnpm build`; `E2E_OIDC=1` Playwright **13 passed** |
| 8.3 Device migration prep | COMPLETE (plan) — not executed |
| 8.4 Hardware ATP prep | COMPLETE (plan) — physical BLOCKED |
| 8.5 Launch readiness | NOT READY |

---

## Document index

| Doc |
|---|
| `docs/phase8-1-closure.md` |
| `docs/phase8-1-operator-checklist.md` |
| `docs/phase8-2-production-acceptance.md` |
| `docs/phase8-2-production-security-audit.md` |
| `docs/production-environment-setup.md` |
| `docs/production-deployment-runbook.md` |
| `docs/device-credential-migration-plan.md` |
| `docs/production-backup-recovery-plan.md` |
| `docs/production-operations-runbook.md` |
| `docs/hardware-acceptance-test-plan.md` |
| `docs/phase8-5-launch-readiness.md` |
| This file |

## Tooling added this programme

| Script | Purpose |
|---|---|
| `scripts/validate-env-profile.mjs` | Non-destructive env name/URL checks |
| `scripts/restore-drill-check.mjs` | Restore boundary + optional path validation |
| `scripts/verify-auth0-staging.mjs` | Auth0 → Convex staging verify |
| `scripts/staging-device-cred-http.mjs` | Dual-auth HTTP matrix |

---

## Next single safest action

**Authorize and perform the empty recovery restore drill** from a staging backup (never over kangaroo/roadrunner/sturgeon), then record RPO/RTO — closes Phase 8.1’s last software gate before any production configuration push.
