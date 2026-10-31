# Phase 8.1 — Final closure & implementation notes

**Date:** 2026-10-31  
**Decision:** **PHASE 8.1 PARTIALLY COMPLETED — OPERATOR ACTION REQUIRED**  
Software + Auth0 staging integration **accepted with evidence**. Isolated **backup/restore drill** remains **BLOCKED — EXPLICIT OPERATOR AUTHORIZATION REQUIRED**.  
**Production:** not deployed.  
**Development:** `effervescent-kangaroo-10` preserved.

---

## Gate summary

| Gate | Status | Evidence |
|---|---|---|
| Staging Convex | VERIFIED | `dapper-roadrunner-247` |
| Auth0 `aud=icanova` → `/me` + orgs | VERIFIED | `verify-auth0-staging.mjs` |
| Cross-org denial | VERIFIED | Staging foreign-org probe |
| Authenticated Playwright | VERIFIED | `E2E_OIDC=1` 13 passed (prior close-out; re-run when token present) |
| Ops ACL | VERIFIED | Local + staging surface |
| Device-cred HTTP matrix | VERIFIED | `staging-device-cred-http.mjs` |
| Shared `INGEST_SECRET` retained | VERIFIED | Matrix |
| Unit/build regression | VERIFIED | 155 tests; `pnpm build` |
| Restore drill | **BLOCKED** | `node scripts/restore-drill-check.mjs` |

---

## Restore boundary

```bash
node scripts/restore-drill-check.mjs
```

Never restore over kangaroo, roadrunner, or sturgeon. Empty recovery only. See `docs/backup-restore-verification.md`.

Master programme: `docs/phase8-master-status.md`.
