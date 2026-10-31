# Production launch checklist

**Date:** 2026-10-31  
**Rule:** Passing a row here is not launch authorization. Final go-live requires **written approval**.

| # | Gate | Status |
|---|---|---|
| 1 | Staging restore drill | **VERIFIED** (`vivid-mosquito-28`) |
| 2 | Cloudflare Pages host live | **VERIFIED** (`https://icanova.pages.dev`) |
| 3 | Dedicated production Auth0 tenant | **EXCEPTION ACCEPTED (temporary)** — shared staging tenant; see `docs/status/phase-8.5d-shared-auth0-acceptance.md` |
| 3b | Separate production Auth0 SPA (`iCanOva Production`) | **OPEN** — Client ID not yet created/verified; staging SPA must stay unchanged |
| 4 | Pages OIDC public env complete | **PARTIAL** — issuer/audience/callback set; Client ID still staging SPA |
| 5 | Pages `VITE_CONVEX_URL` = production sturgeon | **OPEN** — still roadrunner |
| 6 | Production Convex `AUTH_JWT_*` + `INGEST_SECRET` | **OPEN** — env empty |
| 7 | Production Convex functions deployed | **OPEN** — `/me` → 404 |
| 8 | Login → ensure → org membership on **production** | **OPEN** |
| 9 | Production ingest auth smoke (synthetic, no fake fleet narrative) | **OPEN** |
| 10 | Notify providers + send authorization | **OPEN** — leave disabled |
| 11 | Device / fleet readiness | **OPEN** / PLAN ONLY for creds |
| 12 | Hardware ATP | **BLOCKED — PHYSICAL HARDWARE REQUIRED** |
| 13 | Written production deployment authorization | **REQUIRED / MISSING** |

**Current programme label:** `NOT READY` / software **READY FOR OPERATOR REVIEW**  
**Must remain:** `PRODUCTION DEPLOYMENT NOT AUTHORIZED` until #13.
