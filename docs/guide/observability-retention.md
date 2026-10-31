# Observability retention (Phase 7I.8)

| Data | Retention | Mechanism | Notes |
|---|---|---|---|
| `telemetryBuckets` | 7 days | Cron prune indexed by `bucketStart` | Current telemetry kept |
| `ingestOpWindows` | 7 days | Hourly cron `ingestOps.pruneOld` | Hourly aggregates only |
| `ingestRateWindows` | ~2 hours idle | 15 min prune | Ephemeral |
| `deviceHealthEvents` | **14 days** | 15 min `deviceHealth.pruneHealthEvents` | Transitions only |
| `jobRunState` | Indefinite (one row/job) | Upsert in place | No secrets |
| `migrationState` | Indefinite (few rows) | Upsert | Operator-started |
| `audits` | **Keep** | No ops prune | Never deleted by 7.4 jobs |
| `alarms` / alarm history | **Keep** | No ops prune | Jobs must not clear alarms |
| `messages` / inbox | Keep for ops | No automatic wipe in 7.4 | Sampled in overview |
| `modbusRecords` | Deferred | — | Still unbounded; future phase |

## Rules

- Cleanup is indexed, batched, idempotent.
- Active alarms and audit history are never deleted by operational cleanup.
- Historical telemetry current docs are not pruned; only aged buckets.
- Retention constants live in `convex/limits.ts` (`HEALTH_EVENT_RETENTION_MS`, `INGEST_OPS_RETENTION_MS`).
