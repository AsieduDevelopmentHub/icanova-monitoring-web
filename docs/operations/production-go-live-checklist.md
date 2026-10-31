# Production go-live checklist (Phase 10)

**Date:** 2026-10-31  
**Status:** CHECKLIST READY — execution requires **explicit production authorization**  
**Hardware:** DEFERRED  
**Remote generator control:** FORBIDDEN  

---

## Go-live blockers (mandatory)

| ID | Blocker | Closure |
|---|---|---|
| B1 | Sturgeon env empty (no JWT/JWKS/INGEST) | Provision **new** secrets after authorization |
| B2 | Sturgeon functions undeployed | Authorized `convex deploy` to production |
| B3 | Pages still on roadrunner | Authorized `pnpm build:production` + Pages deploy after B1–B2 |
| B4 | Live password-reset inbox proof | Staging mailbox OTP round-trip (`phase-10-password-reset-proof.md`) |
| B5 | Shared ingest exception acceptance or cutover plan | Written risk acceptance **or** device-cred soak |
| B6 | Prod-sourced DR | Plan exists; Class C drill still NOT DONE — accept residual or schedule |

## Acceptable documented exceptions (launch-day)

- Hardware ATP deferred (no physical fleet claim).  
- Auth0 inactive (Convex Auth primary).  
- Shared `INGEST_SECRET` temporarily retained with monitoring.  
- SMS/email customer delivery optional if providers unset (stay `not_configured`).

---

## Smoke tests (run only after authorization)

| # | Area | Preconditions | Action | Expect | Evidence | When |
|---|---|---|---|---|---|---|
| 1 | Backend up | Deployed sturgeon | Open Convex dashboard / HTTP discovery | 200 JWKS/OIDC | Screenshot | After deploy |
| 2 | Auth register/login | JWT/JWKS set | Sign up + sign in | Session; no Auth0 redirect | E2E or manual | After deploy |
| 3 | Password recovery | Resend prod/staging proof | Reset OTP | Inbox + new password works | Mail + login | Prefer staging proof first |
| 4 | Org membership | Signed in | Create org | Membership; no auto foreign admin | UI | After Auth |
| 5 | Roles | Owner session | Deny viewer-only manage.devices | Unauthorized | UI/API | After Auth |
| 6 | Tenant isolation | Two orgs | Cross-org inventory empty/deny | Isolation | Query | After Auth |
| 7 | Device register | Org + permission | Create device | Durable doc | UI | After Auth |
| 8 | Device cred | manage.devices | setIngestCredential | hasIngestCredential true | UI | Optional |
| 9 | Ingest | Secret/device cred | POST `/ncu/ingest` | 2xx/204; bad bearer 401 | HTTP status | After ingest env |
| 10 | Telemetry read | Ingested sample | Dashboard | Missing≠0; freshness separate | UI | After ingest |
| 11 | Alarms | Transition | Raise/clear | Notify policies respected | UI/history | After data |
| 12 | Notify | Provider optional | Delivery history | Status honest (`not_configured` ok) | UI | Optional |
| 13 | Audit | Prior actions | Audit list | Rows present | UI | After actions |
| 14 | Rate limit | Burst ingest | 429 path | Recorded | Ops | Optional soak |
| 15 | Backup | Pro/manual | Export ZIP | Artifact outside git | Operator log | Before launch traffic |
| 16 | Bundle hygiene | `build:production` | assert + secret scan | sturgeon only; no secrets | CI log | Before Pages |

## Exact next actions

### Without production authorization

1. Keep Pages on roadrunner; use `pnpm build:staging` for deploys.  
2. Complete staging reset mailbox proof.  
3. Continue device-cred lab batches when hardware available.  
4. Maintain mosquito quarantine.

### Requires production authorization

1. Set sturgeon secrets (new).  
2. Deploy Convex to sturgeon.  
3. `pnpm build:production` + Pages cutover.  
4. Execute smoke table; record evidence.

### Requires hardware authorization

1. ATP / RS485 / Soft‑AP.  
2. Fleet device-cred cutover batches.  
3. Never remote-control generators from cloud.
