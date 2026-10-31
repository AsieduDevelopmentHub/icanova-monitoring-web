# Frontend production readiness (Phase 7J)

**Deployment under review:** development `effervescent-kangaroo-10`  
**Status:** Software hardening COMPLETE on development. Real IdP login and production SPA host remain OPERATOR ACTION REQUIRED.  
**Date:** 2026-10-30

---

## 1. Architecture

| Piece | Location | Notes |
|---|---|---|
| Boot | `src/main.tsx` | No `App.tsx`. Analytics + `Platform` + `BrowserRouter` |
| Providers | `src/platform/Platform.tsx` | Optional `ConvexProvider` when `VITE_CONVEX_URL` is set |
| Layout | `src/shell/Shell.tsx` | Sidebar + topbar + `Outlet` |
| Nav | `src/shell/nav.ts` | Grouped routes; Admin always listed |
| Auth storage | `src/platform/bearer.ts` | Bearer JWT in `sessionStorage` (`dse.bearer`) |
| Session FSM | `src/fleet/session.ts` | `signed-out` / `loading` / `rejected` / `open` |
| Soft gates | `LiveGate`, `OrgGate`, Ops notices | UI only — not authorization |
| Hard gates | Convex `requirePermission` / `requireAnyPermission` | Source of truth |

Routes: Dashboard, local monitor/configure, alarms, sites, generators, gateways, events, reports, maintenance, notifications, `/admin/ops|users|roles|settings`, catch-all `Unavailable`.

---

## 2. Authentication behavior

- **No Auth0/Cognito SPA SDK** in the browser. The SPA stores an operator-supplied bearer and passes it to Convex via `setAuth`.
- Sign-out = `setBearerToken(null)` (Clear session). There is no hosted login form; token injection is external (devtools / operator tooling / future IdP callback).
- Expired or invalid tokens: `users.me` returns null → `sessionView` → `rejected`; organization queries do not stay “open”.
- Reload preserves `sessionStorage` bearer for the tab session only.
- Unauthorized/Forbidden Convex errors map through `FleetBoundary` / `accessMessage` — no stack traces or raw tokens in UI.
- Cross-tenant: organization ids come from `organizations.mine`; server membership checks deny foreign org ids (covered by Convex tests).

**Production IdP wiring is OPERATOR ACTION REQUIRED** — see `docs/guide/production-auth-setup.md`.

---

## 3. Route protection and permissions

| Surface | Client gate | Server enforcement |
|---|---|---|
| Dashboard / fleet / telemetry | `LiveGate` | Org membership + permission on queries |
| Alarms | `LiveGate` + alarm helpers | `view.alarms`, `acknowledge.alarms`, `manage.alarms` |
| Reports / maintenance / notifications / users / roles | `OrgGate` | `export.reports`, `manage.*`, etc. |
| `/admin/ops` | Signed + **client** any of `view.diagnostics` \| `view.audit` \| `manage.devices` | Same set via `requireAnyPermission` |
| Settings | Soft signed-in notice | Static copy only |
| Demo generators/gateways/alarms | Always visible, labelled | N/A (fixtures) |

**Rules:** Hiding a nav item is never authorization. Direct API calls must still fail closed. Ops permission check in the UI is honesty only; Convex remains authoritative.

---

## 4. Development-only / demo features

| Feature | Risk | Mitigation |
|---|---|---|
| Demo generator `log-7320` | Always mounted | Labelled `notice fixture` / `DEMO_SOURCE` |
| `pnpm dev:mock` / `VITE_USE_MOCK` | Demo mode | Skips GA; not the production landing |
| Local `/local` gateway UI | Soft-AP / LAN | Requires `VITE_GW_URL` proxy |
| `scripts/operator.mjs` | Hardcoded kangaroo URL | Dev-only helper; not in SPA bundle |
| Unused `mockStatus` / `fixtureGenerators` | Dead code | Not presented as live telemetry |

Landing route remains Dashboard — not a demo route.

---

## 5. Loading, empty, error, unavailable

Consistent patterns:

- `undefined` query → `Loading …`
- Empty collections → empty copy / `DataTable` empty prop
- Missing Convex URL / unsigned → `notice` (no query)
- Permission denied / Unauthorized → `FleetBoundary` or explicit empty notice
- Telemetry missing → `—` / quality labels (**null is not zero**)
- App crash → `AppErrorBoundary` (safe message, Clear session / reload; no stack)

---

## 6. Performance and fleet scale

- Fleet health on Ops uses `orgHealthSummaries` incremental tallies — **does not** download 10k devices.
- Reports cap at 200 rows.
- Alarm/event lists use indexed, bounded Convex queries.
- Charts use series helpers that skip non-measured points.
- Exact aggregate counts above 50 devices are preserved via server tallies, not client truncation.

---

## 7. Accessibility and responsive

- Skip link, breadcrumb, `aria-label` on primary nav and menu button.
- Status uses tone + text (`StatusMark`), not color alone.
- Tables use `.table-wrap { overflow-x: auto }`; metric grids reflow under media queries.
- Clear session and filter controls remain keyboard-reachable.
- No full redesign; industrial command-center chrome preserved.

**Known limits:** Not a WCAG audit. Screen-reader coverage is partial (status text + labels). Tablet/mobile layouts reuse existing CSS breakpoints.

---

## 8. Environment and build safety

| Check | Result |
|---|---|
| Server secrets in `VITE_*` | Forbidden by convention; `.env.example` documents only public Vite slots |
| Hardcoded kangaroo in `src/` / `convex/` | Not present (test fixture string in backup tests only) |
| Missing `VITE_CONVEX_URL` | Clear “not configured” notices; no silent fake live data |
| Demo as production landing | No |

---

## 9. Missing production safeguards (operator / deferred)

| Item | Status |
|---|---|
| Hosted IdP login UI | OPERATOR ACTION REQUIRED / DEFERRED |
| Router-level redirect to login | Soft notices only (by design until IdP exists) |
| Production static host + HTTPS | OPERATOR ACTION REQUIRED |
| Full browser E2E (Playwright) | DEFERRED — Vitest + convex-test used |
| External APM beyond optional Sentry DSN | Not required for 7J |

---

## 10. Files touched in 7J hardening

- `src/fleet/sessionGates.ts` — shared session/ops permission helpers
- `src/ui/AppErrorBoundary.tsx` — application error boundary
- `src/main.tsx`, `src/shell/Shell.tsx`, `src/pages/Ops.tsx`, `src/pages/Settings.tsx`
- Form pending guards on Users / Roles / Reports
- Tests under `src/fleet/` and related unit tests
