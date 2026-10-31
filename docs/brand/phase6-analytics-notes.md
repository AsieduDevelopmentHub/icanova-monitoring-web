# Phase 6 — Historical analytics notes

## Data-capability matrix

| Capability | Supported? | Source | Limits |
| ---------- | ---------- | ------ | ------ |
| Historical measurements | Yes | `telemetryBuckets` via `telemetry.series` | 15-min buckets · ~7 day retention · ranges hour/6h/24h/7d |
| Min/max/avg/count | Yes | Client `seriesStats` over series folds | Measured samples only; gaps not zero-filled |
| 30-day history | No | — | Not offered (pruned) |
| Gateway connection transitions | Partial | `deviceHealthEvents` | ~14 day retention · not uptime % |
| Historical availability % | No | — | Do not invent from snapshots |
| Alarm analytics | Yes | Loaded/filtered alarm rows + export | Page-scoped counts; export capped |
| Audit timeline | Yes | `audits.list` | Paginated |
| Health timeline | Yes | `deviceHealth.recentForSite` + Events UI | Site-scoped |
| Reports / CSV | Yes | `reports.build` | ≤200 rows · org-permission `export.reports` |
| Health export | Yes | new `kind: "health"` | Bounded org health events |

## Honest separations

- Cloud gateway contact ≠ Modbus link ≠ telemetry freshness.
- Current Online/Offline is a 3-minute contact rule — not historical availability.
- Exports state when they are capped / incomplete.
