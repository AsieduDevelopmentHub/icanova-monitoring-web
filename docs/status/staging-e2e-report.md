# Staging and E2E verification report (Phase 7L)

**Date:** 2026-10-30  
**Execution environment:** Development Convex `effervescent-kangaroo-10` + Vitest/`convex-test`  
**Separate staging Convex:** **Not provisioned — OPERATOR ACTION REQUIRED**  
**Production:** Not used. Not claimed ready.

Provisioning steps: `docs/guide/staging-environment-setup.md`. Browser Playwright: `docs/status/browser-e2e-report.md`.

This report maps 7L checklist items to PASS / BLOCKED statuses. Browser IdP login E2E and live hardware validation remain blocked.

---

## 7L.1 Staging environment audit

| Item | Status |
|---|---|
| Staging Convex deployment | **OPERATOR ACTION REQUIRED** — does not exist in-repo |
| Staging frontend host | **OPERATOR ACTION REQUIRED** |
| Template | Separate Convex project; distinct `INGEST_SECRET`; Auth env; `VITE_CONVEX_URL`; optional `TEST_NOTIFY_*` only |
| Secret copy from prod/dev | Forbidden |
| Prod data clone | Forbidden |
| Verification used | Synthetic orgs/devices inside **convex-test** (in-process) and development deploy for function push only |

---

## 7L.2 Authentication E2E

| Check | Result |
|---|---|
| Real IdP sign-in | **BLOCKED** — no staging IdP |
| Invalid credentials (real IdP) | **BLOCKED** |
| Session FSM / rejected token UX | **PASS** — `sessionView` + `sessionGates` unit tests |
| Sign-out clears bearer | **PASS** — Clear session → `setBearerToken(null)` |
| Protected routes without token | **PASS** — soft notices; no org queries |
| Cross-tenant denial | **PASS** — `tenant.convex.test.ts`, `observability.convex.test.ts` |
| Permission denial | **PASS** — Convex `requirePermission` / ops overview restricted role |
| Admin-only via mocks only | Documented — **not** claimed as live IdP proof |

---

## 7L.3 Ingestion E2E

| Check | Result |
|---|---|
| Active device heartbeat / telemetry | **PASS** — `ingest.convex.test.ts`, `deviceHealth.convex.test.ts` |
| Inactive rejected | **PASS** — lifecycle + observability |
| Unknown rejected | **PASS** |
| Invalid auth | **PASS** — bearer helper / HTTP auth path |
| Duplicate / stale seq | **PASS** |
| Rate limits | **PASS** — `deviceLifecycle.convex.test.ts` |
| Oversized | **PASS** (body cap constant + ingest path) |
| Cross-tenant write | **PASS** — identity → single device/org |
| Op counters | **PASS** — `ingestOps` + observability |
| Metrics failure must not break ingest | **PASS** — best-effort `note()` in `http.ts` |
| Live HTTP against kangaroo | Optional smoke — not required for this report |
| Physical Modbus / DSE | **Not claimed** |

---

## 7L.4–7L.9 Domain E2E (software)

| Area | Result | Evidence |
|---|---|---|
| Telemetry decode / null / negative / freshness | **PASS** | readings, fleetView, history, privacy tests |
| Alarms lifecycle / isolation | **PASS** | alarms + commAlarms + tenant tests |
| Notifications (test providers) | **PASS** | notify + notifyReliability tests; no real-user sends |
| Device health independence | **PASS** | deviceHealth + observability |
| Scheduled jobs / retention (synthetic) | **PASS** | prune tests on synthetic aged rows only — **no destructive kangaroo cleanup** |
| `/admin/ops` ACL + empty | **PASS** | ops overview + UI permission helper |

---

## 7L.10 Scale simulation

**Label: simulation — not a production load test.**

| Scenario | Method | Observation |
|---|---|---|
| 10,000 tracked devices | Incremental `shiftHealthTallies` loop | Tallies reach 10,000 without a device table scan |
| Mixed health dimensions | Existing health logic tests | Gateway / Modbus / freshness independent |
| Ingest accept/reject mix | Observability + lifecycle tests | Counters incremental |
| Ops overview | Bounded samples + org summary doc | No full-fleet browser download |
| Frontend | Aggregate Metrics on Ops | Null device counters render `—` |

Measured in CI: Vitest suite duration ~few seconds for full suite; 10k tally loop is CPU-only math.

**Not performed:** Live soak of 10k devices against kangaroo; production load test.

---

## Verification commands run

```text
pnpm test
pnpm exec tsc --noEmit
pnpm build
pnpm exec convex dev --once   # development only
```

---

## Remaining operator actions

1. Provision isolated staging Convex + frontend.
2. Configure real staging IdP (issuer / JWKS / audience).
3. Run browser login E2E against staging.
4. Optional: controlled HTTP ingest smoke with synthetic gateway payloads.
5. Backup restore drill (see backup docs).
6. Hardware / live DSE validation (separate from this report).
