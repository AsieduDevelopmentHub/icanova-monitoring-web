# Phase 9 — Command Center notes

**Date:** 2026-10-31  
**Classification:** **PARTIALLY COMPLETE**

Authenticated application rebuilt toward **Industrial Precision + Modern Enterprise Control Center**. Public landing (Phase 8B) unchanged. Production deploy not in scope.

## Dependencies added

- `three`, `@react-three/fiber`, `@react-three/drei` — lazy Command Center / generator twin  
- `@types/three` (dev)

Charts remain hand-rolled SVG (`SeriesChart` / `Sparkline`) — no Recharts/D3.

## Design system

- Tokens + surfaces in `src/styles.css` (`status-strip`, `cc-*`, denser nav, chart grid)  
- Primitives: `StatusStrip`, `TechValue`, `SectionHeader`, `Sparkline`  
- Full-screen split auth shell CSS  

## Shell / nav

Remapped groups (routes preserved):

- Overview → Command Center `/app`  
- Monitor → Live Systems, Generators, Gateways  
- Analyze → Trends (demo/generator trends path), Reports  
- Operate → Alarms, Events, Notifications, Maintenance  
- Administration → Sites, Users, Roles, Settings, Configure, Ops desk  

Top bar: compact system status chip from critical notices when signed in.

## Authentication

`AuthLogin` is a full-screen enterprise page (brand pane + form). `RequireAuth` still gates all Shell routes.

## Command Center (`/app`)

1. System status strip (real site summary / freshness — no fabricated %)  
2. Lazy R3F equipment twin + equipment list (flat SVG under reduced motion / narrow)  
3. Needs-attention panel  
4. Power / RPM charts from `telemetry.series` when permitted  
5. Gateway health, alarms, recent activity, readings table  

## Ops cascade

Eyebrow + Command Center typography on Monitor, Generators, Gateways, Alarms, Events, Sites, Settings, Ops, Reports, Maintenance, Notifications. Generator detail uses `CommandTwinLazy`.

## Honesty preserved

Cloud ≠ Modbus ≠ freshness. Missing is not zero. Charts omit gaps. No invented firmware/uptime.

## Build and test

- `pnpm test` — **186 passed** (39 files)  
- `pnpm build` — **PASS** (CommandTwin code-split ~995 kB lazy chunk)  

## Known limitations

- Trends nav item deep-links demo/generator trends path when no site-specific trends index exists  
- Twin is a schematic assembly, not a scanned CAD asset  
- Not every admin table received equal density rewrite  
- Visual screenshot archive not committed  

## Deferred

- Dedicated Trends index page  
- Richer multi-equipment plant twin  
- Deeper motion system beyond twin auto-rotate / CSS  
