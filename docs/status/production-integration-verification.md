# Production integration verification (Phase 8.5C)

**Date:** 2026-10-31  
**Status:** **NOT PASSED** for production end-to-end — SPA still on staging Convex/Auth0  
**Marking:** Evidence-only; no mocked tests claimed as production proof

---

## Frontend (Cloudflare Pages)

| Check | Result |
|---|---|
| Host `https://icanova.pages.dev` | Live |
| Sign-in CTA present (8.2G+) | Yes on current builds |
| OIDC public env complete | Yes (issuer, client, audience, redirect, logout) |
| Targets production Convex | **No** — `VITE_CONVEX_URL` = roadrunner |
| Secrets in `dist/` | Local `check-frontend-secrets --dist` **PASS** (this workspace build) |

---

## Auth0

| Check | Result |
|---|---|
| Live issuer | Staging Auth0 `dev-notfczud6xx8hhxf.us.auth0.com` |
| Audience | `icanova` |
| Callback for Pages | Configured in SPA env |
| Dedicated production tenant | **Not verified** |
| Access token vs id_token | Code enforces access token (`selectConvexBearer`) |

---

## Convex authentication

| Check | Result |
|---|---|
| Production deployment | `tremendous-sturgeon-449` |
| Production `AUTH_*` | **Empty** |
| Production `/me` unauthenticated | **404** (functions likely undeployed) |
| Staging `/me` unauthenticated | **401** (expected) |
| `users.ensure` after login | Implemented in SPA (needs Pages redeploy if not yet shipped) |

---

## Ingestion

| Check | Result |
|---|---|
| Production ingest URL | `https://tremendous-sturgeon-449.convex.site/ncu/ingest` (intended) |
| Production `INGEST_SECRET` | **Missing** |
| Synthetic prod ingest | **Not run** (would require secret + functions; no fake fleet data) |
| Automated ingest security tests | Covered in unit/convex-test suite (not live prod) |

---

## Notifications

| Check | Result |
|---|---|
| Production Resend/Arkesel | **Absent** |
| Real email/SMS sent | **No** |
| `TEST_NOTIFY_*` on production | Must remain absent |

---

## Tenant isolation

Automated convex-test / unit coverage exists for cross-org denial. **No production-data isolation drill** on sturgeon (empty / undeployed).
