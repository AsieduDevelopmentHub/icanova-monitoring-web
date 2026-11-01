# Phase 8B — Premium redesign notes

**Date:** 2026-10-31  
**Classification:** **PARTIALLY COMPLETE**

Public landing + routing + substantial app visual restraint completed. Auth gate and a second-pass landing redesign (reference-quality composition) followed. Further page-by-page ops polish and full screenshot matrix remain deferred.

## Reference websites and principles

### VITAL-GO (`https://vital-go.com/` — inspected live + `docs/reference/vital-go_reference.png`)

- Confident hero + dual CTAs
- Editorial light/dark section rhythm
- Product proof without icon-card spam
- Dark chrome / light workspace contrast for software moments

### ORRAI (`https://www.orrai.app/` — inspected live + `docs/reference/orrai_reference.png`)

- Bold display typography + purposeful whitespace
- Sticky marketing nav with Sign in + primary CTA
- Linear storytelling; stats as type, not gamified tiles
- Soft bands, not floating card grids

**Not copied:** layouts, logos, blues-as-brand, copy, or assets. Reinterpreted for iCaNova graphite / warm white / copper.

## Initial visual audit

Phase 8 left a functional but card-heavy, equal-weight KPI mosaic. Root route opened the app shell — no brand landing. Needed a marketing surface and quieter operational chrome.

## New design direction

Premium Industrial Technology + Contemporary Enterprise Software. Marketing uses large Manrope display and section storytelling; the app uses divider/type/table hierarchy with fewer bordered floating panels.

## Landing page structure

`src/marketing/Landing.tsx` + `landing.css` (second pass):

1. Sticky public nav (Sign in + Get started)  
2. Full-bleed hero + dominant framed product UI (sidebar / metrics / chart / table)  
3. Typographic product-facts strip (honesty triad, channels, retention — no fake metrics)  
4. Platform editorial split  
5. Capabilities list — Soft-AP `/local` public; other destinations → login with `from`  
6. Rich product proof frames (alarms / gateway / readings)  
7. Dark honesty band (cloud ≠ Modbus ≠ freshness)  
8. Numbered workflow steps  
9. FAQ accordion  
10. Closing CTA card  
11. Footer + outlined `ICANOVA` wordmark  

## Routing + auth gate

| Route | Behavior |
|---|---|
| `/` | Public landing (no sidebar) |
| `/login` | → `/auth/login` |
| `/auth/login`, `/auth/callback` | Outside Shell |
| `/app`, `/local`, and all other ops routes | `RequireAuth` → Shell; unsigned → `/auth/login` with `from` (no unsigned Shell) |
| Post-login | `safeReturnPath(from)` or `/app` |

Brand lockup in Shell links home `/`.

## Application redesign

- Shell: brand → marketing home; Dashboard nav → `/app`
- Quieter panels, tabs, metrics, tables, notices (divider-led, less card chrome)
- Dashboard / Monitor / Alarms / Events copy tightened
- Auth shell: centered branded card on warm canvas

## Shared components

Marketing kept separate (`src/marketing/*`). App continues Phase 8 primitives with restyled surfaces.

## Screenshots / visual verification

Browser-inspected (not committed as assets):

| Surface | Result |
|---|---|
| Landing desktop `/` | Editorial hero, copper CTAs, illustrative product frame, section storytelling |
| Landing mobile (~390×844) | Compact nav + hamburger drawer; hero stacks |
| Dashboard `/app` | Dark sidebar / light workspace; severity-first lede; unsigned notice |
| Auth `/auth/login` | Centered branded card on warm canvas (outside Shell) |
| Alarms (light + dark) | Table-led demo list; theme toggle works |
| Live Vital-Go / Orrai | Reference principles applied — not layouts copied |

Not fully screenshot-archived in-repo: gateway detail, notifications, reports, administration (pages polished structurally; deeper editorial pass deferred).

## Responsive behavior

Landing: mobile drawer; desktop nav + two-column hero ≥800px. App responsive rules retained. `prefers-reduced-motion` respected on marketing buttons/nav and app stale/skeleton motion.

## Functional regression

- Unsigned `/app`, `/local`, `/alarms`, etc. redirect to `/auth/login` — no Shell / “not signed in” board  
- Marketing capability links send unsigned users to login with `from`  
- Mobile nav is a right overlay panel (not an in-flow top push)  
- `/` landing; `/login` → `/auth/login`; auth outside Shell  
- Post-auth restores `from` via `safeReturnPath`  
- No schema/API changes  
- Theme persistence unchanged  

## Build and test

- `pnpm test` — 186 passed (39 files)  
- `pnpm build` — passed  

## Known limitations

- Not every admin page received equal editorial rewrite  
- Hero / showcase still use illustrative CSS UI compositions (labeled), not live PNG captures  
- Marketing has no separate dark theme  
- Full acceptance screenshot matrix not committed to `docs/`  
## Deferred

- Dedicated marketing dark mode  
- Real PNG screenshots of signed-in dashboard in showcase  
- Deeper Roles/Ops/Maintenance redesign  
- Motion polish beyond restrained CSS transitions  
