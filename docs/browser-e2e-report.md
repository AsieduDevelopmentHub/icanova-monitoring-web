# Browser E2E report (Phase 8.0C)

**Date:** 2026-10-30  
**Tool:** Playwright (`e2e/`, `playwright.config.ts`)  
**Default base URL:** `http://127.0.0.1:4173` (never production)

---

## Execution

```bash
pnpm build
pnpm test:e2e:install
pnpm test:e2e
```

Credentials stay in `.env.e2e` (gitignored). Template: `.env.e2e.example`.

---

## Results matrix

| Scenario | Status | Notes |
|---|---|---|
| Unsigned dashboard notice | **VERIFIED** (4 passed, 1 skipped) | Local preview 2026-10-30 |
| Unsigned ops notice | **VERIFIED** | |
| Settings page loads | **VERIFIED** | |
| Demo generators labelled | **VERIFIED** | |
| Real IdP sign-in | **BLOCKED** | Needs operator staging IdP + `E2E_OIDC=1` |
| Invalid auth / session expiry | **BLOCKED** | IdP |
| Logout end-session | **BLOCKED** | IdP |
| Tenant isolation in browser | **BLOCKED** | Needs synthetic signed-in accounts |
| Fleet / alarms / notify / ops authenticated | **BLOCKED** | Spec scaffold: `e2e/authenticated.spec.ts` (skipped) |
| Reports export auth | **BLOCKED** | Same |
| Convex JWT after OIDC | **BLOCKED** | Access token must match `AUTH_JWT_*` (see identity-provider-setup) |

Mocked Vitest OIDC claim tests are **not** browser IdP proof (`src/auth/oidc.test.ts`).

---

## Environment

| Item | Value |
|---|---|
| Staging Convex | `dapper-roadrunner-247` (backend ready) |
| Staging SPA host | OPERATOR — local preview or future host; Vercel absent |
| Production | Forbidden as E2E target |
| Guide | `docs/browser-e2e.md` |
