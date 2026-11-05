---
description: "Use when changing gateway ingest, telemetry APIs, or web-to-gateway contracts."
applyTo: "{convex/ingest*.ts,convex/http.ts,convex/deviceHealth*.ts,convex/telemetry.ts,convex/schema.ts,src/telemetry/**,docs/security/**,docs/guide/*device*,docs/guide/*ingest*}"
---

# API contracts (web ↔ gateway)

Before changing payloads, inspect the sender, receiver, consumers, and deployed compatibility; define and validate the new contract, add contract tests, and document breaking changes.

- Do not silently rename or remove fields. Do not invent telemetry fields or Modbus registers.
- Validate external inputs and handle missing, malformed, stale, and unexpected fields.
- Prefer backward compatibility; version when needed and preserve raw diagnostic evidence.
- Call out cross-repository impact explicitly.
- The shared `INGEST_SECRET` is a known unresolved security exception. Do not report it resolved without a verified per-device migration.
- The direction is unique per-gateway credentials with server verification, provisioning/rotation/revocation, org/site binding, audit, leakage protection, and replay protection where supported.
- Use hashed storage and constant-time comparison where appropriate. Do not break staging devices without a tested migration.
