---
description: "Use when changing Convex data, telemetry, fixtures, fleet, or site presentation."
applyTo: "{convex/**/*.ts,src/telemetry/**,src/sites/**,src/fleet/**,src/fixtures/**}"
---

# Data integrity

Cloud organizations, sites, gateways, generators, and telemetry are durable Convex records.

Never add destructive database resets to ordinary deploy/init flows, auto-delete organizations or devices at startup, replace real cloud data with demo seed outside demo flows, convert missing telemetry to `0`, silently discard valid telemetry, or assume Modbus/Soft-AP settings persist in the cloud.

When a page appears empty, investigate in this order: frontend Convex URL, deployment identity, auth/session, organization membership/permissions, query loading/errors, whether records exist, and persistence last. Do not conclude data was deleted because a page looks empty.

Preserve valid negatives and power-factor signs. Distinguish source timestamps from gateway receipt time; never use uptime as wall time. Handle stale versus true zero, duplicates, and out-of-order readings deliberately. Preserve raw Modbus evidence when available.
