# Phase 8.1 staging acceptance evidence

**Date:** 2026-10-31  
**Decision:** **PHASE 8.1 COMPLETED**  
(Auth0 + software gates verified; isolated restore drill verified)  
**Closure notes:** `docs/phase8-1-closure.md`

| Criterion | Status | Evidence |
|---|---|---|
| A Staging Convex | VERIFIED | `dapper-roadrunner-247` |
| B FE/BE staging | VERIFIED | `vite --mode staging` + Auth0 session / E2E |
| C Real OIDC login | VERIFIED | Auth0 Universal Login → access token `aud=icanova` |
| D Convex JWT `/me` | VERIFIED | `verify-auth0-staging.mjs` |
| E Authenticated E2E | VERIFIED | 13/13 Playwright passed (`E2E_OIDC=1`) |
| F Tenant isolation | VERIFIED | Staging foreign-org denial + local tenant tests |
| G Device credentials | VERIFIED | HTTP matrix PASSED |
| H Shared INGEST_SECRET | VERIFIED | Matrix shared-secret-ok |
| I Restore drill | **VERIFIED** | Empty recovery `vivid-mosquito-28`; §6 in `backup-restore-verification.md` |
| J Regression | VERIFIED | 155 unit + build |
| K Docs | VERIFIED | closure + this file |

**ACCEPTED** for Phase 8.1 staging activation scope. Production launch remains separately gated (8.5).
