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

## Kill-switch

| Convex env | Effect |
|---|---|
| unset / `1` / `true` | Public signup **enabled** (default) |
| `0` / `false` / `off` / `no` | Public signup **disabled** (server + SPA hide Sign up) |

```bash
# Invite-only staging example
npx convex env set AUTH_SIGNUP_ENABLED 0 --deployment staging

# Re-enable
npx convex env set AUTH_SIGNUP_ENABLED 1 --deployment staging
```

UI reads `api.authPublic.signupEnabled`. A future developer portal can set the same env (or later a DB flag wired to the same query).

**Do not** set on `sturgeon` without production authorization.
