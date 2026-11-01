# Phase 8B — Visual direction

**Date:** 2026-10-31

## References inspected

### VITAL-GO (`https://vital-go.com/`) — live + local PNG

Principles extracted (not copied):
- Confident hero with one clear message + dual CTAs
- Editorial section rhythm: alternating light / deep navy moments
- Product proof via framed UI / signal storytelling rather than icon-card spam
- FAQ accordion and restrained footer hierarchy
- Dark sidebar + light workspace contrast when showing software

### ORRAI (`https://www.orrai.app/`) — live + local PNG

Principles extracted:
- Generous, purposeful whitespace and bold sans display hierarchy
- Linear storytelling (problem → proof → steps → closing CTA)
- Clean sticky marketing nav with Sign in + primary CTA
- Soft section bands without wrapping every idea in a floating card
- Stats as typography, not gamified tiles

### Current iCaNova (`icanova.pages.dev` / local Phase 8)

Why it still feels generic / arcade-adjacent:
- Equal-weight metric mosaics and bordered panels everywhere
- Card-like treatment for almost every section
- Marketing and product share the same app chrome (no public landing)
- Copper accents on too many interactive states can feel “badge-y”
- Insufficient editorial hierarchy on first paint

## New direction

**Premium Industrial Technology + Contemporary Enterprise Software**

- Marketing: large Manrope display, warm white canvas, graphite/navy structural bands, copper CTAs sparingly
- Application: denser, type/divider/table-led — fewer bordered cards, quieter status chrome
- Keep iCaNova palette; do **not** adopt Vital-Go/Orrai blues as brand

## Routing plan

| Route | Purpose |
|---|---|
| `/` | Public landing (no app sidebar) |
| `/login` | Alias → `/auth/login` |
| `/app` | Authenticated dashboard entry |
| Existing `/alarms`, `/gateways`, … | Unchanged deep links under Shell |

## Page redesign priorities

1. Landing (hero → intro → capabilities → showcase → solutions → CTA → footer)
2. Shell quieter + Dashboard less card-grid
3. Tables/charts/status restraint across ops pages
4. Auth/login aligned with marketing brand moments
