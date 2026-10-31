# Phase 11 — Implementation notes

**Status: COMPLETE** (code + automated verify). Authenticated browser walkthrough of the twin remains optional — no invented credentials; public login verified.

## What shipped

### 11A — Power-flow twin

| File | Role |
| --- | --- |
| `src/viz/powerFlowModel.ts` | Honesty rules: flowing / static / stale / blocked / fault |
| `src/viz/PowerFlowTwin.tsx` | R3F: Gateway → Link → Generator → AC / Battery → Load + particles; measured kW callout |
| `src/viz/PowerFlowFlat.tsx` | SVG block diagram (11E / reduced-motion / narrow) |
| `src/viz/PowerFlowTwinLazy.tsx` | Lazy + fallback |
| `src/viz/powerFlowModel.test.ts` | Unit tests for animate/block/stale |

**Flow honesty:** particles only when engine running **and** measured power > 0 **and** not stale **and** link not fail. Missing power ≠ 0.

Palette: copper/success particles, graphite stage, steel idle paths — not competitor teal.

### 11B — Generator detail flagship

`ConvexGenerator.tsx`: twin + TechValues + alarms in `.gen-flagship` grid; more metrics disclosed; dense history table. No fake start/stop.

### 11C — Command Center

`Dashboard.tsx`: `PowerFlowTwinLazy` hero; TechValue strip (kW / Hz / RPM / L1 V); twin stage ~480px; charts height 260.

### 11D — List density

`DataTable` optional `dense`; applied on CC readings, gateways, alarms, OrgFleet readings table.

### 11E — Flat energy diagram

`PowerFlowFlat` is the print / reduced-motion / narrow-viewport energy block diagram (same topology as R3F).

## Acceptance checklist

- [x] Power-flow twin with branded copper/graphite craft (vs competitor isometric)
- [x] No fake flowing power on Modbus fail / missing / stale (unit-tested)
- [x] Generator detail: twin + ≤8 primary TechValues above the fold
- [x] Command Center: twin ≥420px (480); charts ≥220 (260)
- [x] No long page-head essays reintroduced
- [x] Palette from established tokens only
- [x] `pnpm test` + `pnpm build` pass
- [x] Browser login verified; authenticated twin deferred without session

## Design loop

Recurring design loop **stopped** (user request). Final polish applied in one pass — no further ticks.

## Out of scope (unchanged)

Map fleet, invented solar/ATS/tenants, new 3D packages, backend schema, production deploy.
