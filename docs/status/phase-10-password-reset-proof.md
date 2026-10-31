# Phase 10 — Workstream A: password-reset email proof

**Date:** 2026-10-31  
**Staging Convex:** `dapper-roadrunner-247`  
**Live inbox delivery:** **NOT VERIFIED**  

---

## Implementation audit

| Step | Status | Evidence |
|---|---|---|
| Request recovery (`flow=reset`) | COMPLETE | `Password({ reset: PasswordResetEmail })` in `convex/auth.ts` |
| OTP generated | COMPLETE | 8-digit OTP via `@oslojs/crypto` in `passwordResetEmail.ts` |
| Email send path | COMPLETE | Resend API when `AUTH_RESEND_KEY` ∥ `RESEND_API_KEY` present |
| Staging provider env present | VERIFIED (names only) | `RESEND_API_KEY`, `RESEND_FROM` on roadrunner |
| UI anti-enumeration | VERIFIED | Hosted E2E `e2e/password-reset-staging.spec.ts` |
| Submit OTP + new password | COMPLETE (code) | `flow=reset-verification` + `newPassword` |
| Old password rejected / new works | NOT VERIFIED live | Needs mailbox OTP |
| Expired / reused / invalid OTP | Library-default (Convex Auth) | NOT separately instrumented in-repo |
| OTP not logged | VERIFIED (code review) | Dev adapter explicitly avoids logging token |
| Rate / abuse | Convex Auth rate limits | Present in `@convex-dev/auth` |

## Missing evidence for VERIFIED delivery

A controlled staging mailbox must receive the Resend message and complete reset. `TEST_NOTIFY_EMAIL` is configured on staging for notify tests, but this phase did **not** capture an inbox screenshot or OTP round-trip under operator observation.

Do **not** treat UI success (“If an account exists…”) as delivery proof.

## Closure criteria for VERIFIED

1. Operator-owned staging inbox receives iCanOva reset email.  
2. OTP works once; second use fails.  
3. New password signs in; old password fails.  
4. Logs (Convex dashboard) show no raw OTP.  

Until then: **NOT VERIFIED**.
