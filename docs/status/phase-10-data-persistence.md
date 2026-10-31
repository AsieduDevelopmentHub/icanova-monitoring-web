# Phase 10 — Org / gateway / generator “lost after deploy”

**Date:** 2026-10-31  
**Verdict:** Cloud fleet data is durable. Apparent loss is almost always the SPA talking to a **different Convex deployment**, or Soft‑AP settings that never lived in the cloud.

---

## Root cause

| Symptom | Actual cause |
|---|---|
| Orgs / gateways / generators “reset” after Pages deploy | `pnpm build` (Vite **production** mode) loads `.env.local` → embeds **kangaroo**. Live Pages should embed **roadrunner**. Redeploying that `dist/` switches the SPA to an empty/different DB. |
| Soft‑AP Modbus / Wi‑Fi “lost” after flash | Device NVS only — not Convex. |
| Theme / OIDC PKCE gone | Browser `localStorage` / `sessionStorage` — expected. |

Live check (2026-10-31): `https://icanova.pages.dev` bundle embeds `dapper-roadrunner-247` only (kangaroo/sturgeon absent).

## Fix (repo)

| Script | Purpose |
|---|---|
| `pnpm build:staging` | `vite build --mode staging` + assert roadrunner host + frontend secret scan |
| `pnpm build:production` | Asserts sturgeon host (do **not** run cutover without authorization) |
| `scripts/assert-dist-convex-url.mjs` | Fails deploy prep if wrong Convex host is baked in |

**Operator rule:** Before `wrangler pages deploy dist --project-name icanova`, run **`pnpm build:staging`**, never bare `pnpm build`.

## Not a wipe

Convex function deploy does not clear `organizations` / `devices` / `generators`. Retention jobs prune telemetry/health windows only.

## Soft‑AP vs cloud

Cloud stores registration + telemetry. ESP32 Soft‑AP Modbus/baud/Wi‑Fi remains on the gateway (`Configure` / Soft‑AP). Flash or factory reset clears those locally.
