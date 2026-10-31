# Phase 8.1 operator checklist

Execute manually. Do **not** paste secrets into source files or git commits.  
Placeholders use `YOUR_*`. Staging Convex deployment is already provisioned.

| Item | Value |
|---|---|
| Staging Convex | `dapper-roadrunner-247` (reference `staging`) |
| Staging cloud | `https://dapper-roadrunner-247.convex.cloud` |
| Staging site | `https://dapper-roadrunner-247.convex.site` |
| Dashboard | https://dashboard.convex.dev/t/asiedudevelopmenthub/dse/dapper-roadrunner-247 |
| Local staging env | `.env.staging.local` (gitignored) |
| Lab JWT mint | `python scripts/issue-operator-token.py --staging` |
| Development (do not overwrite) | `effervescent-kangaroo-10` |
| Production (do not touch) | `tremendous-sturgeon-449` |
| Vercel | **Not configured in this repo** |

---

## A. Staging Convex (already done — re-verify only)

| Step | Platform | Action | Value / source | Configure where | Verify |
|---|---|---|---|---|---|
| A1 | Convex CLI | List env | — | `pnpm exec convex env list --deployment staging` | Names include `AUTH_*`, `INGEST_SECRET`, `TEST_NOTIFY_*`, `RESEND_*` |
| A2 | Local | Mint lab JWT | RSA under `.jwt/staging/` | `python scripts/issue-operator-token.py --staging` | Prints `issuer=https://dapper-roadrunner-247.convex.site` |
| A3 | HTTP | JWKS | Public keys only | `GET {site}/.well-known/jwks.json` | `kid=dse-staging-1` |
| A4 | HTTP | `/me` | Bearer = staging session token | `GET {site}/me` | `200` + `subject=operator` |
| A5 | CLI | Redeploy staging only | `.env.staging.local` deploy key | `pnpm exec convex deploy --env-file .env.staging.local --yes` | Dashboard shows staging push — **never** kangaroo |

**Security:** Private PEM stays in `.jwt/staging/`. Never `VITE_*`. Never commit.

---

## B. Real OIDC IdP (BLOCKED until operator supplies)

| Step | Platform | Action | Value / source | Configure where | Verify |
|---|---|---|---|---|---|
| B1 | IdP console (Auth0/etc.) | Create SPA + API | API identifier `dse-gateway` | IdP tenant | API exists |
| B2 | IdP | Issue RS256 access tokens | `aud=dse-gateway`, issuer https | IdP API settings | Decode JWT: `iss`/`aud`/`exp` |
| B3 | Convex staging | Point auth at IdP | `AUTH_JWT_ISSUER=https://YOUR_TENANT/` `AUTH_JWKS_URL=https://YOUR_TENANT/.../jwks.json` `AUTH_JWT_AUDIENCE=dse-gateway` | `convex env set … --deployment staging --force` then redeploy | Lab JWKS can remain until cutover; do not invent issuer |
| B4 | Frontend build | Public OIDC | `VITE_OIDC_ISSUER`, `VITE_OIDC_CLIENT_ID`, `VITE_OIDC_AUDIENCE=dse-gateway`, `VITE_OIDC_REDIRECT_URI=http://127.0.0.1:5173/auth/callback` (or staging host) | Build env / `.env.staging.local` | `readOidcConfig` non-null |
| B5 | Browser | Login | Synthetic user | `/auth/login` → IdP → `/auth/callback` | Access token stored; `/me` 200 with IdP `sub` |
| B6 | Convex | Org membership | Operator seeds membership for IdP `sub` | Staging org | Authenticated query returns data; cross-org denied |

**Security:** No client secret in browser. `id_token` is **not** the Convex bearer. See `docs/identity-provider-setup.md`.

**Missing today:** IdP tenant credentials / client id / real issuer URL.

---

## C. Staging SPA host (optional; Vercel absent)

| Step | Platform | Action | Value | Where | Verify |
|---|---|---|---|---|---|
| C1 | Operator chooses host | Create staging project | Preview or static host | Vercel/Netlify/etc. if used | URL ≠ production |
| C2 | Host env | Public only | `VITE_CONVEX_URL`, `VITE_OIDC_*`, optional Sentry/GA | Host build env | No `INGEST_SECRET`, no Resend, no PEM |
| C3 | Local alternative | Preview against staging Convex | Build with staging `VITE_CONVEX_URL` | `pnpm build && pnpm preview` | App talks to roadrunner only |

**Vercel variables (when/if created):** only `VITE_*` public values.  
**Convex secrets:** `AUTH_*` (server), `INGEST_SECRET`, `RESEND_*`, `ARKESEL_*`, `TEST_NOTIFY_*` — never in Vercel/`VITE_*`.

---

## D. Device credential HTTP (lab — runnable now)

| Step | Platform | Action | Verify |
|---|---|---|---|
| D1 | Local | `python scripts/issue-operator-token.py --staging` | Token written |
| D2 | Local | `node scripts/staging-device-cred-http.mjs` | `matrix=PASSED` |

Covers: shared secret, missing/invalid bearer, valid/invalid/wrong-device cred, rotation overlap, revoke + shared fallback, inactive → 403, hashes hidden from `devices.detail`.

**Security:** Synthetic identities only (`a1b2c3d4e5f6` / `b2c3d4e5f6a7`). Do not migrate real fleet. Do not change firmware.

---

## E. Authenticated Playwright

| Step | Platform | Action | Value | Verify |
|---|---|---|---|---|
| E1 | Local | `.env.e2e` from `.env.e2e.example` | `E2E_OIDC=1`, staging `E2E_BASE_URL` | File gitignored |
| E2 | Build | Staging `VITE_CONVEX_URL` + real `VITE_OIDC_*` | — | Build succeeds |
| E3 | Local | `E2E_OIDC=1 pnpm test:e2e` | — | Authenticated specs run (not skipped) |

**Blocked** without step B. Guide: `docs/browser-e2e.md`.

---

## F. Backup / restore drill (destructive — explicit authorization required)

| Step | Platform | Action | Value | Verify |
|---|---|---|---|---|
| F1 | Convex dashboard → staging | **Backup Now** | Include-storage decision; record UTC | ZIP downloaded to encrypted store |
| F2 | Offline | Path/manifest helpers | `backupArtifact.ts` | Required tables present; no secret paths |
| F3 | Convex | Create **empty** recovery deployment | New name ≠ kangaroo ≠ staging ≠ prod | Empty project URL |
| F4 | Convex | Restore ZIP **into recovery only** | Operator approval | Restore completes |
| F5 | App / CLI | Query recovery | Orgs/sites/devices/telemetry/alarms | Data present; tenant isolation holds |
| F6 | Record | RPO/RTO | Fill `docs/backup-restore-verification.md` | Metrics written |

**Never** restore over `effervescent-kangaroo-10`, `dapper-roadrunner-247` (if still in use), or `tremendous-sturgeon-449` without written approval.

---

## G. Do not

- Modify production or flash COM8 / hardware.
- Disable `INGEST_SECRET` or invent IdP URLs.
- Commit `.env*.local`, `.jwt/`, or `.env.e2e`.
- Claim Phase 8.1 fully accepted until OIDC browser + restore drill have real evidence.
