# Scheduled jobs audit (Phase 7H)

**Source of truth:** `convex/crons.ts` plus scheduler chains from mutations.  
**Visibility:** `jobRunState` via `jobStatus.list` (requires `view.audit` or `manage.devices`).

---

## 1. Cron inventory

### `prune telemetry buckets`

| Field | Value |
|---|---|
| Schedule | Every 1 minute |
| Entry | `internal.telemetry.pruneBuckets` |
| Purpose | Delete `telemetryBuckets` older than 7 days |
| Reads | `telemetryBuckets` (`by_bucket`), `retentionState`, `jobRunState` |
| Writes | Deletes buckets; updates `retentionState` + `jobRunState` |
| Batch | `PRUNE_BATCH` (80); up to `PRUNE_ROUNDS` (10) chained |
| Idempotent | Yes — deleting already-gone rows is a no-op next cycle |
| Failure | Next cron still fires; status recorded |
| 10k scale | Index range scan; O(batch) per round |

### `device health sweep`

| Field | Value |
|---|---|
| Schedule | Every 1 minute |
| Entry | `internal.deviceHealth.sweep` |
| Purpose | Mark gateway offline / telemetry stale after 3 minutes |
| Reads | `deviceHealthCurrent` sweep indexes |
| Writes | Health current/events/summaries; may emit health notifies |
| Batch | `HEALTH_SWEEP_BATCH` (40) each dimension; chains if full |
| Idempotent | Transitions only on change; notify keys include timestamp |
| Failure | Next cron continues; does not clear alarms |
| 10k scale | ~250 chained rounds worst case per minute if all stale — monitor `pendingHint` |

### `prune ingest rate windows`

| Field | Value |
|---|---|
| Schedule | Every 15 minutes |
| Entry | `internal.ingestRateLimit.pruneStale` |
| Purpose | Delete rate rows idle > 2 hours |
| Reads/Writes | `ingestRateWindows` by `updatedAt` |
| Batch | 40 |
| Idempotent | Yes |

---

## 2. Scheduler chains (not crons)

| Job | Trigger | Notes |
|---|---|---|
| `notify.deliverMessage` | On enqueue / retry | Lease + `claimGeneration`; uncertain SMS not auto-duplicated as success |
| `notifyEmit.reclaimIfStale` | After lease | Ignores stale claim generations |
| `notifyEmit.checkEscalation` | Alarm raise | Single-level; respects settings |
| `deviceHealth.reconcileSite` | Operator / request | Bounded page rebuild of site tallies |
| `generators.recountGenerators` | First generator on old sites | Paged absolute count |
| `migrations.backfillDeviceLifecycle` | Operator start only | dryRun default; **not** cron |

---

## 3. Reliability rules in force

- Repeated cron execution is safe (bounded deletes / transition diffs).
- Partial work resumes via scheduler continuation or next tick.
- Indexed queries only on hot paths.
- Notification idempotency keys + dispatch table.
- Delivery leases prevent silent stuck `processing`.
- Uncertain provider outcomes stay `uncertain` — no blind SMS resend as new success without claim rules.
- Jobs never clear/resolve alarms because telemetry is missing.
- Failures leave `jobRunState.lastError*` when status=`failed` (cron paths currently record ok/partial).

---

## 4. Scale simulation notes

| Check | Result |
|---|---|
| 10k health tally math | Covered in `deviceHealthLogic` unit test (incremental counters) |
| Prune without full-table scan | Uses `by_bucket` / `by_updated` ranges |
| Live 10k device soak | **Not performed** |

---

## 5. Monitoring

Query `api.jobStatus.list` for:

- `lastAttemptAt` / `lastSuccessAt`
- `processed` / `pendingHint`
- `durationMs` / `status`

Do not log secrets, phone numbers, or raw provider payloads in `lastError`.
