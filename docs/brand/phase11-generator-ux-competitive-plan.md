# Phase 11 plan — Beat competitor UX (generator-first)

**Status:** IMPLEMENTATION IN PROGRESS — see [`phase11-implementation-notes.md`](./phase11-implementation-notes.md).  
**Inputs:** Competitor screenshots in [`competitor-inspiration/`](./competitor-inspiration/).  
**Base:** Phase 9 Command Center + Phase 10 text densification.  
**Focus:** Generators as the hero product surface for iCanOva Monitoring.

---

## 1. Honest competitive read

The competitor (Invendis-style / American Tower ops console) wins on:

1. **Density** — many sites, many columns, little scrolling for lists.
2. **Familiar ops patterns** — filters, export, last-updated, alarm badges.
3. **One catchy graphic** — isometric site layout + energy distribution with visible “power path” (green dashed active lines).

It loses on:

1. **Brand identity** — generic navy/teal enterprise; clip-art isometric.
2. **Visual hierarchy** — equal-weight tiles and tables; hard to scan “what matters now.”
3. **Emotion / craft** — spreadsheet chrome, tiny type, form-heavy asset pages.
4. **Honesty of viz** — static dashed lines imply flow; often not a true live twin.

**iCanOva must not become a clone.** We keep graphite / warm white / copper / steel, Manrope / Inter / Plex Mono, and our honesty rules (cloud ≠ Modbus ≠ freshness; missing ≠ zero; no invented %).

**Near-term product scope:** generators + gateways + site board. Map fleet, multi-tenant DC, solar/rectifier product depth are later — only borrow *patterns*, not feature sprawl.

---

## 2. Design north star

**“Generator Command Instrument”**

When an operator opens iCanOva they should feel:

> I see the machine, I see power and status, I can drill to numbers — without reading an essay.

| Layer | Competitor | iCanOva target |
| --- | --- | --- |
| Hero | Flat isometric PNG + dashed lines | Live R3F **site/generator twin** with **animated copper/steel power flow** from real Convex state |
| Numbers | Colored KPI tiles + tiny tables | Large `TechValue` / Metric strip + taller SVG charts |
| Lists | 100-row zebra grids | Compact `DataTable`, status marks, row density — but lead with viz |
| Chrome | Icon rail + breadcrumbs everywhere | Dense Phase 10 shell; title XOR crumbs; copper active accent |
| Honesty | Often silent about missing data | Tooltips / one meta footer; never fabricate flow when link/freshness fail |

### Palette mapping (never copy their blue/teal)

| Role | Competitor habit | iCanOva token |
| --- | --- | --- |
| Shell / rail | Near-black + teal buttons | `--color-graphite` / `--bg-nav` |
| Page ground | Harsh white | `--color-warm-white` / dark `--color-graphite` |
| Primary action | Teal | `--color-muted-copper` |
| Active power flow | Green dashed | Success `#24845B` emissive particles on **running + measured power** |
| Grid / utility | Blue tiles | Information `#477CA8` (sparingly) |
| Alarm / stop | Red badges | Critical `#C64747` |
| Idle / offline path | Grey solid | Industrial steel / offline `#707780` |
| Metal equipment | Yellow DG boxes | Deep navy / titanium materials in R3F |
| Emphasis text | Blue links | Graphite ink + copper hover |

---

## 3. Catchiest competitor piece → our answer

References: [`06-graphical-dashboard-3d.png`](./competitor-inspiration/06-graphical-dashboard-3d.png), [`07-energy-distribution.png`](./competitor-inspiration/07-energy-distribution.png).

### What they show

Site schematic: Grid / DG / Solar → ATS → Rectifier → Battery → DC tenants, with green dashed “active” edges and kW callouts.

### What we implement (matched to *our* system)

**Do not invent solar / multi-tenant / ATS topology we do not store.**

For current Convex truth, the twin should model what we actually know:

```text
[ Gateway / cloud contact ]     ← device health (online/offline)
        │
   Modbus link ok|fail          ← link status (not the same as cloud)
        │
[ Generator set ]               ← engine pose from RPM / codes when present
   ├── Alternator / AC bus      ← voltage / frequency / power when measured
   ├── Battery                  ← battery V when measured
   └── Load / output            ← power kW when measured
```

Optional later (when schema exists): fuel tank, coolant, oil, phase legs R/Y/B as separate nodes.

### Power-flow rules (honesty-first)

| Condition | Visual |
| --- | --- |
| Link fail or no sample | Paths dim steel; **no** flowing particles; caption “No path — link/sample missing” |
| Fresh sample, power measured > 0, engine running | Copper/success particle stream along AC → load |
| Engine stopped, power ~0 | Static path, no animation |
| Stale sample | Amber edge pulse; particles freeze or slow; “Stale” chip |
| Fault / critical alarm | Critical emissive on fault node; flow optional stop |

**Implementation approach (no new 3D packages):**

1. Extend `CommandTwin` / new `SitePowerTwin` in `src/viz/` with R3F nodes + `useFrame` particle or moving dash textures along curves.
2. Keep lazy load + `prefers-reduced-motion` → flat SVG schematic (2D energy diagram like their block chart, but iCanOva styled).
3. Drive edges from existing queries only (`telemetry.current*`, `deviceHealth`, alarms). Missing metric → hide callout, not `0.00`.

### Layout for the catchy page

Proposed route (decide at implement time): deepen **Command Center** hero **or** add **Generators → Graphical** tab on site/generator detail — prefer **one hero surface** first (Command Center + Generator detail twin), not a sixth nav item.

Composition (desktop):

```text
┌─────────────────────────────────────────────────────────────┐
│ Status strip (online · generators · alarms · stale)         │
├──────────────────────────────┬──────────────────────────────┤
│                              │ Live TechValues (kW Hz RPM V) │
│   R3F twin + power flow      │ Alarms compact list          │
│   min-height ~480px          │ Equipment list               │
│                              │                              │
├──────────────────────────────┴──────────────────────────────┤
│ Tall SeriesCharts (power · frequency)                       │
├─────────────────────────────────────────────────────────────┤
│ Compact readings / events tables                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Per-page implementation guide

Each page: **competitor lesson → iCanOva layout → must-have data → anti-patterns.**

### 4.1 Command Center (`/app`) — primary hero

**Competitor parallel:** Site details + graphical dashboard + listing KPIs.  
**Files:** `Dashboard.tsx`, `CommandTwin*`, `SeriesChart`, shell.

| Do | Don’t |
| --- | --- |
| Hero twin + power flow as first visual after strip | Essay ledes / “engineering schematic…” paragraphs |
| Strip: gateways online, generators, active alarms, stale | Fake availability % |
| Side list: generator name + engine/freshness marks | Nested card mosaics |
| Charts full width, ≥220–280px | Tiny sparkline-only as the only chart |

**Done when:** First viewport reads as instrument + machine, not a documentation page.

---

### 4.2 Generator list (`/generators`)

**Competitor parallel:** Site listing / generator operation report (tables).  
**Files:** `Generators.tsx`, `OrgFleet`.

| Do | Don’t |
| --- | --- |
| Title only; dense table: name, site, link, engine, freshness, kW, RPM | Long Soft-AP essays |
| Status marks + copper row hover | 12 equal KPI cards above the table |
| Demo log clearly fixture-separated | Mixing demo rows into live org table without label |

**Done when:** Operators scan 20+ generators faster than the competitor’s zebra grid *and* feel brand (graphite/copper), not Excel.

---

### 4.3 Generator detail (`/generators/:id`) — flagship vs asset page

**Competitor parallel:** [`03-asset-generator.png`](./competitor-inspiration/03-asset-generator.png).  
**Files:** `ConvexGenerator.tsx`, twin, trends.

**Layout:**

1. Header: name + crumbs link back (no lede).
2. Twin stage (power flow for *this* machine).
3. Primary metrics row: RPM, Battery, Hz, kW, L1 V, Load, Fuel (only if present).
4. Alarm strip (left or below): severity marks, not a green “OK” wall of every possible trip.
5. Charts (power/Hz/RPM) then “More measurements” disclosure.
6. History table compact.

| Do | Don’t |
| --- | --- |
| Visual machine first | Mid-page “configuration form” as hero (we don’t remote-write Modbus from cloud) |
| Acknowledge honesty: no start/stop from cloud unless product adds it | Fake Power / E-Stop buttons that don’t work |
| Alarms from stored records | Invent named DSE trips not in sample |

**Done when:** Side-by-side with competitor asset page, ours looks more “product” and less “admin form.”

---

### 4.4 Live Systems (`/local` monitor)

**Competitor parallel:** Site details metric tiles + DG controller table.  
**Files:** `Monitor.tsx`.

| Do | Don’t |
| --- | --- |
| Large metric grids per generator | Paragraph about Soft-AP vs Convex on every row |
| Stale visual treatment strong | Pretend Soft-AP live poll |

---

### 4.5 Gateways list + detail

**Competitor parallel:** Device health view.  
**Files:** `Gateways.tsx`, `GatewayDetail.tsx`.

| Do | Don’t |
| --- | --- |
| Separate chips: Cloud · Modbus · Freshness · Overall | One green “Online” that conflates all three |
| Identity + contact ages as facts | Invent firmware / router / SIM fields |

**Device health card pattern:** two-column facts, not three equal “info / router / usage” cards unless we have that data.

---

### 4.6 Sites

**Competitor parallel:** Site listing.  
**Files:** `Sites.tsx`.

| Do | Don’t |
| --- | --- |
| Dense site table + drill to Command Center filtered by site | Nested donut of invented running/non-running categories |
| Optional small status strip per selected site | Alarm trend bars from fake series |

Map ([`04-sites-on-map.png`](./competitor-inspiration/04-sites-on-map.png)): **Phase 12+** only if geo coordinates exist.

---

### 4.7 Alarms + Events

**Competitor parallel:** Alarm lists / badges on site header.  
**Files:** `Alarms.tsx`, `Events.tsx`, `AlarmPanel`.

| Do | Don’t |
| --- | --- |
| Severity-first table; compact summary metrics | Walls of honesty copy above filters |
| Deep-link from Command Center Attention | Acknowledge implying cleared condition |

---

### 4.8 Trends / Analyze

**Competitor parallel:** DC voltage charts on site details; energy distribution numbers.  
**Files:** generator trends in `ConvexGenerator`, Reports trends deep-link, `SeriesChart`.

| Do | Don’t |
| --- | --- |
| Tall charts; range control; stats strip from measured points only | Connect gaps as zero |
| Power + frequency as primary; RPM secondary | Chart junk drawers |

---

### 4.9 Reports / Maintenance / Notifications / Admin

**Competitor parallel:** Generator operation report + dense logs.  
**Files:** OrgGate pages.

| Do | Don’t |
| --- | --- |
| Short titles; export form compact; table after one summary line | Competitor-style 100-row report as the *only* UI |
| Bounded exports remain honest | Availability % columns |

---

### 4.10 Login

Already Phase 9/10 fullscreen brand pane. Keep short tagline; copper CTA; no competitor teal.

---

## 5. Implementation phases (suggested)

| Step | Work | Outcome |
| --- | --- | --- |
| **11A** | `SitePowerTwin` / extend `CommandTwin`: nodes + flow particles + reduced-motion SVG | Catchiest graphic beats isometric clip-art |
| **11B** | Generator detail flagship layout (twin → metrics → charts → disclose) | Asset page beats form-heavy competitor |
| **11C** | Command Center composition polish (strip + twin height + chart duo) | First viewport = instrument |
| **11D** | List density pass (generators, gateways, alarms) — zebra optional, status marks strong | Tables competitive without looking like Excel 2007 |
| **11E** | Optional: 2D energy block diagram page (SVG) for reduced-motion / print | Same topology story without WebGL |
| **Later** | Map, multi-source site layout (grid/solar/ATS) **only with real schema** | Don’t fake topology |

**Constraints (carry forward):**

- No new chart libraries; no new 3D packages beyond current three/r3f/drei.
- No schema invention for pretty diagrams.
- No production deploy required for design iteration.
- Preserve `RequireAuth`, routes, honesty semantics.

---

## 6. Acceptance checklist (generator-first)

- [x] Competitor graphical page side-by-side: ours looks more branded and more “alive” when data is fresh.
- [x] When Modbus fail / missing sample: **no fake flowing power**.
- [x] Generator detail: twin + ≤8 primary metrics above the fold on desktop.
- [x] Command Center: twin stage ≥420px desktop; charts ≥220px.
- [x] No page reintroduces long `page-head` essays (Phase 10 rule holds).
- [x] Palette only from established tokens.
- [x] `pnpm test` + `pnpm build` pass; browser verify login + authenticated if session exists.

---

## 7. Reference map

| Need | Path |
| --- | --- |
| Screenshots + captions | [`competitor-inspiration/README.md`](./competitor-inspiration/README.md) |
| Brand tokens | [`gptbrand.md`](./gptbrand.md) § palette · `src/styles.css` |
| Phase 9 twin/charts | [`phase9-command-center-notes.md`](./phase9-command-center-notes.md) |
| Phase 10 densify | [`phase10-visual-overhaul-notes.md`](./phase10-visual-overhaul-notes.md) |
| Twin code | `src/viz/PowerFlowTwin.tsx`, `PowerFlowFlat.tsx`, `powerFlowModel.ts` |

---

## Classification

**COMPLETE** — 11A–11E implemented. See [`phase11-implementation-notes.md`](./phase11-implementation-notes.md). Design loop closed.
