# iCanOva Monitoring Platform

Web-based platform for industrial equipment monitoring, device management, operational visibility and connected system management.

**Brand:** iCanOva — Imagine. Connect. Innovate.  
**Descriptor:** Intelligent technology for connected industries.  
A technology platform by ASIEDU DEVELOPMENT HUB (ADH).

Edge firmware lives in the sibling folder `dev/hardware/icanova-edge-gateway`. Brand source of truth: that repo’s `doc/brand/`.

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

Copy `.env.example` to `.env.local`. Integrations stay off until configured. See `docs/env-inventory.md` and `docs/phase7-production-readiness.md`.

Do not invent production JWT issuer or JWKS values. Staging Auth0 audience may already be `icanova` via env; code fallbacks that still say `dse-gateway` are left for compatibility until operators rotate Auth0 deliberately.

## Repository identity

| Item | Current | Target (authorized rename) |
| ---- | ------- | -------------------------- |
| GitHub | [AsieduDevelopmentHub/icanova-monitoring-web](https://github.com/AsieduDevelopmentHub/icanova-monitoring-web) | renamed |
| package.json name | `icanova-monitoring-web` | same |
