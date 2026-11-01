# Password reset email setup (Convex Auth + Resend)

**Active path:** Convex Auth `Password({ reset })` → `convex/passwordResetEmail.ts` → Resend  
**Staging deployment:** `dapper-roadrunner-247`  
**Related:** username login + signup flag — `docs/guide/auth-username-and-signup.md`  
**Do not** configure production (`sturgeon`) without written authorization.

---

## Required Convex env (staging)

| Variable | Required | Notes |
|---|---|---|
| `SITE_URL` | **Yes** | SPA origin (staging: `https://icanova.pages.dev`). Without it, reset throws before Resend runs. |
| `RESEND_API_KEY` | Yes (or `AUTH_RESEND_KEY`) | Private; never `VITE_*` |
| `RESEND_FROM` or `AUTH_EMAIL_FROM` | Yes | Must use a **verified** Resend domain |
| `JWT_PRIVATE_KEY` / `JWKS` | Yes | Already required for Convex Auth |
| `AUTH_PASSWORD_RESET_DEV` | **Unset** for live mail | `1` skips Resend (dev only) |

Prefer branding:

```bash
npx convex env set AUTH_EMAIL_FROM "iCanOva Monitoring <you@your-verified-domain>" --deployment staging
```

`AUTH_RESEND_KEY` is optional; if unset, `RESEND_API_KEY` is reused.

---

## Operator verification

```bash
# 1) Confirm staging SPA + roadrunner
pnpm build:staging

# 2) Trigger reset to TEST_NOTIFY_EMAIL (from .env.staging.local)
node scripts/staging-password-reset-setup.mjs

# 3) Open the mailbox → copy the 8-digit code (do not paste codes into chat logs)

# 4) Complete reset
# RESET_OTP=........ RESET_NEW_PASSWORD='YourNew1Pass' node scripts/staging-password-reset-setup.mjs
```

UI path: `https://icanova.pages.dev/auth/reset`

**Localhost vs staging:** `pnpm dev` uses `.env.local` → **kangaroo**. Staging mail / Pages use **roadrunner**. An OTP emailed from staging will **not** verify on localhost (and vice versa). Complete reset on `https://icanova.pages.dev/auth/reset`, or run `vite --mode staging` so local talks to roadrunner.

Anti-enumeration: the UI always says “If an account exists…” — **no email is sent** if the address has no Password account. Create the account first (script does this when possible).

New password rules: **≥8 characters**, at least **one letter and one number**.

---

## Resend dashboard checks

1. Domain verified (not only `resend.dev` unless recipient is the Resend account owner).  
2. API key has send permission.  
3. From-address matches that domain.  
4. Logs show accepted sends; never log the OTP in Convex `console`.

---

## Production (later)

Generate a **new** Resend key / from-address for sturgeon. Never copy staging `RESEND_API_KEY`. See `docs/security/production-secret-inventory.md`.
