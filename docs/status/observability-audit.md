# Observability audit (Phase 7I.1)

**Date:** 2026-10-30  
**Deployment:** development `effervescent-kangaroo-10`

---

## Already observable (reuse)

| Signal | Source |
|---|---|
| Gateway / Modbus / freshness / overall | `deviceHealthCurrent`, `orgHealthSummaries`, `siteSummaries` |
| Health transitions | `deviceHealthEvents` (not every sample) |
| Device lifecycle | `devices.lifecycle`, audits |
| Telemetry current + age | `telemetryCurrent` |
| Alarms | `alarms` + events |
| Notification outbox | `messages`, `userNotifications`, `notificationDispatches` |
| Job runs | `jobRunState` via `api.jobStatus.list` |
| Modbus LAN frames | `modbusRecords` / `devicePolls` when present |
| Audit trail | `audits` |
| Rate-limit windows | `ingestRateWindows` (internal) |

## Gaps before 7.4

| Gap | Risk |
|---|---|
| No ingest accept/reject counters | Hard to see pipeline health without log scraping |
| Auth / rate-limit / oversized outcomes not tallied | Silent collector misconfig |
| No single operator overview page | Operators hunt across pages |
| `deviceHealthEvents` unbounded | Storage growth |
| Notification totals require scans | Must stay sampled/bounded |
| Job “stale” not surfaced in UI | Missed cron ticks |

## Additions in 7.4

- Hourly `ingestOpWindows` counters (global + org) — not one row per request
- `api.ops.overview` + Admin → Operations page
- Health-event prune (14 days)
- Ingest op window prune (7 days)
- Active/inactive device counters on `orgHealthSummaries`

## Explicit non-goals

- Second alarm system
- Event per telemetry sample
- Duplicate of `deviceHealthEvents` for gateway/modbus/freshness
- External APM SaaS
- Invented Modbus CRC/timeout categories without evidence
