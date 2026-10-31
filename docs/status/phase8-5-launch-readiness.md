# Phase 8.5 — Controlled production launch readiness

**Date:** 2026-10-31  
**Overall status:** **NOT READY**  
**Closest software label:** **READY FOR OPERATOR REVIEW**  
**8.5C:** Production Convex provisioning **BLOCKED** — Pages still on staging Auth0/Convex; sturgeon empty.  
**Must remain:** `PRODUCTION DEPLOYMENT NOT AUTHORIZED` until written approval.

Mandatory gates must each be independently green. Staging success ≠ production readiness.

| Gate | Status | Evidence / doc |
|---|---|---|
| **1 — Recovery / restore drill** | **VERIFIED** | `docs/guide/backup-restore-verification.md` §6 — `vivid-mosquito-28` quarantined |
| **2 — Security** | **READY FOR OPERATOR REVIEW** | `docs/status/production-security-audit.md` |
| **3 — Production Auth0** | **NOT VERIFIED** | Pages still uses staging Auth0 issuer — `docs/status/phase-8.5c-production-convex-provisioning.md` |
| **4 — Production Convex secrets** | **BLOCKED** | Sturgeon empty; staging secrets not copied (8.5C) |
| **5 — SPA hosting** | **VERIFIED (Pages)** | `https://icanova.pages.dev`; still pointed at **staging** Convex |
| **6 — Notifications** | **OPERATOR CONFIGURATION REQUIRED** | Controlled test in `docs/guide/production-environment-setup.md` §9 |
| **7 — Device credentials** | **PLAN ONLY** | `docs/guide/device-credential-migration-plan.md` |
| **8 — Hardware** | **BLOCKED — PHYSICAL HARDWARE REQUIRED** | `docs/guide/hardware-acceptance-test-plan.md` |
| **9 — Deployment authorization** | **REQUIRED** | No production deploy without written approval |
| Production admin accounts | **OPEN** | Operator |
| Prod-sourced DR | **OPEN** | Staging drill ≠ prod DR |
| Rollback plan | **READY FOR OPERATOR REVIEW** | `docs/guide/production-deployment-runbook.md` §3 |
| Ops monitoring | **READY FOR OPERATOR REVIEW** | `docs/guide/production-operations-runbook.md` |

## Phase 8.5A / 8.5B deliverables (software)

| Deliverable | Location |
|---|---|
| Production Auth0 design + operator checklist | `docs/guide/production-auth0-and-hosting.md` |
| Hosting comparison + recommendation | same |
| Cloudflare Pages exact prep (no deploy) | same §4b — `dist/_redirects` verified |
| Domain placeholders (no DNS) | same §5 — domain still unknown |
| `.env.production.example` | repo root |
| SPA `_redirects` | `public/_redirects` |
| Frontend secret scan | `scripts/check-frontend-secrets.mjs` |

## Allowed overall labels

| Label | When |
|---|---|
| NOT READY | Any mandatory gate open (**current**) |
| READY FOR OPERATOR REVIEW | Software/docs complete; humans must decide |
| READY FOR PRODUCTION CONFIGURATION | Host + Auth0 provisioned; Convex secrets still not set |
| READY FOR PRODUCTION AUTHORIZATION | All mandatory gates green except final signature |
| PRODUCTION DEPLOYED — VERIFICATION IN PROGRESS | Deploy happened; smoke in progress |
| PRODUCTION ACCEPTED | Post-deploy verification complete |

**Do not** mark PRODUCTION DEPLOYED / ACCEPTED without real deploy evidence.  
**Do not** populate production Convex secrets until Auth0 + hosting are established.
