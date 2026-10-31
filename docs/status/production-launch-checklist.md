# Production launch checklist

**Date:** 2026-10-31  
**Rule:** Passing a row here is not launch authorization. Final go-live requires **written approval**.  
**Auth architecture:** Convex Auth Password (Auth0 FUTURE/INACTIVE).

| # | Gate | Status |
|---|---|---|
| 1 | Staging restore drill | **VERIFIED** (`vivid-mosquito-28`) |
| 2 | Cloudflare Pages host live | **VERIFIED** (`https://icanova.pages.dev`) |
| 3 | Active IdP = Convex Auth | **VERIFIED** on staging; Auth0 inactive |
| 3b | Production Auth0 SPA / tenant | **SUPERSEDED** — not required for Convex Auth cutover |
| 4 | Staging Pages Auth0-free bundle | **VERIFIED** (8.5G) |
| 5 | Pages `VITE_CONVEX_URL` = production sturgeon | **OPEN** — still roadrunner |
| 6 | Production Convex `JWT_PRIVATE_KEY` + `JWKS` + `INGEST_SECRET` | **OPEN** — env empty |
| 7 | Production Convex functions deployed | **OPEN** — HTTP 404 |
| 8 | Login → ensure → org membership on **production** | **OPEN** |
| 9 | Production ingest auth smoke | **OPEN** |
| 10 | Notify providers + send authorization | **OPEN** — leave disabled |
| 11 | Device / fleet readiness | **OPEN** / PLAN ONLY for per-device creds |
| 12 | Hardware ATP | **BLOCKED — PHYSICAL HARDWARE REQUIRED** |
| 13 | Written production deployment authorization | **REQUIRED / MISSING** |

**Phase 8 software:** COMPLETE WITH DOCUMENTED EXCEPTIONS (`docs/status/phase-8-final.md`)  
**Must remain:** `PRODUCTION DEPLOYMENT NOT AUTHORIZED` until #13.
