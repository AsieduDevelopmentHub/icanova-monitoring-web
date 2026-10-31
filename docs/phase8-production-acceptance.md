# Phase 8.0 production acceptance matrix

**Date:** 2026-10-30  
**Deployment under review:** development `effervescent-kangaroo-10`  
**Production approval:** **Not granted.** Mandatory external gates remain unverified.

**Phase 8.1:** **COMPLETED** — Auth0/`icanova` + E2E + device-cred + isolated restore **VERIFIED**. See `docs/phase8-1-closure.md`. Phase 8.2 prep: `docs/phase8-2-production-acceptance.md` (no prod deploy).

Statuses: COMPLETE | VERIFIED | IMPLEMENTED — NOT VERIFIED | OPERATOR ACTION REQUIRED | BLOCKED | DEFERRED | NOT APPLICABLE

---

## Gate table

| Gate | Requirement | Status | Evidence | Environment | Remaining action |
|---|---|---|---|---|---|
| 8A Staging | Isolated staging Convex + frontend | VERIFIED (backend) / FE local staging | `dapper-roadrunner-247` + `vite --mode staging` | staging | Hosted SPA optional |
| 8B IdP backend | Convex customJwt RS256 | COMPLETE (staging Auth0) | `AUTH_*` → Auth0 / `icanova` | staging | — |
| 8B OIDC SPA | PKCE + Auth0 Universal Login | VERIFIED (staging) | access token `aud=icanova` → `/me` | staging | — |
| 8B Real login E2E | Browser IdP login | VERIFIED | Playwright 13 passed (`E2E_OIDC=1`) | staging preview | — |
| 8C Playwright infra | Browser E2E runner | COMPLETE | `playwright.config.ts`, `e2e/` | local preview | — |
| 8C Unsigned smoke | Dashboard/Ops notices | VERIFIED | `docs/browser-e2e-report.md` | local | Re-run after UI changes |
| 8C Auth browser E2E | Signed-in flows | BLOCKED | same | — | Staging accounts |
| 8D Backup artifact helpers | Path/manifest | COMPLETE | `backupArtifact.ts` | unit | — |
| 8D Restore drill | Isolated restore | VERIFIED | `docs/backup-restore-verification.md` §6 (`vivid-mosquito-28`) | recovery | Quarantine; prod DR separate |
| 8E Dual-auth foundation | Shared secret + device hash | VERIFIED (staging HTTP) | `scripts/staging-device-cred-http.mjs` | staging | Fleet migration later; firmware unchanged |
| 8E Remove shared secret | Cutover | DEFERRED | `docs/device-credential-migration.md` | — | After proven migration |
| 8F Prod env inventory | Secrets separation | COMPLETE | `docs/production-environment-readiness.md` | docs | — |
| 8F Prod deploy | Live production | BLOCKED | — | — | All mandatory gates |
| 8G Hardware ATP | Procedure | COMPLETE | `docs/hardware-acceptance-test-plan.md` | docs | Physical test |
| 8G Hardware VERIFIED | ESP32/RS485/DSE | BLOCKED | — | — | Bench/site |

Responsible party for OPERATOR/BLOCKED rows: deployment operator / hardware technician — not the software agent.

---

## Software verification (this phase)

| Check | Result |
|---|---|
| Vitest | Run in Phase 8.0 verification |
| TypeScript | Run in Phase 8.0 verification |
| `pnpm build` | Run in Phase 8.0 verification |
| Playwright unsigned | Run in Phase 8.0 verification |
| `convex dev --once` | development only |

Production approval requires all mandatory gates **VERIFIED** or explicitly accepted in writing by the authorized operator.
