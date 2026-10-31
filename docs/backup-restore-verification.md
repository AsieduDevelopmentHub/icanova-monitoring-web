# Backup and restore verification (Phase 8.0D / 8.1)

**Date:** 2026-10-31  
**Artifact path/manifest helpers:** COMPLETE (unit tested)  
**Dashboard backup taken:** **OPERATOR ACTION REQUIRED**  
**Isolated restore drill:** **BLOCKED — OPERATOR ACTION REQUIRED**  
**Phase 8.1 outcome:** No isolated restore was performed. Staging Convex (`dapper-roadrunner-247`) **is** provisioned and may be the **backup source**. Development (`effervescent-kangaroo-10`) and production (`tremendous-sturgeon-449`) must **not** be used as restore targets.

Path/manifest validation is **not** equivalent to a complete database backup or a successful restore. Do not mark this gate VERIFIED.

---

## 1. What code proves today

| Check | Location | Proves |
|---|---|---|
| Required table document paths | `src/ops/backupArtifact.ts` | ZIP listing includes expected tables |
| Manifest counts / timestamps | same | Operator-supplied metadata consistency |
| Restore target guard | `restoreTargetAllowed` | Blocks production without explicit approval |
| `RESTORE_TEST_STATUS` | constant | Always **NOT TESTED — OPERATOR ACTION REQUIRED** until drill |

---

## 2. Exact operator runbook — backup (staging preferred)

1. Open Convex dashboard → team `asiedudevelopmenthub` → project `dse` → deployment **`dapper-roadrunner-247`** (staging).
2. Use product **Backup** / **Backup Now** (label may vary by Convex UI version). Prefer staging over development.
3. Record: deployment name, UTC timestamp, operator identity, include-storage yes/no.
4. Download ZIP to encrypted offline storage (not the git repo).
5. List ZIP paths offline; run `validateBackupPaths` / `validateBackupManifest` helpers (`src/ops/backupArtifact.ts`).
6. Confirm secrets are **not** inside the ZIP (Convex env vars live outside document exports).

Identifying the backup: file name + UTC + deployment + checksum recorded in the operator’s secure notes (not committed).

---

## 3. Exact operator runbook — isolated restore (mandatory for VERIFIED)

**Authorization required before any restore.**  
**Never restore over `effervescent-kangaroo-10`, active staging if still needed, or `tremendous-sturgeon-449`.**

1. Create a **new empty** Convex deployment (recovery). Example name pattern: `dse-recovery-YYYYMMDD`. Type: separate deployment URL.
2. Confirm recovery URL ≠ kangaroo ≠ `dapper-roadrunner-247` ≠ `tremendous-sturgeon-449`.
3. In Convex UI, restore the staging ZIP **into the recovery deployment only**.
4. Deploy the same function/schema revision to recovery if required by the product restore flow (`convex deploy` with a recovery-specific env file / deploy key — **not** `.env.staging.local` unless intentionally retargeted).
5. Verify restored application data:
   - organizations, memberships, sites, devices, generators
   - telemetry current / buckets sample
   - alarms, audits, notify policies
   - ingest cursors, device lifecycle/health, job state
6. With a lab or IdP token pointed at **recovery** cloud URL: run authenticated queries; confirm tenant isolation.
7. Record RPO (data loss window) and RTO (time to recovery) below.
8. Decommission recovery when done, or keep quarantined — do not promote to production without a separate approval.

| Metric | Measured value |
|---|---|
| RPO | _operator fills after drill_ |
| RTO | _operator fills after drill_ |
| Drill date | _pending_ |
| Backup source deployment | `dapper-roadrunner-247` (recommended) |
| Recovery deployment | _pending — empty deploy only_ |

If the Convex plan cannot perform the required restore: document the plan limitation and keep status **BLOCKED — OPERATOR ACTION REQUIRED**.

---

## 4. Related docs

- `docs/backup-and-disaster-recovery.md`
- `docs/phase8-1-operator-checklist.md` §F
- Convex Backup & Restore product documentation
