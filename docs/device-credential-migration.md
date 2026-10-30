# Per-device ingest credential migration (Phase 8.0E)

**Status:** Design COMPLETE. Backend dual-auth foundation **IMPLEMENTED — NOT VERIFIED** in production.  
**Shared `INGEST_SECRET`:** Remains required for current ESP32/NCU1 fleets. **Do not remove** until cutover + rollback are proven.

---

## 1. Model

| Property | Choice |
|---|---|
| Credential | Unique high-entropy secret per device |
| Storage | SHA-256 hex on `devices.ingestCredentialHash` (+ previous hash for overlap) |
| Resolution | Bearer + body `identity` → registered device (org from registration) |
| Inactive | Still rejected |
| Queries | Hashes never returned; `hasIngestCredential` boolean only |
| Logging | Never log plaintext or hashes |

---

## 2. Dual-auth behavior (current)

1. Shared `INGEST_SECRET` bearer → accept (unchanged).
2. Else verify presented bearer against device hash (current or previous) for the request identity.
3. Rate limits, idempotency, inactive checks unchanged.
4. Firmware / NCU1 collector **unchanged** in this phase.

Admin: `devices.setIngestCredential` / `devices.clearIngestCredential` require `manage.devices`.

---

## 3. Cutover plan (future)

1. Keep shared secret working.
2. Provision hashes for registered devices; store plaintext only in secure operator vault / device NVS.
3. Migrate collectors/firmware device-by-device to device bearer.
4. Monitor `auth_failed` vs accept rates.
5. Retire shared secret only after entire production fleet rotated.
6. Rollback: re-enable shared secret env; previous hash overlap covers in-flight rotations.

---

## 4. Rollback

Redeploy prior HTTP auth if needed; clear device hashes with `clearIngestCredential` or leave unused. Shared secret path remains the safety net until explicit cutover.
