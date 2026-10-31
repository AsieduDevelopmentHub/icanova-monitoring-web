# Phase 9 — Backup / DR maturity notes

**Date:** 2026-10-31  
**Canonical runbooks:**  
- `docs/guide/backup-and-disaster-recovery.md`  
- `docs/guide/backup-restore-verification.md`  

**Staging restore drill baseline:** `vivid-mosquito-28` VERIFIED (Phase 8)  
**Production DR:** NOT AUTHORIZED / NOT TESTED  

---

## Ordered restore (operator reminder)

1. Confirm target deployment is **not** production unless written authorization exists.  
2. Restore Convex export into an empty/lab deployment only.  
3. Re-apply deployment env that is **environment-local** (never copy roadrunner secrets to sturgeon):  
   - Convex Auth: `JWT_PRIVATE_KEY`, `JWKS`  
   - Ingest: `INGEST_SECRET` (new value for prod when authorized)  
   - Notify: `RESEND_*`, `ARKESEL_*`, VAPID (optional)  
4. Redeploy functions matching the schema of the backup.  
5. Verify Auth: Password sign-in against restored `auth*` tables + app `users` email rebind.  
6. Verify ingest dual-auth matrix on staging only.  
7. Verify notification prefs exist; do not send customer traffic from lab restores.  

## Phase 9 constraints

- Do not source production data for drills while sturgeon is empty/unauthorized.  
- Do not treat a successful mosquito drill as production DR readiness.  
- Document credential re-key separately from data restore.  
