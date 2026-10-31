# Phase 8.5 — Controlled production launch readiness

**Date:** 2026-10-31  
**Overall status:** **NOT READY**

Mandatory gates must each be independently green. Staging success ≠ production readiness.

| Gate | Status | Evidence / doc |
|---|---|---|
| Phase 8.1 restore drill accepted | **OPEN** | `docs/backup-restore-verification.md` — BLOCKED |
| Phase 8.2 security audit accepted | **READY FOR OPERATOR REVIEW** | `docs/phase8-2-production-security-audit.md` |
| Production Auth0 provisioned | **OPEN** | Operator |
| Production Convex env verified | **OPEN** | `tremendous-sturgeon-449` env empty |
| Hosting provider selected & verified | **OPEN** | Operator decision |
| Production env vars configured | **OPEN** | |
| Production domain + TLS verified | **OPEN** | |
| Production notification providers configured | **OPEN** | |
| Production notification authorization approved | **OPEN** | |
| Backup and recovery verified | **OPEN** | Depends on restore drill |
| Operational monitoring accepted | **READY FOR OPERATOR REVIEW** | `docs/production-operations-runbook.md` |
| Production admin/operator accounts reviewed | **OPEN** | |
| Device credential migration plan approved | **READY FOR OPERATOR REVIEW** | `docs/device-credential-migration-plan.md` |
| Hardware acceptance plan reviewed | **READY FOR OPERATOR REVIEW** | Plan only; physical BLOCKED |
| Rollback plan reviewed | **READY FOR OPERATOR REVIEW** | `docs/production-deployment-runbook.md` |
| Production deployment authorization recorded | **OPEN** | Written approval |

## Allowed overall labels

| Label | When |
|---|---|
| NOT READY | Any mandatory gate open (current) |
| READY FOR OPERATOR REVIEW | Software/docs complete; humans must decide |
| READY FOR PRODUCTION AUTHORIZATION | All mandatory gates green except final signature |
| PRODUCTION DEPLOYED — VERIFICATION IN PROGRESS | Deploy happened; smoke in progress |
| PRODUCTION ACCEPTED | Post-deploy verification complete |

**Do not** mark PRODUCTION DEPLOYED / ACCEPTED without real deploy evidence.
