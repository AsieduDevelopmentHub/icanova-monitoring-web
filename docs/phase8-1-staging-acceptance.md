# Phase 8.1 staging acceptance evidence

**Date:** 2026-10-31  
**Decision:** **PHASE 8.1 PARTIALLY COMPLETED — OPERATOR ACTION REQUIRED** (staging Convex + lab JWT + device-cred HTTP verified; real OIDC browser E2E + restore drill still outstanding)  
**Development deployment:** `effervescent-kangaroo-10`  
**Staging deployment:** `dapper-roadrunner-247` (reference `staging`)  
**Default production (untouched):** `tremendous-sturgeon-449`  
**Operator checklist:** `docs/phase8-1-operator-checklist.md`

Statuses: VERIFIED | IMPLEMENTED NOT VERIFIED | BLOCKED | FAILED | NOT APPLICABLE

Evidence rule: mocked / code-inspection alone never yields VERIFIED for external integrations.

---

## Repository audit (Phase 8.0 → 8.1)

| Area | Status | Notes |
|---|---|---|
| Staging Convex | VERIFIED | `dapper-roadrunner-247` deployed |
| Docs vs config | VERIFIED | Staging setup / backup / browser-e2e / checklist corrected 2026-10-31 |
| OIDC SPA PKCE | IMPLEMENTED NOT VERIFIED | Bearer selection hardened; no real IdP |
| Convex customJwt | VERIFIED (lab) | Staging self-hosted JWKS + `/me` 200 |
| Dual-auth ingest HTTP | VERIFIED (staging) | `scripts/staging-device-cred-http.mjs` matrix PASSED |
| Ops ACL | VERIFIED (local) | Section permissions; manage.devices alone denied |
| Playwright unsigned | VERIFIED | Local preview |
| Authenticated Playwright | BLOCKED | Needs `E2E_OIDC=1` + real IdP |
| Backup restore drill | BLOCKED | Backup source can be staging; recovery deploy pending |
| Vercel | NOT APPLICABLE | No Vercel project in repo |

### Security findings addressed

- Ops overview no longer returns full payload to any of diagnostics|audit|manage.devices.
- Sections: diagnostics → fleet/ingest/jobs; alarms → view.alarms; notifications → configure.notifications; audit → view.audit.
- OIDC: access token must match application audience before Convex bearer set.

### Remaining risks

- Shared `INGEST_SECRET` fleet-wide until migration.
- Lab self-hosted JWKS is not a commercial IdP; SPA OIDC + browser E2E still unproven.

---

## Acceptance criteria

| Criterion | Status | Evidence | Environment | Remaining action |
|---|---|---|---|---|
| A Isolated staging Convex | VERIFIED | `dapper-roadrunner-247` created + deploy | Convex staging | — |
| B Staging FE/BE connected | IMPLEMENTED NOT VERIFIED | `.env.staging.local` URLs; backend deployed | staging | Build SPA with staging `VITE_CONVEX_URL` |
| C Real OIDC login | BLOCKED | Auth0 callback URL mismatch | Auth0 app settings | Allowlist `http://127.0.0.1:5173/auth/callback` (+ logout/origin); then login |
| D Convex accepts Auth0 JWT config | VERIFIED (config) | Staging `AUTH_*` = Auth0 issuer/JWKS/`icanova`; lab token now 401 | staging | Complete login → `/me` with Auth0 access token |
| E Authenticated browser E2E | BLOCKED | `docs/browser-e2e.md` | — | Callback allowlist + `E2E_OIDC=1` |
| F Cross-tenant / section ACL | VERIFIED | `observability.convex.test.ts` section tests | local convex-test | Browser re-check after IdP |
| G Per-device credentials | VERIFIED | Staging HTTP matrix PASSED | staging HTTP | Keep shared secret; no fleet migrate |
| H Shared INGEST_SECRET retained | VERIFIED | dual-auth + staging shared-secret-ok 204 | staging | Keep until approved cutover |
| I Isolated restore drill | BLOCKED | `docs/backup-restore-verification.md` | — | Empty recovery deploy + restore |
| J Regression suite | VERIFIED | Phase 8.1 commands (prior) | local + kangaroo | Re-run if code changes |
| K Docs / matrix / checklist | VERIFIED | this file + operator checklist | docs | — |

---

## Staging device credential HTTP matrix (2026-10-31)

Command: `node scripts/staging-device-cred-http.mjs` → **matrix=PASSED**

| Case | Result |
|---|---|
| detail hides hashes / plaintext | PASS |
| shared `INGEST_SECRET` heartbeat | PASS 204 |
| invalid bearer | PASS 401 |
| missing bearer | PASS 401 |
| valid device credential | PASS 204 |
| invalid device credential | PASS 401 |
| wrong-device credential | PASS 401 |
| rotation overlap (prev + current) | PASS 204/204 |
| revoked device cred; shared still works | PASS 401/204 |
| inactive device | PASS 403 |

Synthetic identities only: `a1b2c3d4e5f6`, `b2c3d4e5f6a7`. Firmware/NCU1 unchanged.

---

## Commands (Phase 8.1 verification)

| Command | Result | Environment |
|---|---|---|
| `pnpm test` | **155 passed** (prior Phase 8.1) | local Vitest / convex-test |
| `pnpm build` | **passed** (prior) | local |
| `pnpm test:e2e` | **4 passed, auth skipped** without `E2E_OIDC` | local preview |
| `pnpm exec convex deploy --env-file .env.staging.local --yes` | **ready** | staging only |
| `python scripts/issue-operator-token.py --staging` + `/me` | **200** | staging |
| `node scripts/staging-device-cred-http.mjs` | **PASSED** | staging HTTP |

---

## Final report summary (Phase 8.1 continuation)

1. **Documentation corrections:** Staging setup, backup restore, browser-e2e guide/report, identity mapping, device-cred migration, deployment runbook, operator checklist — aligned to live `dapper-roadrunner-247` (gpt.md’s “staging not created” is obsolete).
2. **Staging readiness:** Backend **VERIFIED**. SPA host/Vercel **NOT APPLICABLE / OPERATOR**. Lab auth **VERIFIED**; real OIDC **BLOCKED**.
3. **Exact operator actions:** `docs/phase8-1-operator-checklist.md`.
4. **OIDC→Convex readiness:** Mapping documented; SPA obtains Convex-valid token **only** when IdP API access token matches `AUTH_*`. Lab mint proves Convex side. Real IdP **BLOCKED**.
5. **Device credential staging:** **VERIFIED** via HTTP matrix; shared secret retained.
6. **Authenticated E2E:** Scaffold + guide ready; execution **BLOCKED** on IdP.
7. **Backup/restore:** Runbook exact; drill **BLOCKED** pending empty recovery + authorization.
8. **Remaining blockers:** Real IdP + `VITE_OIDC_*`; hosted/preview SPA build against staging; `E2E_OIDC=1` run; isolated restore drill.

**Phase 8.1 is not fully accepted.**
