# Phase 10 — Workstream A: password-reset email proof

**Date:** 2026-10-31  
**Staging Convex:** `dapper-roadrunner-247`  
**Live inbox delivery:** **VERIFIED** (2026-10-31) — operator confirmed receipt after `SITE_URL` fix. Optional: complete OTP → new password via `RESET_OTP` / `RESET_NEW_PASSWORD`.

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
| Inbox receipt | **VERIFIED** | Operator confirmed 2026-10-31 |
| OTP → new password login | OPTIONAL | `RESET_OTP=… RESET_NEW_PASSWORD='…' pnpm staging:password-reset` |

## Closure criteria

| Criterion | Status |
|---|---|
| Inbox receives reset email | **VERIFIED** (operator) |
| OTP sets new password + login | Optional follow-up (`pnpm staging:password-reset` with `RESET_OTP` / `RESET_NEW_PASSWORD`) |
| Convex logs show no raw OTP | Code path does not log token |

**Delivery:** VERIFIED. Full credential-rotation E2E remains optional.
