# Phase 10 — Workstream A: password-reset email proof

**Date:** 2026-10-31  
**Staging Convex:** `dapper-roadrunner-247`  
**Live inbox delivery:** **SEND PATH VERIFIED** (2026-10-31) — `SITE_URL` was missing (root cause); after set, `auth.signIn` reset returns OK and Resend canary OK. OTP completion still operator-confirmed.

**Setup guide:** `docs/guide/password-reset-email-setup.md`  
**Helper:** `scripts/staging-password-reset-setup.mjs`

---

## Implementation audit

| Step | Status | Evidence |
|---|---|---|
| Request recovery (`flow=reset`) | COMPLETE | `Password({ reset: PasswordResetEmail })` in `convex/auth.ts` |
| OTP generated | COMPLETE | 8-digit OTP via `@oslojs/crypto` in `passwordResetEmail.ts` |
| Email send path | COMPLETE | Resend API when `AUTH_RESEND_KEY` ∥ `RESEND_API_KEY` present |
| Staging provider env | VERIFIED | `RESEND_API_KEY`, `RESEND_FROM`, `AUTH_EMAIL_FROM` on roadrunner (`sikapa.auralenx.com`) |
| `AUTH_PASSWORD_RESET_DEV` | Unset (good) | Live Resend path active |
| UI anti-enumeration | VERIFIED | Hosted E2E + setup script |
| `SITE_URL` on roadrunner | **FIXED** | Was missing → `Uncaught Error: Missing environment variable SITE_URL` (UI hid it) |
| Resend canary (same key/from/mailbox) | VERIFIED | `diagnose-password-reset-email.mjs` → `canary=OK` |
| Reset action after SITE_URL | VERIFIED | `reset_action=OK {"tokens":null}` |
| Inbox receipt + OTP complete | PENDING OPERATOR | Check Gmail for canary + “Reset your iCanOva password” |
| Old password rejected / new works | PENDING | After `RESET_OTP` + `RESET_NEW_PASSWORD` re-run |

## Closure criteria for VERIFIED

1. Operator confirms inbox receipt (do not paste OTP into chat).  
2. `RESET_OTP=… RESET_NEW_PASSWORD='…' node scripts/staging-password-reset-setup.mjs` prints `reset_complete=VERIFIED`.  
3. Convex logs show no raw OTP.  

Until step 2: **NOT VERIFIED** (delivery path configured; mailbox proof outstanding).
