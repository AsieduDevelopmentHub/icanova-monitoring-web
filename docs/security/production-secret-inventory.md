# Production secret inventory (Phase 10)

**Date:** 2026-10-31  
**Rule:** Production secrets are independently generated. Never copy staging → production. Never put private values in `VITE_*`. Never commit real values. Placeholders only below.  
**Sturgeon today:** **0 env vars** (empty / NOT AUTHORIZED to set).

---

## Inventory

| Name | Purpose | Public? | Envs | Configured where | Generate | Rotate | Status |
|---|---|---|---|---|---|---|---|
| `JWT_PRIVATE_KEY` | Convex Auth RS256 signing | Private | staging ✓ / prod **missing** | Convex env | `@convex-dev/auth` key script | On compromise / IdP cutover | Implemented |
| `JWKS` | Public JWKS JSON for Auth | Semi-public | staging ✓ / prod **missing** | Convex env | Paired with private key | With private key | Implemented |
| `INGEST_SECRET` | Shared collector/firmware bearer | Private | staging ✓ / prod **missing** | Convex + device NVS | CSPRNG ≥32 chars | Per env; never share across envs | Implemented; fleet-wide exception |
| Device ingest plaintext | Per-device bearer | Private | optional staging | Delivered once; Convex stores **hash only** | CSPRNG ≥32 | `setIngestCredential` | Implemented |
| `RESEND_API_KEY` / `RESEND_FROM` | Notify + optional reset mail | Private / from addr | staging ✓ | Convex env | Resend dashboard | Provider rotate | Implemented optional |
| `AUTH_RESEND_KEY` / `AUTH_EMAIL_FROM` | Dedicated reset mail (prefers over RESEND_*) | Private | optional | Convex env | Resend | Provider rotate | Implemented optional |
| `AUTH_PASSWORD_RESET_DEV` | Allow reset without Resend | Private flag | **dev/staging only** | Convex env | N/A | Remove in prod | Must be **absent** on prod |
| `ARKESEL_API_KEY` / `ARKESEL_SENDER` | SMS notify | Private | optional | Convex env | Arkesel | Provider rotate | Optional |
| `VAPID_PRIVATE_KEY` / `VAPID_PUBLIC_KEY` / `VAPID_SUBJECT` | Web Push | Private / public / mailto | staging ✓ | Convex env | `web-push generate-vapid-keys` | On compromise | Optional |
| `TEST_NOTIFY_EMAIL` / `TEST_NOTIFY_PHONE` | Lab notify sinks | Private | staging only | Convex env | Operator | N/A | **Forbidden** on prod |
| `AUTH_JWT_*` | Future Auth0 customJwt | Mixed | staging leftover | Convex env | Auth0 | IdP | FUTURE / inactive |
| `CONVEX_DEPLOY_KEY` | CI/CLI deploy to named deployment | Private | operator machine / CI | Local `.env.staging.local` etc. | Convex dashboard | On leak | Operator |
| Cloudflare / Wrangler auth | Pages deploy | Private | operator | Wrangler OAuth / API token | CF dashboard | On leak | Operator |
| `VITE_CONVEX_URL` | SPA backend | **Public** | all FE builds | Build env | N/A | With cutover | Required |
| `VITE_SENTRY_DSN` / `VITE_GA_*` | Telemetry | Public | optional | Build env | Vendor | Vendor | Optional |
| `VITE_GW_URL` | Soft‑AP proxy | Public/local | local | `.env.local` | N/A | N/A | Local only |
| Collector `NCU_KEY` / `INGEST_URL` | Edge collector | Private | device/host | Firmware tools env | Operator | With ingest | Out of band |

## Production provisioning (PREPARED — do not execute)

1. Generate **new** `JWT_PRIVATE_KEY` + `JWKS` (never reuse roadrunner).  
2. Generate **new** `INGEST_SECRET` ≥32.  
3. Optionally configure Resend / Arkesel / VAPID with **prod** accounts and from-addresses.  
4. Set via `convex env set` targeting **production only** after written authorization.  
5. Confirm `AUTH_PASSWORD_RESET_DEV` and `TEST_NOTIFY_*` are unset.  

## Git / exposure

- Frontend secret scan: `node scripts/check-frontend-secrets.mjs [--dist]`  
- Do not commit `.env*.local` (gitignored).  
- Historical Auth0 SPA docs must not be mistaken for active login.
