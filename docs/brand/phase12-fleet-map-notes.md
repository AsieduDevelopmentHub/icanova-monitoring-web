# Phase 12 — Fleet map notes

**Status: COMPLETE** (code + automated verify). Authenticated browser walkthrough of the map remains optional — no invented credentials.

## Goal

Geo situational awareness for the Sites list: honest Leaflet markers from stored WGS84 coordinates, status tones from live roster tallies — beating competitor “sites on map” without inventing pins or teal chrome.

## What shipped

| Piece | Detail |
| --- | --- |
| Data | `telemetry.siteRoster` returns `latitude` / `longitude`; `sites.get` returns coords + `locationUpdatedAt` |
| Map | [`src/sites/FleetMap.tsx`](../../src/sites/FleetMap.tsx) — OSM tiles, status divIcons, fitBounds, popups → Site Desk |
| Sites UI | List \| Map toggle on [`Sites.tsx`](../../src/pages/Sites.tsx); shared search / region / state filters |
| Location edit | [`SiteLocationPicker`](../../src/sites/SiteLocationPicker.tsx) on Site Desk when `manage.sites`; read-only meta otherwise |
| Status helper | [`siteStatus.ts`](../../src/sites/siteStatus.ts) — Attention / Degraded / Operational / Idle (shared with list) |

## Honesty rules

- Plot only when **both** latitude and longitude are finite. Never default Accra (or any) pins for missing sites.
- Unplaced sites listed under the map with link to Site Desk to set location.
- Fallback map center (Accra zoom 6) only when the **filtered** set has zero placed sites.
- Marker tones from roster health only — no invented availability %.

## Out of scope (deferred)

- Manual visual polish (operator follow-up)
- Marker clustering, heatmaps, geofencing
- Command Center map strip
- Multi-source site topology

## Verify

| Check | Result |
| --- | --- |
| `pnpm test` | 49 files / 229 tests passed |
| `pnpm build` | `tsc --noEmit` + Vite build OK |
| Browser login | Public shell only if no session |

## Acceptance

- [x] Placed sites on map with status-colored markers
- [x] Unplaced never get fake pins
- [x] Marker popup → Site Desk; Site Desk can save location with permission
- [x] No new map libraries (Leaflet already present)
- [x] Palette from established tokens
