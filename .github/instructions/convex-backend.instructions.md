---
description: "Use when changing Convex schema, queries, mutations, auth hooks, or ingest."
applyTo: "convex/**/*.{ts,js}"
---

# Convex backend

- Authorize every organization-scoped query and mutation before data access (`requirePermission` / authz).
- Prefer indexes; bound `.take()` calls and paginate. Make additive, intentional schema changes in `schema.ts`.
- Keep device ingest credentialed and rate-limited, with honest health and freshness transitions.
- Use deterministic sorts when UI ordering matters, such as roster order by last activity.
- Never log secrets, JWTs, device credentials, or raw auth headers.
- Demo and seed paths must not wipe or replace durable tenant data outside explicit staging tools.
- When these paths change, cover authz, health, and ingest edge cases with Convex/Vitest tests.
