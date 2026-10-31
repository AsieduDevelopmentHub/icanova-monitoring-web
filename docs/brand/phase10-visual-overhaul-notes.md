# Phase 10 — Visual overhaul notes

**Status: PARTIAL** (authenticated Command Center / ops screens verified by build + tests; browser check covered public login; no invented credentials for full signed-in walkthrough).

## Goal

Strip text clutter and densify the authenticated iCanOva UI into a data-first industrial instrument — compact shell, rebuilt Command Center, larger charts, polished twin, page-by-page hierarchy — without changing Convex auth, honesty semantics, or routes.

## Workstreams completed

### A — Shell density

- Narrower sidebar / shorter brand lockup; nav collapse on desktop.
- Top bar: page title **or** crumbs (not both loudly); org, notifications, theme, user retained.
- Files: `src/shell/Shell.tsx`, `src/shell/nav.ts`, `src/styles.css`.

### B — Command Center rebuild

- Title-only page head (no essay lede).
- Compact `StatusStrip` (online / generators / Modbus fail / stale).
- Hero twin without section essay; equipment list beside twin.
- Full-width taller charts (power + frequency, height 240).
- Compact panels: Attention, Gateways, Alarms, Events, Readings.
- File: `src/pages/Dashboard.tsx`, `src/fleet/AlarmPanel.tsx`.

### C — Charts & twin

- `SeriesChart` optional `height` (default 220); quieter captions.
- `CommandTwin` geometry / camera / lighting polish; lazy + reduced-motion fallback unchanged; no new 3D packages.
- CSS: `.cc-twin-stage` ~420px desktop / ~260px mobile.

### D — Page-by-page text cut

| Area | Change |
| --- | --- |
| Login | Shorter brand pane; no membership essay under title |
| OrgGate | Optional `lede`; eyebrows removed |
| Live Systems | Large readings; short banners |
| Generators / Gateways / Sites / Alarms / Events / Ops / Settings | Title-only heads |
| Reports / Maintenance / Users / Roles / Notifications | OrgGate without long ledes; quieter panels |
| Gateway detail | Panel descriptions cut; Modbus boundary one-liner |
| Generator (Convex) | Primary metrics + twin; “More measurements” disclosure; denser trends charts |

Honesty semantics preserved (cloud ≠ Modbus ≠ freshness; missing ≠ zero). Explanations moved off every panel.

## Verify

| Check | Result |
| --- | --- |
| `pnpm test` | 44 files / 198 tests passed |
| `pnpm build` | `tsc --noEmit` + Vite build OK |
| Browser login (`/auth/login`) | Public sign-in shell loads (compact brand copy) |
| Authenticated ops | **Not fully walked** — no session / credentials in this environment |

## Classification

**PARTIAL** — code and automated verify complete; full authenticated UI browser pass remains when a real session is available locally.

## Out of scope (unchanged)

- Production Convex / Pages deploy
- Landing redesign
- New chart libraries or CAD models
- Backend / schema changes
