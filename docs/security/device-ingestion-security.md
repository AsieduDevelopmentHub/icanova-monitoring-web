# Device ingestion security (Phase 10)

**Date:** 2026-10-31  
**Production:** **NOT AUTHORIZED** — do not retire or provision production `INGEST_SECRET` here  
**Hard rule:** Shared `INGEST_SECRET` is **not** eliminated. It remains the fleet safety net until an explicitly approved cutover.

**Primary code:** `convex/ingestAuth.ts`, `convex/http.ts` (`POST /ncu/ingest`), `convex/devices.ts`  
**Evidence scripts/docs:** `scripts/staging-device-cred-http.mjs`, `docs/guide/device-credential-migration.md`, `docs/guide/device-credential-migration-plan.md`, `docs/status/phase-9-ingest-security.md`

---

## 1. How devices authenticate today

### Dual-auth (current architecture)

`POST /ncu/ingest` accepts **either**:

1. **Shared secret** — `Authorization: Bearer <INGEST_SECRET>` compared with constant-time equality (`ingestAuthorized` in `ingestAuth.ts`).  
2. **Per-device credential** — if shared secret fails/mismatches, the handler extracts the bearer + body `identity` (12-hex), runs `devices.verifyDeviceIngestCredential`, and accepts if the SHA-256 of the presented secret matches `ingestCredentialHash` or `ingestCredentialPreviousHash` for that registered device.

Heartbeats (`kind: "heartbeat"`) use the same auth path; they are not telemetry samples and must not open alarms (`isIngestHeartbeat`).

### Storage model

| Item | Behavior |
|---|---|
| Shared secret | Convex env `INGEST_SECRET` only |
| Device secret | Plaintext never stored; SHA-256 hex on device row |
| Queries | `hasIngestCredential` boolean only; hashes/plaintext never returned |
| Logging | Do not log bearer, plaintext, or hashes |

Admin mutations (require `manage.devices`):

- `devices.setIngestCredential` — set/rotate; moves current hash → previous; audits `device.ingest_credential.rotate`
- `devices.clearIngestCredential` — clears hashes; audits `device.ingest_credential.revoke`; **shared secret still works**
- `devices.setLifecycle` — `inactive` → ingest/heartbeat **403**

---

## 2. Threat controls (current vs target)

| Concern | Current | Target |
|---|---|---|
| **Impersonation** | Attacker needs shared secret **or** a device’s secret **and** a registered 12-hex identity. Shared secret + known identity = fleet-wide forge risk (documented exception). Wrong-device credential rejected (staging matrix). | Per-device secrets only after fleet cutover; shared secret retired under separate approval |
| **Replay** | No signed nonce/timestamp auth. Mitigations: body size caps, sample caps, idempotency/ops paths, rate limits (per device identity + hashed IP). | Same unless firmware adds stronger request authentication (out of band) |
| **Revocation** | Device cred: `clearIngestCredential`. Device access: `setLifecycle(inactive)`. Shared secret: env rotation (all collectors). | Per-device revoke without rotating fleet shared secret (already partially true during dual-auth) |
| **Tenant binding** | Device row carries `organizationId`; identity resolves org via registration (`ingestOps.resolveOrgIdentity`). Credentials verified against the single device matching identity. | Unchanged; org ACL remains Convex `requirePermission` for operator APIs |
| **Audit** | Rotate/revoke write org audit events. Ingest failures counted as `auth_failed` / `inactive` / `rate_limited` via ingest ops notes (no secret material). | Retain; monitor during migration batches |

---

## 3. What is already implemented

| Capability | Status | Evidence |
|---|---|---|
| Constant-time shared bearer compare | COMPLETE | `ingestAuth.ingestAuthorized` / `constantTimeEqual` |
| SHA-256 device credential hashing | COMPLETE | `hashIngestCredential` |
| Current + previous hash overlap on rotate | COMPLETE | `deviceCredentialMatches`; staging rotation case |
| HTTP dual-auth wiring | COMPLETE | `convex/http.ts` comments + branch after shared gate |
| Operator set/clear APIs + audit | COMPLETE | `devices.setIngestCredential` / `clearIngestCredential` |
| Inactive device rejection | COMPLETE | verify + HTTP 403 |
| Rate limits / body limits | COMPLETE | `INGEST_RATE_*`, `INGEST_MAX_BODY` |
| Staging HTTP matrix | VERIFIED (prior Phase 8) | `scripts/staging-device-cred-http.mjs` against `dapper-roadrunner-247` |
| Local convex-test coverage | Expanded Phase 8.1 | valid / invalid / wrong-device / rotate / revoke / inactive |
| Migration plan | DOCUMENTED | `device-credential-migration-plan.md` (batches 0–5) |
| Shared secret retirement | **NOT DONE** | Explicitly deferred |

### Staging script coverage (`staging-device-cred-http.mjs`)

Synthetic identities; does not print secrets/hashes. Asserts:

- Shared secret → 204  
- Invalid / missing bearer → 401  
- Device cred valid → 204  
- Wrong / cross-device cred → 401  
- Rotation overlap (old + new) → 204  
- Revoke device cred → 401 while shared still 204  
- Inactive → 403  

---

## 4. Migration status

| Batch (plan) | Scope | Status |
|---|---|---|
| 0 | Synthetic staging devices | **DONE** (HTTP matrix) |
| 1 | 1–3 lab gateways | **DEFERRED** (hardware) |
| 2–3 | Site / fleet | **NOT STARTED** |
| 4 | Soak + review | **NOT STARTED** |
| 5 | Retire shared `INGEST_SECRET` | **BLOCKED** — needs soak + **written approval**; do not claim complete |

Firmware / NCU1 collectors still use shared bearer. Dual-auth is **server-side ready**; device NVS updates are out of band.

Production Convex has **no** `INGEST_SECRET` set (empty env). That is **not** the same as “shared secret eliminated” — production ingest is simply unprovisioned.

---

## 5. Remaining steps (do not execute without gates)

1. Keep shared `INGEST_SECRET` enabled on staging; generate a **new** independent value for production when authorized.  
2. Lab/hardware Batch 1: provision hashes via `setIngestCredential`, deliver plaintext once securely, confirm device-bearer ingest.  
3. Expand batches; watch `auth_failed` vs accepts.  
4. Only after full fleet hash coverage + soak: request written approval to retire shared secret.  
5. Rollback always available until Batch 5: shared env secret + previous-hash overlap.

**Phase 10 documentation does not flash hardware, print secrets, or disable shared auth.**
