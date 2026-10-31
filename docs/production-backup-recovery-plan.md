# Production backup & recovery plan (Phase 8.2A)

**Date:** 2026-10-31  
**Status:** OPERATOR PROCESS REQUIRED  
**Phase 8.1 restore drill:** **VERIFIED** on empty recovery `vivid-mosquito-28` (staging snapshot). Do **not** claim production DR verified until a prod-sourced drill (or written residual-risk acceptance).

Platform facts (Convex docs) and product recommendations: also see `docs/backup-and-disaster-recovery.md` and `docs/backup-restore-verification.md`.

---

## 1. What Convex provides vs what operators must own

| Capability | Owner |
|---|---|
| Manual / periodic deployment backups | Convex (Pro for schedule) |
| ZIP export / import | Convex + operator |
| Function/schema source | Git |
| Env vars / secrets | Operator vault (not in ZIP) |
| Collector/firmware secrets | Operator / device NVS |
| Auth0 tenant config | Auth0 + operator |
| Static SPA hosting config | Operator |
| Proven restore RTO/RPO | **Staging drill measured** (see `backup-restore-verification.md`); prod drill still open |

---

## 2. Production requirements (targets — not measured)

| Requirement | Target | Classification |
|---|---|---|
| Backup frequency | Daily automatic (Pro) + manual before releases | OPERATOR CONFIGURATION REQUIRED |
| On-platform retention | Per Convex plan (e.g. 7–14 days) | NOT VERIFIED for this project’s plan tier |
| Off-platform retention | Encrypted copy for ≥30 days if business requires | OPERATOR CONFIGURATION REQUIRED |
| Recovery target | **Empty** recovery deployment — never restore over live prod first | READY FOR PRODUCTION (procedure) |
| RPO | ≤ 24 h config; tighter telemetry only with higher cadence | Staging drill met ≤24 h; prod NOT VERIFIED |
| RTO | ≤ 4–8 h including verify | Staging drill ≪ 4 h; prod NOT VERIFIED |
| Backup verification | Path/manifest helpers (`backupArtifact.ts`) on every retained ZIP | READY FOR PRODUCTION (tooling) |
| Secret reconstruction checklist | Auth0, `INGEST_SECRET`, Resend/Arkesel, SPA host env | READY FOR PRODUCTION (docs) |

---

## 3. Production backup procedure

1. Convex dashboard → **production** deployment → Backups → Backup Now / confirm schedule.  
2. Record: deployment name, UTC, operator, include-storage, ticket id.  
3. Download ZIP to encrypted storage (not the git repo).  
4. Run offline path/manifest validation.  
5. Confirm env/secrets backed up **separately** in the vault.  

---

## 4. Isolated restoration (mandatory before trusting prod DR)

1. Create empty recovery Convex deployment.  
2. Restore ZIP **only** into recovery.  
3. Deploy matching function revision to recovery.  
4. Reconstruct env from vault (not from ZIP).  
5. Verify orgs, memberships, sites, devices, telemetry sample, alarms, notify policies, cursors.  
6. Auth smoke with recovery-pointed SPA or scripted `/me`.  
7. Record actual RPO/RTO.  
8. Decommission or quarantine recovery.  

**Never** restore over `effervescent-kangaroo-10`, `dapper-roadrunner-247` (if still needed), or live production without a written break-glass plan.

---

## 5. Dependency on Phase 8.1

Staging isolated restore drill **succeeded** (2026-10-31). Remaining:

- Production DR readiness still needs a **prod-sourced** backup/restore drill (or explicit residual-risk acceptance).  
- Quarantine recovery `vivid-mosquito-28` — no fleet/notify traffic.

---

## 6. Operational ownership

| Role | Responsibility |
|---|---|
| Deployment operator | Backups, restore drills, env vault |
| Security owner | Secret rotation after restore/incident |
| On-call | Execute runbook; escalate Auth0/Convex access issues |
