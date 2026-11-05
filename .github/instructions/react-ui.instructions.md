---
description: "Use when changing React UI, shared shell, Command Center, data tables, or responsive CSS."
applyTo: "src/**/*.{tsx,ts,css}"
---

# React UI

- Follow the existing architecture and functional-component patterns; colocate helpers with their feature (`src/sites/`, `src/pages/…`).
- The shell topbar owns page titles. Do not add a duplicate large page header to the Command Center or Sites.
- Handle loading, empty, error, and offline states explicitly. Never present unavailable telemetry as a healthy zero.
- Preserve route and workflow behavior unless a change is intentional and documented.
- Dense tables need capped widths and ellipsis; keep the site alarm icon inside the Site Name cell.
- Keep pagination controls in one horizontal row on mobile. Put responsive CSS overrides after base rules.
- Use `useLiveNow` for age displays and Convex subscriptions for live data.
- Use the existing design tokens in `src/styles.css`; avoid purple/neon "AI" styling and do not introduce competitor colors.
- Read `docs/brand/app-ui-system.md` and the competitor benchmark at `docs/brand/competitor-inspiration/README.md` before substantial app UI work. Borrow information hierarchy, fleet density, clear status, and multi-panel operational patterns; never copy competitor branding, logos, or layouts verbatim.
- The product palette, typography, and truthfulness constraints in `docs/brand/phase11-generator-ux-competitive-plan.md` remain authoritative.
- The current refresh excludes marketing pages and Command Center dashboard content. Shared app-shell changes may appear on `/app`, but do not change its dashboard composition or content.
- For substantial UI changes, inspect actual browser behavior at desktop and mobile widths (including about 390–720px) before claiming it is verified.
