# DSE Gateway — React overview

Separate repo from the ESP32 firmware (`dse-modbus-gateway`). Monitor uses `GET /api/status`. Configure uses `public/gencomm.json` and, when a gateway is connected, `GET /api/read`, `POST /api/write`, and `POST /api/control`.

The firmware tool `tools/build_gencomm_catalog.py` in `dse-modbus-gateway` writes `public/gencomm.json` into this repo at `dev/iot/dse-gateway-web`.

Package manager: **pnpm**.

## Run

```bash
pnpm install

# Mock data (no hardware)
pnpm dev:mock

# Proxy to gateway AP (default http://192.168.4.1)
pnpm dev

# Custom gateway IP
# Windows PowerShell:
$env:VITE_GW_URL="http://192.168.1.50"; pnpm dev
```

Open http://localhost:5173/

## Build

```bash
pnpm build
```

Static output in `dist/`. The ESP32 still serves its own embedded page.

## Platform services

Copy `.env.example` to `.env.local`. Each integration stays off until its variables are set, so the gateway UI still runs without them.

| Service | Where | What it needs |
|---|---|---|
| Convex | Browser + `convex/` | `pnpm convex:dev` (needs a Convex login) writes `.env.local` and regenerates `convex/_generated`. Bearer JWT is stored with `setBearerToken` and sent by `ConvexReactClient.setAuth`. |
| Auth | Convex | `AUTH_JWT_ISSUER`, `AUTH_JWKS_URL`, `AUTH_JWT_AUDIENCE` (`dse-gateway`). RS256 JWT with `sub`, `iss`, `aud`, `exp`. HTTP check: `GET {CONVEX_SITE_URL}/me` with `Authorization: Bearer`. |
| Database | `convex/schema.ts` | `users`, `messages`, `files` |
| Storage | `convex/storage.ts` | `createUploadUrl`, `saveFile`, `fileUrl` (owner only) |
| Resend | `convex/notify.ts` `sendEmail` | `RESEND_API_KEY`, `RESEND_FROM` |
| Arkesel SMS | `convex/notify.ts` `sendSms` | `ARKESEL_API_KEY`, `ARKESEL_SENDER`. `POST https://sms.arkesel.com/api/v2/sms/send` |
| Sentry | `src/instrument.ts` | `VITE_SENTRY_DSN` |
| GA4 | `src/analytics.ts` | `VITE_GA_MEASUREMENT_ID`. Skipped in `pnpm dev:mock` |

Convex secrets are set with `pnpm exec convex env set NAME value`, not `VITE_` variables.
