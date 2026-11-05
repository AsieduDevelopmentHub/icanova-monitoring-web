---
description: "Use when changing auth, fleet, Convex, security docs, environment files, or operational scripts."
applyTo: "{src/auth/**,src/fleet/**,convex/**,docs/security/**,.env*,scripts/**}"
---

# Security and operations hygiene

- Never commit `.env.local`, credentials, or production secrets.
- Rotate or migrate device credentials/ingest keys only through documented guides under `docs/guide/` or `docs/security/`.
- Prefer existing runbooks under `docs/guide/` and `docs/operations/` over creating new process files.
- The shared `INGEST_SECRET` remains an open exception until per-device credentials are verified; see `.github/instructions/api-contracts.instructions.md`.
- Follow `.github/instructions/multi-tenant-security.instructions.md` for tenant isolation and Convex Auth, and `.github/instructions/deployment-safety.instructions.md` for deployment gates.
