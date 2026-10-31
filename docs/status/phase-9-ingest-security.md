# Phase 9 — Ingestion security (staging path)

**Date:** 2026-10-31  
**Production:** NOT AUTHORIZED — do not retire `INGEST_SECRET` on sturgeon (empty)  
**Hardware cutover:** DEFERRED — no physical fleet batch this phase  

---

## Current verified baseline

| Capability | Status | Pointer |
|---|---|---|
| Dual-auth (shared + per-device hash) | Staging VERIFIED (Phase 8.2) | `convex/ingestAuth.ts`, `docs/guide/device-credential-migration-plan.md` |
| Hash-only storage | COMPLETE | `ingestCredentialHash` / previous; plaintext never returned |
| Operator APIs | COMPLETE | `devices.setIngestCredential` / `clearIngestCredential` |
| Shared secret retirement | BLOCKED | Needs soak + written approval after fleet batches |

---

## Phase 9 stance

1. Keep shared `INGEST_SECRET` enabled on staging.  
2. Do **not** invent device migration evidence.  
3. Prefer staging synthetic/lab batches from the existing migration plan before any production planning.  
4. Firmware/collector NVS updates remain out-of-band (hardware-dependent).  

## Operator checklist (staging only)

1. Confirm device registered with 12-hex identity.  
2. Generate ≥32-char secret offline.  
3. `setIngestCredential` → confirm `hasIngestCredential: true`.  
4. Deliver plaintext once via secure channel.  
5. Validate ingest 2xx/204 with device bearer; shared bearer still accepted.  
6. Watch `auth_failed` for spikes.  

## Explicit non-goals this phase

- Mass fleet cutover  
- Production `INGEST_SECRET` rotation/retirement  
- Logging plaintext credentials  
