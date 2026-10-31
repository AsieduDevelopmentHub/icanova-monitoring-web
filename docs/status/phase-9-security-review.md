# Phase 9 — Security review

**Date:** 2026-10-31  
**Scope:** Non-production code paths touched in Phase 9 + standing Phase 8 exceptions  
**Production deploy:** NOT AUTHORIZED  

---

## Findings

| ID | Severity | Finding | Status |
|---|---|---|---|
| P9-1 | Medium (ops) | Live password-reset email delivery not mailbox-proven | OPEN — code path present; inbox NOT TESTED |
| P9-2 | Info | Shared `INGEST_SECRET` still valid alongside device hashes | Accepted exception; cutover gated |
| P9-3 | Low | SMS Arkesel may duplicate on uncertain retry | Documented in notify path |
| P9-4 | Info | Auth0 inactive; Convex Auth primary | By design after 8.5E–G |
| P9-5 | Pass | Reset UI anti-enumeration | Hosted E2E VERIFIED |
| P9-6 | Pass | Password change requires current secret; other sessions invalidated | Code review |
| P9-7 | Pass | No secrets in `VITE_*` / Pages bundle for JWT or ingest | Hosted bundle checks |
| P9-8 | Pass | Sturgeon remains empty | `convex env list --deployment production` |

## Controls added in Phase 9

- Password policy shared across sign-up / reset / change (≥8, letter+number)  
- Reset email adapter fails closed without Resend unless `AUTH_PASSWORD_RESET_DEV=1`  
- Change-password action uses `retrieveAccount` before `modifyAccountCredentials`  

## Residual risk

Account recovery depends on Resend deliverability and mailbox access control. Until inbox-proven, treat staging recovery as **code-complete / delivery unproven**.

## Non-goals verified untouched

- No production Convex mutations  
- No hardware flash / COM access from this workstream  
- No Auth0 reactivation  
