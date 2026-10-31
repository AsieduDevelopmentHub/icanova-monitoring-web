# Environment variable inventory

Never put Convex secrets in `VITE_` variables. Never commit real values.

## 1. Frontend build (Vite)

| Variable | Required | Secret | Where | Purpose |
|---|---|---|---|---|
| `VITE_CONVEX_URL` | Production UI | No | `.env.local` / CI build env | Convex cloud URL (`https://….convex.cloud`) |
| `VITE_GW_URL` | Local proxy only | No | `.env.local` | ESP32 HTTP API for Vite `/api` proxy |
| `VITE_SENTRY_DSN` | Optional | No | build env | Browser error reporting |
| `VITE_GA_MEASUREMENT_ID` | Optional | No | build env | GA4; skipped in mock mode |
| `VITE_USE_MOCK` | Dev only | No | mode/`dev:mock` | Explicit mock fleet |
| `VITE_OIDC_ISSUER` | Optional SPA login | No | build env | Public OIDC issuer (https) |
| `VITE_OIDC_CLIENT_ID` | Optional SPA login | No | build env | Public SPA client id |
| `VITE_OIDC_AUDIENCE` | Optional SPA login | No | build env | JWT audience |
| `VITE_OIDC_REDIRECT_URI` | Optional SPA login | No | build env | `/auth/callback` |
| `VITE_OIDC_LOGOUT_REDIRECT_URI` | Optional | No | build env | Post-logout URL |
| `VITE_OIDC_*_ENDPOINT` | Optional | No | build env | Override authorize/token/end-session |

Never put an OIDC client **secret** in `VITE_*`.

## 2. Convex server (`pnpm exec convex env set`)

| Variable | Required | Secret | Purpose |
|---|---|---|---|
| `AUTH_JWT_ISSUER` | Production | No (URL) | JWT issuer. Use `disabled` only in unlocked local experiments |
| `AUTH_JWKS_URL` | Production | No (URL) | JWKS endpoint. Must be reachable |
| `AUTH_JWT_AUDIENCE` | Production | No | Expected `aud` (staging/prod brand: `icanova`). **Required** — no code fallback |
| `AUTH_JWT_JWKS` | If self-hosting JWKS | Public keys only | Body of `GET /.well-known/jwks.json` |
| `INGEST_SECRET` | Production ingest | **Yes** | Bearer shared with NCU collector |
| `INGEST_RATE_LIMIT_DEVICE` | Optional | No | Max ingest requests per device identity per window (default 60) |
| `INGEST_RATE_LIMIT_IP` | Optional | No | Max ingest requests per hashed source IP per window (default 600) |
| `INGEST_RATE_WINDOW_MS` | Optional | No | Rate-limit window in ms (default 60000) |
| `RESEND_API_KEY` | Email | **Yes** | Resend API |
| `RESEND_FROM` | Email | No | Verified from-address |
| `ARKESEL_API_KEY` | SMS | **Yes** | Arkesel API |
| `ARKESEL_SENDER` | SMS | No | Sender id |
| `TEST_NOTIFY_EMAIL` | Staging tests only | No | Override destination; never a production customer inbox |
| `TEST_NOTIFY_PHONE` | Staging tests only | No | Override destination; never a production customer MSISDN |

## 3. NCU collector (`tools/.env` in firmware repo)

| Variable | Required | Secret | Purpose |
|---|---|---|---|
| `NCU_KEY` | Yes | **Yes** | 32 hex AES-128 key |
| `INGEST_URL` | Yes (unless `--print-only`) | No | `https://<deployment>.convex.site/ncu/ingest` |
| `INGEST_SECRET` | Yes (unless `--print-only`) | **Yes** | Same as Convex |

`--print-only` decrypts and acks without Convex. Not for production.

## 4. Gateway firmware (`/etc/gateway.conf`)

| Key | Secret | Purpose |
|---|---|---|
| `wifi.sta_ssid` / `wifi.sta_pass` | pass yes | Station network |
| `wifi.mode` | No | `auto` / `ap` / `sta` / `apsta` / `off` |
| `uplink.enable` | No | on/off |
| `uplink.host` / `port` / `path` | No | Collector or Convex site host |
| `uplink.key` | **Yes** | NCU AES key |
| `uplink.bearer` | **Yes** | Ingest bearer when posting to Convex |
| `modbus.telemetry` | No | Background DSE snapshot |

Do not print `uplink.key` or `uplink.bearer` on the serial console.

## 5. Separation rules

1. Development, staging, and production use different Convex deployments and different `INGEST_SECRET` values.
2. Do not copy development credentials into production by default.
3. Test notify destinations must not be wired as default production recipients.
4. Frontend build env may contain only `VITE_*` public values.

## 6. Operator-required production auth

See [production-auth-setup.md](./production-auth-setup.md). Until real `AUTH_JWT_ISSUER` / `AUTH_JWKS_URL` / `AUTH_JWT_AUDIENCE` are set by an operator, production auth is **not** ready. Placeholders and `disabled` are rejected by `productionConfig`.

## 7. Device lifecycle

Devices have `lifecycle` `active` | `inactive` (missing treated as active). Admins with `manage.devices` call `devices.setLifecycle`. Inactive devices receive HTTP 403 on ingest/heartbeat; history is retained.

## 8. Shared ingest secret limitations

Current firmware and NCU1 collectors authenticate with one shared `INGEST_SECRET`. Compromise of that secret allows any caller that also knows a registered device identity to post. Future work: per-device credentials with gradual rotation while keeping the shared secret as a fallback during migration. Rate limits reduce blast radius but do not replace credential rotation.
