# Username login and signup kill-switch

**Auth:** Convex Auth Password  
**Account credential id:** email (password reset unchanged)  
**Login alias:** `users.username` (optional for legacy rows)

---

## Sign-in

- Field: **Username or email** + password  
- SPA resolves username → email via `authPublic.resolveSignInEmail`, then calls Password `signIn`  
- Existing email-only accounts keep working  

## Sign-up (when enabled)

Requires **username** + **email** + **password**.

Username rules: `3–32` chars, `[a-z0-9._-]`, stored lowercase.

When signup is **disabled** (default), the login page offers **Request access** instead (writes `accessRequests`; no account is created). Platform operators fulfill requests via [platform-admin-bootstrap.md](./platform-admin-bootstrap.md).

## Kill-switch

| Convex env | Effect |
|---|---|
| unset / empty | Public signup **disabled** (controlled platform default) |
| `0` / `false` / `off` / `no` | Public signup **disabled** |
| `1` / `true` / `on` / `yes` | Public signup **enabled** |

```bash
# Invite-only / controlled (recommended staging + production)
npx convex env set AUTH_SIGNUP_ENABLED 0 --deployment staging

# Re-enable open registration (only if intentional)
npx convex env set AUTH_SIGNUP_ENABLED 1 --deployment staging
```

UI reads `api.authPublic.signupEnabled`.

**Do not** enable open signup on production without authorization. Organization create is also restricted to platform admin; see [platform-admin-bootstrap.md](./platform-admin-bootstrap.md).

**Do not** set on `sturgeon` without production authorization.
