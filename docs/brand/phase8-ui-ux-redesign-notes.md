# Phase 8 — UI/UX redesign notes

**Date:** 2026-10-31  
**Classification:** **PARTIALLY COMPLETE**

Design-loop Stages A–F implemented with build/test gates. Spot-checked preview shell (nav groups, dark theme toggle, `/` → `/alarms`). Not every signed-in data route was visually verified.

## 1. Initial repository state

- Branch work preserved (no reset/clean/stash/commit).
- Existing Phase 3–7 brand, notify, and VAPID work left intact.
- Starting point: Phase 3 tokens in `src/styles.css`, Shell + flat Operate/Fleet/Records/Admin nav.

## 2. Existing design-system assessment

- Strong palette/typography already present (Manrope / Inter / IBM Plex Mono).
- Thin shared component set (Metric, DataTable, FilterBar, StatusMark, charts, Overlay).
- Dashboard equal-weight metric mosaic; table-heavy ops pages; sparse empty/loading primitives.

## 3. Final design direction

**Industrial Precision + Modern Enterprise SaaS** — graphite shell, warm workspace, restrained copper accent, severity-first operational hierarchy, honest status semantics (cloud ≠ Modbus ≠ freshness).

## 4. Design tokens

Extended in `src/styles.css`:

- Spacing through `--space-7`
- Type scale `--text-xs`…`--text-2xl`
- Panel/input/table/focus/shadow tokens for light + dark
- Dark theme: restrained shadows restored (not flat `none`)
- Attention / metric emphasis surfaces

## 5. Typography

- Manrope headings (`--font-display`)
- Inter body (`--font-body`)
- IBM Plex Mono for technical values, crumbs, nav labels, identities

## 6. Navigation changes

Remapped groups in `src/shell/nav.ts` (existing routes only):

- Overview · Monitoring · Infrastructure · Operations · Insights · Administration
- Collapsible groups (Administration collapsed by default; auto-expands for active route)
- Shell header: page title, breadcrumbs, org context, notifications shortcut + unread badge, theme toggle, session actions
- Mobile drawer retained

## 7. Page-by-page redesign summary

| Area | Changes |
|---|---|
| Dashboard | Attention-first hero; secondary health KPIs; Panel sections; Skeleton/EmptyState |
| Live readings | Panel + EmptyState; clearer measurement cards |
| Gateways / detail | Clearer copy; Panel sections; Button primitive; Skeleton |
| Alarms | Severity-first desk copy (lifecycle preserved) |
| Notifications | Tabs; Inbox Panel; VAPID panel clarified (not FCM) |
| Events | Tabs for health vs audit |
| Reports | Panel form with coverage honesty |
| Settings / Users / Unavailable | Panels, EmptyState, accurate VAPID notes |
| Auth login | Centered `auth-shell` / `auth-card` brand lockup |

## 8. Shared components created or improved

**New:** `Button`, `Panel`, `Badge`, `Tabs`, `EmptyState`, `Skeleton`  
**Improved:** `Metric` (tone, emphasis, ReactNode notes)

## 9. Responsive behavior

- Desktop: sticky sidebar + sticky topbar
- ≥720px: topbar page title visible
- Mobile: hamburger drawer; filter bars wrap; tables scroll horizontally
- Dashboard hero splits at ≥960px

## 10. Accessibility improvements

- Focus rings via `--shadow-focus` on inputs/buttons
- Tabs use `role="tablist"` / `aria-selected`
- Skip link retained
- Reduced-motion disables skeleton shimmer / topbar blur
- Touch-friendly icon buttons (34px min)

## 11. Functional preservation checks

No Convex schema/API changes. Auth, org/site isolation, alarm lifecycle, VAPID push APIs, reports, and theme persistence unchanged. Honesty labels preserved.

## 12. Files changed (primary)

- `src/styles.css`, `src/shell/nav.ts`, `src/shell/Shell.tsx`
- `src/ui/*` (new primitives + Metric)
- `src/pages/Dashboard.tsx`, Gateways, GatewayDetail, Alarms, Notifications, Events, Reports, Settings, UsersAdmin, Unavailable
- `src/local/Monitor.tsx`, `src/auth/AuthLogin.tsx`, `src/admin/OrgGate.tsx`
- `docs/brand/phase8-ui-ux-redesign-notes.md`

## 13. Build and test results

- `pnpm test` — **182 passed** (38 files)
- `pnpm build` — **passed**

## 14. Known limitations

- Not every admin/ops sub-view received equal visual depth (Roles/Ops/Maintenance still mostly prior layout with shared tokens).
- No dedicated toast system yet (errors remain inline).
- No brand favicon/logo asset beyond text wordmark.
- Full screenshot matrix / multi-viewport browser QA not archived in-repo.

## 15. Deferred design work

- Deeper Roles/Ops/Maintenance/Alarm list card treatment
- Chart density pass on generator Trends
- Optional collapsible sidebar width
- Production visual QA with signed-in staging data

## Stage log

| Stage | Gate |
|---|---|
| A Foundation | build + test pass |
| B Shell | build + test pass |
| C Primary ops | build pass |
| D Ops/insights | build pass |
| E Admin/auth | build pass |
| F Consistency | final build + test pass |
