# Device credential fleet migration plan (Phase 8.2A)

**Date:** 2026-10-31  
**Status:** PLAN ONLY — **no devices migrated**  
**Backend:** Dual-auth **VERIFIED IN STAGING** (`scripts/staging-device-cred-http.mjs`)  
**Companion:** `docs/guide/device-credential-migration.md` (model + current behavior)

Shared `INGEST_SECRET` **must remain enabled** until an explicitly approved cutover completes.

---

## 1. Goals

1. Move collectors/firmware from shared bearer → per-device bearer.  
2. Store only SHA-256 hashes in Convex (`ingestCredentialHash` + previous).  
3. Preserve ingest availability (no fleet-wide outage).  
4. Keep rollback = shared secret still works.

---

## 2. Eligibility

| Eligible | Not eligible (yet) |
|---|---|
| Registered staging/prod devices with known identity (`^[0-9a-f]{12}$`) | Unknown identities |
| Active lifecycle | Inactive (fix first) |
| Operator can update device NVS / collector env | Devices without secure secret delivery path |

---

## 3. Provisioning

1. Operator with `manage.devices` generates high-entropy secret (≥16 chars; prefer ≥32).  
2. Call `devices.setIngestCredential` (stores hash only).  
3. Deliver plaintext **once** via secure channel → device NVS / collector secret store.  
4. Confirm `devices.detail` shows `hasIngestCredential: true` and never returns hash/plaintext.

Rotation: call `setIngestCredential` again — previous hash remains valid until next rotate (overlap window).

Revocation: `clearIngestCredential` — device bearer fails; shared secret still works until cutover.

---

## 4. Migration batches

| Batch | Scope | Success criteria |
|---|---|---|
| 0 | Synthetic staging devices | HTTP matrix green (already) |
| 1 | 1–3 lab gateways | Device bearer ingest 2xx/204; shared still works |
| 2 | Single site | `auth_failed` rate stable; no mass 401 |
| 3 | Remaining fleet by site | Same |
| 4 | Cutover review | All prod devices have hashes; monitor ≥ soak period |
| 5 | Retire shared secret | **Separate written approval** — remove/rotate `INGEST_SECRET` |

Do not skip to batch 5 without soak evidence.

---

## 5. Secure delivery

- Prefer offline/USB/serial provisioning over chat/email.  
- Never commit device secrets.  
- Never put device secrets in `VITE_*`.  
- Firmware/collector change is **out of band** for this web repo (protocol currently supports dual-auth server-side).

---

## 6. Monitoring during migration

| Signal | Expect |
|---|---|
| Ingest `auth_failed` | No sustained spike after each batch |
| Shared-secret accepts | Still present until cutover |
| Device-cred accepts | Rising with migrated devices |
| Inactive 403 | Only for deactivated devices |
| Rate limited 429 | Investigate if correlated with retries |

---

## 7. Rollback / failure recovery

| Failure | Action |
|---|---|
| Device mis-provisioned | Fix NVS; or `clearIngestCredential` + use shared secret |
| Mass 401 on device bearer | Confirm shared secret path; halt batch |
| Suspected secret leak | Rotate device hash; rotate shared secret if shared path exposed |
| Need full rollback | Leave `INGEST_SECRET` set; clear device hashes optional |

---

## 8. Cutover approval checklist

- [ ] All production devices `hasIngestCredential`  
- [ ] Soak period without shared-secret-only dependency  
- [ ] Collector/firmware builds no longer require shared secret  
- [ ] Incident runbook updated  
- [ ] Written approval to remove shared secret  

**Classification:** IMPLEMENTATION REQUIRED (fleet ops) + VERIFIED IN STAGING (server dual-auth).
