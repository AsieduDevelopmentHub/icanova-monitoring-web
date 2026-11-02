# Platform admin bootstrap

Controlled provisioning: normal users **cannot** create organizations or self-signup by default. A platform operator seeds the first org and admin, then org admins manage members and site/gateway provision from the app.

**UI:** `/admin/platform` (Administration → Platform)

**Server:** [`convex/platformAdmin.ts`](../../convex/platformAdmin.ts), [`convex/authIdentity.ts`](../../convex/authIdentity.ts)

---

## Convex environment variables

Set these on the **Convex deployment** (not in `VITE_*` / `.env.local`).

| Variable | Required | Secret | Purpose |
|---|---|---|---|
| `PLATFORM_ADMIN_SECRET` | **Yes** for secret unlock | **Yes** | Shared secret; must match the value pasted on `/admin/platform` when the signed-in user is not on the email allowlist |
| `PLATFORM_ADMIN_EMAILS` | Optional | No | Comma-separated emails that may use platform admin **without** pasting the secret (after sign-in) |
| `AUTH_SIGNUP_ENABLED` | Recommended `0` / unset | No | Public Password signup; **default is off** when unset. Set `1` only if you intentionally reopen self-signup |

Generate a strong secret (example):

```bash
openssl rand -hex 32
```

### Staging example

```bash
# From the web repo root
pnpm exec convex env set PLATFORM_ADMIN_SECRET "<paste-generated-secret>" --deployment staging

# Optional: allowlisted operators (lowercase emails, comma-separated)
pnpm exec convex env set PLATFORM_ADMIN_EMAILS "ops@example.com,you@example.com" --deployment staging

# Keep public signup closed (default when unset; set explicitly for clarity)
pnpm exec convex env set AUTH_SIGNUP_ENABLED 0 --deployment staging
```

### Production

Use a **different** `PLATFORM_ADMIN_SECRET` than staging. Do not set production platform secrets without written authorization. Prefer a short allowlist in `PLATFORM_ADMIN_EMAILS` and rotate the secret after bootstrap.

```bash
pnpm exec convex env set PLATFORM_ADMIN_SECRET "<production-secret>" --deployment production
pnpm exec convex env set PLATFORM_ADMIN_EMAILS "ops@example.com" --deployment production
```

List without printing values in chat logs:

```bash
pnpm exec convex env list --deployment staging
```

---

## How authorization works

1. **Email allowlist** — if the signed-in user’s email is in `PLATFORM_ADMIN_EMAILS`, `/admin/platform` unlocks automatically.
2. **Secret unlock** — otherwise the page asks for `PLATFORM_ADMIN_SECRET`. The same value must be set in Convex env. Empty or mismatched secret → authorization failed.
3. Actions such as `platformAdmin.createOrganization` and `createUserWithMembership` call the same checks server-side.

Never put `PLATFORM_ADMIN_SECRET` in frontend env. The SPA only sends it to Convex when the operator pastes it into the platform page (or when using CLI/scripts that call actions with the secret).

---

## Bootstrap workflow

1. Set env vars on the deployment; deploy Convex functions if needed (`pnpm exec convex deploy` / your usual pipeline).
2. Open the SPA → **Administration → Platform** (`/admin/platform`).
3. Sign in as an allowlisted user **or** unlock with the secret.
4. **Create organization** (optional seed admin email/username/password). This seeds Admin / Sub-admin / Operator / Viewer roles and can attach the first Admin membership.
5. Close pending **access requests** as you invite people.
6. Org admins then use **Users** (`createMember`) and **Sites → Provision site** for day-to-day provisioning.

Access requests from the login “Request access” form land in `accessRequests` and appear on the platform page; they do **not** create accounts.

---

## Related

- Signup kill-switch: [auth-username-and-signup.md](./auth-username-and-signup.md)
- Full env list: [env-inventory.md](./env-inventory.md)
- Product intent: [../brand/gptbrand.md](../brand/gptbrand.md)
