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
| Restore drill | Convex | **BLOCKED — EXPLICIT OPERATOR AUTHORIZATION REQUIRED** | See below |

Auth0 login → `/me`, org seed, and `E2E_OIDC=1` Playwright were verified in Phase 8.1 close-out.

### Restore drill — COMPLETED 2026-10-31

Evidence: `docs/backup-restore-verification.md` §6  
Recovery: `vivid-mosquito-28` (quarantined; no notify/fleet)  
Source: staging `dapper-roadrunner-247` (untouched)  

```bash
node scripts/restore-drill-check.mjs
```

Full notes: `docs/phase8-1-closure.md` · Master: `docs/phase8-master-status.md`
