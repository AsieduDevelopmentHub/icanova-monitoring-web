# Phase 8.1 operator checklist

Do **not** paste secrets into source or git. Staging is provisioned.

| Item | Value |
|---|---|
| Staging Convex | `dapper-roadrunner-247` |
| Cloud / site | `https://dapper-roadrunner-247.convex.cloud` / `.convex.site` |
| Auth0 tenant | `dev-notfczud6xx8hhxf.us.auth0.com` |
| API audience | `icanova` |
| Local env | `.env.staging.local` |
| SPA | `pnpm exec vite --mode staging --host 127.0.0.1 --port 5173` |
| Dev / prod | kangaroo-10 / tremendous-sturgeon-449 — do not overwrite |

---

## Done

- [x] Staging Convex + deploy  
- [x] Distinct `INGEST_SECRET` + lab notify  
- [x] Auth0 `AUTH_JWT_*` on staging (`icanova`)  
- [x] `VITE_OIDC_*` in `.env.staging.local`  
- [x] Auth0 callback / origin allowlist  
- [x] SPA authorized for API `icanova`  
- [x] Device-cred HTTP matrix PASSED  
- [x] Closure notes written  

---

## Remaining

| Step | Where | Action | Verify |
|---|---|---|---|
| Login → `/me` | Browser + Auth0 | Sign in at `/auth/login`; confirm access token `aud=icanova` | `GET {site}/me` → 200 |
| Org membership | Staging Convex | Seed membership for Auth0 `sub` | Authenticated queries work |
| E2E | Local | `E2E_OIDC=1 pnpm test:e2e` | Authenticated specs run |
| Restore drill | Convex | Backup staging → restore to **empty** recovery only | Fill RPO/RTO in backup doc |

Full notes: `docs/phase8-1-closure.md`
