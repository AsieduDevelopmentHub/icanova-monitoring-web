# Backup and restore verification (Phase 8.0D)

**Date:** 2026-10-30  
**Artifact path/manifest helpers:** COMPLETE (unit tested)  
**Dashboard backup taken:** **OPERATOR ACTION REQUIRED**  
**Isolated restore drill:** **BLOCKED — OPERATOR ACTION REQUIRED**

Path/manifest validation is **not** equivalent to a complete database backup or a successful restore.

---

## 1. What code proves today

| Check | Location | Proves |
|---|---|---|
| Required table document paths | `src/ops/backupArtifact.ts` | ZIP listing includes expected tables |
| Manifest counts / timestamps | same | Operator-supplied metadata consistency |
| Restore target guard | `restoreTargetAllowed` | Blocks production without explicit approval |
| `RESTORE_TEST_STATUS` | constant | Always **NOT TESTED — OPERATOR ACTION REQUIRED** until drill |

---

## 2. Operator backup verification steps

1. Convex dashboard → staging or development deployment → **Backup Now** (prefer staging).
2. Record: deployment name, UTC time, operator, include-storage yes/no.
3. Download ZIP to encrypted storage.
4. Run path/manifest helpers against the file list (offline).
5. Confirm secrets are **not** inside the ZIP (env vars are outside backups).

---

## 3. Isolated restore drill (mandatory for VERIFIED)

**Never restore over `effervescent-kangaroo-10` or production.**

1. Provision empty recovery Convex deployment.
2. Restore backup into that deployment only.
3. Verify schema + sample orgs/sites/devices/generators.
4. Verify telemetry current/buckets sample, alarms, audits, notify policies, ingest cursors, lifecycle/health, job state.
5. Verify tenant isolation still holds.
6. Record recovery duration (RTO) and any missing data window (RPO).

| Metric | Measured value |
|---|---|
| RPO | _operator fills after drill_ |
| RTO | _operator fills after drill_ |
| Drill date | _pending_ |
| Recovery deployment | _pending_ |

If the Convex plan cannot perform the required restore: document the plan limitation and keep status **BLOCKED — OPERATOR ACTION REQUIRED**.

---

## 4. Related docs

- `docs/backup-and-disaster-recovery.md`
- Convex Backup & Restore product documentation
