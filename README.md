# iCanOva Monitoring

Web-based platform for industrial equipment monitoring, device management, operational visibility and connected system management.

**Brand:** iCanOva — Imagine. Connect. Innovate.  
**Platform:** iCanOva Monitoring  
**Edge family / product:** iCanOva Edge / iCanOva Edge Gateway  
**Descriptor:** Intelligent technology for connected industries.  
A technology platform by ASIEDU DEVELOPMENT HUB (ADH).

Edge firmware: [`icanova-edge-gateway`](https://github.com/AsieduDevelopmentHub/icanova-edge-gateway). Product terminology: `docs/product/`. Brand tokens: gateway `doc/brand/` (mirrored in `src/styles.css`).

## What this app does

- Org-scoped fleet monitoring (Convex).
- Auth0 / OIDC sign-in (audience and issuer from environment — not renamed by branding).
- Local gateway Monitor / Configure tools when pointed at an edge device.
- GenComm configuration UI backed by `public/gencomm.json`.

## Run

Package manager: **pnpm**.

```bash
pnpm install
pnpm dev:mock          # mock / fixture data
pnpm dev               # proxy /api to VITE_GW_URL (default http://192.168.4.1)
```

Open http://localhost:5173/

## Build and test

```bash
pnpm build
pnpm test
```

## Platform services

Copy `.env.example` to `.env.local`. Integrations stay off until configured. See `docs/guide/env-inventory.md` and `docs/status/phase7-production-readiness.md`.

Do not invent production JWT issuer or JWKS values. Auth audience is fail-closed: missing `AUTH_JWT_AUDIENCE` / `VITE_OIDC_AUDIENCE` disables providers / OIDC config (no `dse-gateway` fallback). Staging uses `icanova`.

## Repository identity

| Item | Value |
| ---- | ----- |
| GitHub | [AsieduDevelopmentHub/icanova-monitoring-web](https://github.com/AsieduDevelopmentHub/icanova-monitoring-web) |
| package.json name | `icanova-monitoring-web` |
