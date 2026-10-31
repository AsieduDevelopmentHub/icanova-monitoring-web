# Backup and disaster recovery (Phase 7G)

**Status labels used below**

| Label | Meaning |
|---|---|
| **Verified (docs)** | Confirmed from [Convex Backup & Restore](https://docs.convex.dev/database/backup-restore) |
| **Recommended** | Target for this product; not measured in production |
| **NOT TESTED — OPERATOR ACTION REQUIRED** | Procedure exists on paper only |

This phase did **not** restore over development or production.

---

## 1. Verified Convex capabilities

| Capability | Status |
|---|---|
| Manual dashboard backup (consistent snapshot) | **Verified (docs)** |
| Include file storage in backup | **Verified (docs)** optional |
| Download ZIP / `npx convex export` | **Verified (docs)** |
| Restore from dashboard or `npx convex import` | **Verified (docs)** — **destructive** to target tables |
| Periodic daily/weekly backups | **Verified (docs)** — requires **Convex Pro** |
| Manual backup retention | **Verified (docs)** — **7 days** |
| Weekly backup retention | **Verified (docs)** — **14 days** (Pro periodic) |
| Free/Starter stored backup count | **Verified (docs)** — up to **2** per deployment |
| Point-in-time recovery (arbitrary timestamp) | **Unavailable** in public docs |
| Backup includes code / crons / schema source | **No** — source control only |
| Backup includes env vars | **No** — dashboard / `convex env` separately |
| Backup includes pending scheduled functions | **No** |
| Dev backup auto-safe for prod restore | **No** — separate deployments; restore is destructive |

Platform durability note (Convex status docs): encrypted at rest, multi-AZ replication, periodic/incremental platform backups with high durability claims — these are **platform** guarantees, not a substitute for an operator-owned restore drill.

---

## 2. Recommended recovery objectives (not achieved values)

| Objective | Recommendation | Label |
|---|---|---|
| RPO | ≤ 24 h for registration/config; ≤ 15–60 min for telemetry if Pro daily backups + export cadence | **Recommended** |
| RTO | ≤ 4 h to restore isolated env + verify; ≤ 8 h to return production writers | **Recommended** |

### Recovery priorities

1. Organizations, users, memberships, roles  
2. Sites, devices, generators, lifecycle  
3. Ingest cursors / idempotency (`ingestCursors`, `notificationDispatches`)  
4. Active alarms + alarm history  
5. Notification policies/preferences (not outbox secrets)  
6. Telemetry current + recent buckets  
7. Device health / site summaries (rebuildable)  
8. Audit records  
9. Rate-limit windows (ephemeral; safe to lose)

### Dependencies

- Convex dashboard access + team permissions  
- Source repo for functions/schema  
- Separate copy of env vars (IdP, `INGEST_SECRET`, Resend/Arkesel) — **never inside ZIP docs**  
- Firmware/collector configs outside Convex  

---

## 3. Operator backup runbook

1. Open Convex dashboard → deployment → **Backups**.  
2. Prefer **Backup automatically** (Pro) daily; otherwise **Backup Now** before releases.  
3. Optionally include file storage if `_storage` matters.  
4. Confirm completion in the UI; record UTC time, deployment name, operator, ticket id.  
5. Download ZIP to encrypted storage; restrict access.  
6. Retention: dashboard 7/14 days — copy critical ZIPs off-platform for longer retention if required.  
7. Integrity: run path/manifest checks (`src/ops/backupArtifact.ts` helpers) on the file list / counts.  
8. Never put `INGEST_SECRET`, JWT private keys, or provider API keys into backup notes or ZIPs.

CLI export alternative:

```bash
npx convex export --path ./backups
```

Record environment (`development` vs production) in the operator log.

---

## 4. Restore procedure (safe)

**Do not restore over live production as part of Phase 7.3.**

1. Identify affected environment.  
2. Pause writers if possible (inactive devices / rotate ingest secret / stop collectors).  
3. Take a **fresh backup** of the current bad state (restore is destructive).  
4. Restore into an **isolated** recovery deployment (or explicitly approved target).  
5. Push known-good code (`npx convex dev` / deploy).  
6. Restore env vars separately.  
7. Verify: orgs, sites, devices, generators, lifecycle, cursors, alarms, telemetry samples, tenant isolation.  
8. Reconcile health summaries if needed (`deviceHealth.requestSiteReconcile`).  
9. Operator approval before re-enabling collectors.  

Import example (destructive):

```bash
npx convex import --replace snapshot_....zip
```

Only with explicit target deployment flags and approval.

---

## 5. Recovery verification status

| Item | Status |
|---|---|
| Path/manifest integrity helpers | Implemented + unit tested |
| Dashboard backup taken in this phase | Staging ZIP export **VERIFIED** 2026-10-31; Pro periodic still **OPERATOR** |
| Periodic backups enabled on Pro | **NOT TESTED — OPERATOR ACTION REQUIRED** |
| Restore into isolated deployment | **VERIFIED** — `vivid-mosquito-28` (see `docs/guide/backup-restore-verification.md`) |
| End-to-end DR drill with collectors | **NOT TESTED — OPERATOR ACTION REQUIRED** |

`RESTORE_TEST_STATUS` in code: `VERIFIED — isolated recovery 2026-10-31 (vivid-mosquito-28)`
