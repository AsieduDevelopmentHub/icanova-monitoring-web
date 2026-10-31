# Phase 4 — Monitoring experience notes

## Data capabilities (audited)

| Capability | Source | Notes |
| ---------- | ------ | ----- |
| Site telemetry snapshot | `telemetry.currentForSite` | Bounded generators + stored samples |
| Site tallies | `telemetry.siteSummary` | Gateway online/offline (3 min), Modbus, freshness, overall |
| Site gateway health rows | `devices.siteHealth` (new) | Devices + `deviceHealthCurrent` |
| Recent site activity | `deviceHealth.recentForSite` (new) | `deviceHealthEvents` by `by_site_at` |
| Site alarms | `alarms.forSite` | Existing lifecycle; no new alarm semantics |
| Live Soft-AP poll | Not on Live readings page | Local Configure/Monitor Soft-AP is separate |
| Firmware version | Not stored | Shown as unavailable |
| Fake trends / % deltas | Not used | Omitted |

Gateway Online ≠ Modbus ok ≠ telemetry Fresh. UI labels keep these distinct.
