# Phase 9 — Plan

**Date:** 2026-10-31  
**Mission:** Operational maturity, security hardening, integration readiness  
**Baseline:** Phase 8 COMPLETE WITH DOCUMENTED EXCEPTIONS (`docs/status/phase-8-final.md`)  
**Production:** `NOT AUTHORIZED` — no sturgeon mutations  
**Hardware:** No flash / no COM8 / no invented telemetry  

---

## Backlog classification

### Completed (Phase 8 — do not redo)

| Item | Evidence |
|---|---|
| Convex Auth Password login/register/logout | 8.5E–G |
| Staging + hosted Pages Auth | 8.5F/G E2E 4/4 |
| Dual-auth ingest foundation | `ingestAuth.ts`, device cred APIs |
| Notification prefs / delivery / dedupe / retry | `notifications.ts`, `notifyDelivery.ts` |
| Ops / diagnostics surfaces | `Ops.tsx`, diagnostic panels |
| Staging restore drill | `vivid-mosquito-28` VERIFIED |

### Phase 9 — implement now (code)

| Priority | Item | Acceptance |
|---|---|---|
| **P0** | Password recovery (Convex Auth `reset` + UI) | Request + verify flows; rate-limit via Auth; tests; docs; live email optional |
| P1 | Password change (authenticated) | Signed-in user can rotate password |
| P1 | Notification maturity polish | Templates / preference UX / history clarity without inventing events |
| P2 | Device-cred staging tooling | Migration UX + docs; no prod secret retirement |
| P2 | Ops/diagnostics empty-state honesty | Missing ≠ zero preserved |
| P2 | Backup/DR doc hardening | Order, credentials, auth data; no prod-sourced drill |
| P3 | Scalability review | Index/query notes + optional load sims; no capacity claims |

### Needs staging provider credentials

- Live password-reset email (Resend)  
- Live email/SMS notify delivery proof  
- Web Push E2E  

### Production-authorization-dependent

- Sturgeon provision, Pages→sturgeon, prod DR, prod notify, retire shared `INGEST_SECRET` in prod  

### Hardware-dependent

- Hardware ATP, real RS485/DSE validation, fleet cred cutover on devices  

### Future

- Auth0 reactivation, retention prune jobs, deep plant-twin expansions  

---

## Implementation order

1. **Password recovery** (this sprint)  
2. Authenticated password change + profile basics  
3. Notification reliability polish + tests  
4. Ingestion security staging path (per-device emphasis, migration docs)  
5. Telemetry/ops reliability review (evidence-based only)  
6. Backup/DR documentation maturity  
7. Scalability audit + security review  
8. `phase-9-final.md` when criteria met  

## Dependencies

| Work | Depends on |
|---|---|
| Live reset email | Staging `AUTH_RESEND_KEY` or `RESEND_API_KEY` + from-address |
| Per-device ingest cutover | Firmware/collector support + staging fleet coordination |
| Prod anything | Written production authorization |

## Known blockers

- Physical hardware unavailable → ATP gated  
- Production unauthorized → no sturgeon  
- Live email unverified until Resend env present → use **dev outbox adapter** for code verification  

## Tracking docs

- `docs/status/phase-9-plan.md` (this file)  
- `docs/status/phase-9-progress.md`  
- `docs/status/phase-9-ingest-security.md`  
- `docs/status/phase-9-final.md` (end of phase)  
