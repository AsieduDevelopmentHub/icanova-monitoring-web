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

### Restore drill (do not skip authorization)

```bash
node scripts/restore-drill-check.mjs
# After downloading a staging backup ZIP path listing:
# node scripts/restore-drill-check.mjs --paths-file backups/staging-paths.txt
```

1. Written authorization.  
2. Backup `dapper-roadrunner-247` only as **source**.  
3. Create **empty** recovery deployment (not kangaroo / roadrunner / sturgeon).  
4. Restore into recovery only; reconstruct env from vault.  
5. Record RPO/RTO in `docs/backup-restore-verification.md`.  

Full notes: `docs/phase8-1-closure.md` · Master: `docs/phase8-master-status.md`
