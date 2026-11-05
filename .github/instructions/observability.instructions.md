---
description: "Use when changing logging, diagnostics, operational errors, fleet, notifications, or status records."
applyTo: "{convex/**/*.ts,src/ops/**,src/notify/**,src/fleet/**,docs/status/**,docs/operations/**}"
---

# Observability

Prefer structured, actionable diagnostics that distinguish:

- Authentication from authorization failures.
- Backend connectivity from gateway-offline state.
- Stale telemetry from a zero measurement.
- Modbus/link health from cloud contact.
- Alarm conditions from notification-delivery failures.

Never log passwords, private keys, tokens, API secrets, plaintext device credentials, or sensitive user data without justified need. Avoid generic errors when useful context is available.
