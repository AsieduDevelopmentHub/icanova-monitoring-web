# Phase 8.1 — Final closure & implementation notes

**Date:** 2026-10-31  
**Decision:** **PHASE 8.1 PARTIALLY COMPLETED — OPERATOR ACTION REQUIRED**  
Software + Auth0 staging integration **accepted with evidence**. Isolated **backup/restore drill** remains **BLOCKED** (no empty recovery deployment / no restore authorization).  
**Production:** not deployed. `tremendous-sturgeon-449` untouched.  
**Development:** `effervescent-kangaroo-10` preserved.

---

## 1. Gate summary

| Gate | Status | Evidence |
|---|---|---|
| Staging Convex `dapper-roadrunner-247` | **VERIFIED** | Deploy + env |
| Auth0 access token `aud=icanova` | **VERIFIED** | Claims + JWKS |
| Convex `/me` with Auth0 access token | **VERIFIED** | HTTP 200; `sub` match |
| Org membership + authenticated queries | **VERIFIED** | `users.ensure`, `organizations.mine`, `sites.list` |
| Cross-org denial (staging) | **VERIFIED** | Foreign lab org id refused |
| Authenticated Playwright | **VERIFIED** | `E2E_OIDC=1` → **13 passed, 0 failed, 0 skipped** |
| Ops section ACL | **VERIFIED** | `observability.convex.test.ts` (+ staging ops page load) |
| Device credential HTTP matrix | **VERIFIED** | `staging-device-cred-http.mjs` PASSED |
| Shared `INGEST_SECRET` retained | **VERIFIED** | Shared path 204 in matrix |
| Unit regression | **VERIFIED** | `pnpm test` 155 passed |
| `pnpm build` | **VERIFIED** | passed |
| Backup / restore drill | **BLOCKED** | Needs empty recovery + explicit authorize |

---

## 2. Auth0 → Convex (implementation notes)

| Item | Value |
|---|---|
| Issuer | `https://dev-notfczud6xx8hhxf.us.auth0.com/` |
| JWKS | `…/.well-known/jwks.json` |
| Audience | `icanova` (intentional; matches Express `jwtCheck`) |
| SPA client | Public PKCE only (`VITE_OIDC_*` in `.env.staging.local`) |
| Convex bearer | **Access token** only (`selectConvexBearer`) — not `id_token` |
| Token file for automation | `.jwt/staging/auth0.access.token` (gitignored) |
| Verify script | `node scripts/verify-auth0-staging.mjs` |

Do not log or commit access tokens.

---

## 3. Commands that produced evidence (2026-10-31)

```bash
node scripts/verify-auth0-staging.mjs          # verify=PASSED
node scripts/staging-device-cred-http.mjs      # matrix=PASSED
pnpm test                                      # 155 passed
pnpm exec vite build --mode staging
E2E_OIDC=1 E2E_BASE_URL=http://127.0.0.1:4173 pnpm test:e2e   # 13 passed
pnpm build                                     # passed
```

---

## 4. Remaining operator action (restore)

See `docs/backup-restore-verification.md`.  
Never restore over kangaroo, `dapper-roadrunner-247`, or production.

---

## 5. Phase 8.2

Preparation document: `docs/phase8-2-production-acceptance.md`  
**No production deployment in Phase 8.1.**
