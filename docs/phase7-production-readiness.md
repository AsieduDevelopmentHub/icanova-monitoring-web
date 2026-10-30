# Phase 7 — Production readiness audit (7A)

**Deployment under review:** development `effervescent-kangaroo-10`  
**Audit date:** 2026-10-30  
**Status:** Checklist only. No production deploy in this step.

This document is the Phase 7A deliverable. Implementation of 7B–7M must not invent credentials, must not weaken auth, and must not deploy production until the blockers below are cleared by an operator.

---

## 1. Architecture snapshot

| Layer | Location | Production path |
|---|---|---|
| Gateway firmware | `dse-modbus-gateway` | STA → HTTPS uplink (NCU1) or LAN collector |
| Collector | `tools/ncu_inbox.py` | Decrypts NCU1, posts JSON to Convex `/ncu/ingest` with bearer |
| Convex HTTP | `convex/http.ts` | `/ncu/ingest`, `/me`, `/.well-known/jwks.json` |
| Convex data | `convex/schema.ts` | Org-scoped devices, telemetry, alarms, health, notify |
| Frontend | Vite React | `VITE_CONVEX_URL` + bearer JWT via `setBearerToken` |

Tenancy is resolved from the registered device `identity` (12 hex chars of efuse MAC). The gateway does not choose an organization.

---

## 2. Findings by audit question

### 2.1 Development-only configuration

| Item | Finding |
|---|---|
| Soft-AP default proxy | `VITE_GW_URL` / Vite proxy default `http://192.168.4.1` — local USB/AP only |
| Mock mode | `pnpm dev:mock` / `VITE_USE_MOCK` — must stay labelled demo |
| Auth “disabled” sentinel | `AUTH_JWT_ISSUER=disabled` / `AUTH_JWKS_URL=disabled` empties providers — fine for local, **not** for production |
| Self-issued JWKS | Dev pattern serves JWKS from Convex `AUTH_JWT_JWKS` at `/.well-known/jwks.json` and uses the deployment `.convex.site` as issuer — acceptable only if that is the intentional IdP |
| `.env.local` | Contains Convex **server** names (`AUTH_*`, `INGEST_SECRET`) next to `VITE_*`. Vite should not ship those, but they must not be treated as frontend config and must never be committed |

### 2.2 Production-required environment variables

**Convex dashboard (server) — required for a secured production deploy**

| Variable | Required | Purpose |
|---|---|---|
| `AUTH_JWT_ISSUER` | Yes | Real JWT `iss` (not `disabled`, not invented) |
| `AUTH_JWKS_URL` | Yes | Reachable JWKS URL matching the issuer |
| `AUTH_JWT_AUDIENCE` | Yes (default `dse-gateway`) | Must match token `aud` |
| `AUTH_JWT_JWKS` | Only if self-hosting JWKS on this deployment | Public JWK set JSON for `GET /.well-known/jwks.json` |
| `INGEST_SECRET` | Yes | Shared bearer for collector → Convex ingest |
| `RESEND_API_KEY` / `RESEND_FROM` | If email alerts | Otherwise email stays `not_configured` |
| `ARKESEL_API_KEY` / `ARKESEL_SENDER` | If SMS alerts | Otherwise SMS stays `not_configured` |

**Frontend build**

| Variable | Required | Purpose |
|---|---|---|
| `VITE_CONVEX_URL` | Yes | `https://<deployment>.convex.cloud` |
| `VITE_SENTRY_DSN` | Optional | Error reporting |
| `VITE_GA_MEASUREMENT_ID` | Optional | Analytics |
| `VITE_GW_URL` | Dev/proxy only | Not needed for a pure cloud UI build |

**Gateway firmware (NVS / `/etc/gateway.conf`)**

| Key | Purpose |
|---|---|
| `wifi.*` | STA to site network |
| `uplink.enable/host/port/path/key/bearer` | Path to collector or direct Convex site URL |
| `modbus.telemetry` | Background DSE snapshot for uplink |

**NCU collector**

| Variable | Purpose |
|---|---|
| `NCU_KEY` / `--key` | AES-128 key (32 hex) |
| `INGEST_URL` | `https://<deployment>.convex.site/ncu/ingest` |
| `INGEST_SECRET` | Same as Convex |
| `--print-only` | Dev only — must never be production |

**Test-only (must not be production recipients)**

| Variable | Status |
|---|---|
| `TEST_NOTIFY_EMAIL` | Documented in `.env.example` — staging/lab only |
| `TEST_NOTIFY_PHONE` | Documented in `.env.example` — staging/lab only |

### 2.3 Hardcoded development URLs

- Vite proxy fallback `192.168.4.1` — OK for local gateway proxy.
- No hardcoded `effervescent-kangaroo-10` found in `src/` or `convex/` source (deployment id lives in local env / docs only).
- README still documents local AP workflow — fine; production deploy doc must be separate.

### 2.4 Development authentication assumptions

- `auth.config.ts` only registers a provider when **both** issuer and JWKS URL are configured and not `disabled`.
- Prior production abort: missing `AUTH_JWT_ISSUER` — still a real gate.
- Frontend stores a bearer in memory/local helper (`setBearerToken`); there is no hosted IdP login UI in-repo yet — operators must supply how production JWTs are minted.
- `GET /me` validates Convex auth identity; org permissions remain in Convex functions.

### 2.5 Secrets that might enter frontend bundles

| Risk | Assessment |
|---|---|
| `VITE_*` | Only public URLs/DSNs in example — OK |
| `INGEST_SECRET` in `.env.local` | Must stay out of `VITE_` and out of git |
| `AUTH_JWT_JWKS` | Public keys only if published; private signing key must never appear |
| Serial / CLI | Gateway must not print bearer/key values in diagnostics (verify before prod) |

### 2.6 Missing production configuration

- [ ] Distinct production Convex deployment (not assumed to be kangaroo-10)
- [ ] Operator-supplied production issuer + JWKS + audience
- [ ] Production `INGEST_SECRET` (separate from development)
- [ ] Production Resend / Arkesel if alerts are in scope
- [ ] Frontend production host + HTTPS
- [ ] Documented JWT minting / user onboarding path
- [ ] `TEST_NOTIFY_*` guards if live email/SMS verification remains
- [ ] Convex backup plan confirmed in dashboard (not verified in code)

### 2.7 Deployment dependencies

- Node + pnpm
- Convex CLI login and deploy rights
- Static frontend host (or Convex static hosting if used — not locked in code)
- Optional: Sentry, GA4, Resend, Arkesel
- Gateway flash + STA network + collector or direct HTTPS uplink
- Device rows pre-registered with correct 12-hex identity

### 2.8 Database migration requirements

- Schema already includes health, telemetry buckets, alarms, notify tables with indexes.
- Optional fields are common (`v.optional`) — additive deploys are the normal path.
- **No** device `deactivated` / `active` flag found on `devices` — Phase 7D/E gap.
- Retention: `BUCKET_RETENTION_MS` = 7 days; prune cron every minute (`PRUNE_BATCH` / `PRUNE_ROUNDS`).
- No destructive migration required for Phase 7 start; any new fields must be optional or backfilled with resumable jobs.

### 2.9 Scheduled jobs that must run in production

| Job | Schedule | Function | Notes |
|---|---|---|---|
| prune telemetry buckets | every 1 min | `internal.telemetry.pruneBuckets` | Resumable; bounded batches |
| device health sweep | every 1 min | `internal.deviceHealth.sweep` | Marks offline/stale; bounded |
| notification delivery | on-demand scheduler | `notify` / `notifyEmit` | Lease reclaim via `reclaimIfStale`; no global scan cron (intentional) |
| escalation | delayed scheduler | `notifyEmit.checkEscalation` | Only if org policy sets escalate minutes |
| site reconcile | chained from sweep | `deviceHealth.reconcileSite` | Incremental summaries |

### 2.10 Features that depend on local development tools

| Feature | Dependency |
|---|---|
| Gateway Configure / live Modbus UI | Local ESP32 or `VITE_GW_URL` proxy |
| Collector decrypt path | `tools/ncu_inbox.py` on a LAN host (unless firmware posts directly) |
| Mock fleet | `pnpm dev:mock` |
| GenComm catalog refresh | Firmware `tools/build_gencomm_catalog.py` |

Cloud dashboard + ingest + health do **not** require the USB CLI once gateways and collector are deployed.

---

## 3. Security posture (current)

| Control | Status |
|---|---|
| Ingest bearer (`INGEST_SECRET`) | Implemented (constant-time compare) |
| Ingest body size cap (8 KiB) | Implemented |
| Identity → single device/org | Implemented; ambiguous → 409 |
| Unknown device | 404 / `unknown` |
| Sequence / epoch ordering | Implemented in ingest |
| Heartbeat without opening alarms | Implemented (`kind=heartbeat`) |
| HTTPS to Convex | Convex `.site` is HTTPS; firmware must use TLS client for direct 443 |
| Rate limiting | **COMPLETE** (Phase 7.2) — per-device / per-IP windows |
| Deactivated devices | **COMPLETE** (Phase 7.2) — `devices.lifecycle` |
| Shared ingest secret | Adequate for early fleet; document rotation + future per-device credentials |
| Cross-tenant queries | Enforced via org membership/permissions (preserve in tests) |

---

## 4. Capacity sketch (10k devices) — unverified estimates

Assumptions: telemetry period 30 s, batch 4, heartbeat optional, 15-minute history buckets, 7-day retention.

| Stream | Rough order |
|---|---|
| Ingest POSTs | ~10k × (1 batch / 2 min) ≈ 5k writes/min if always online — validate against real duty cycle |
| `telemetryCurrent` | 1 doc/generator overwrite |
| `telemetryBuckets` | ≤ 672 docs/generator/week; prune must keep up |
| Health sweep | 10k devices / 40 per mutation ⇒ many chained rounds per minute — **watch sweep backlog** |
| Notify outbox | Alarm-driven; must stay leased and capped |

Bottleneck candidates: health sweep chain depth, prune under backlog, notification reclaim, index on `by_identity` for ingest.

---

## 5. Production readiness checklist (gate before deploy)

### Blockers (must be true)

- [ ] Production Convex deployment created (separate from development)
- [ ] Operator supplies real `AUTH_JWT_ISSUER`, `AUTH_JWKS_URL`, `AUTH_JWT_AUDIENCE` (not invented by the agent)
- [ ] `GET {issuer JWKS}` returns a valid key set
- [ ] `GET /me` with a valid production JWT succeeds; missing/malformed/expired/wrong-aud fail
- [ ] Production `INGEST_SECRET` set on Convex and collector only
- [ ] Frontend built with production `VITE_CONVEX_URL` only (no server secrets in build env)
- [ ] At least one registered device identity matches a physical or simulated gateway
- [x] Staging E2E path in Phase 7L documented with simulated traffic (`docs/staging-e2e-report.md`) — **separate staging deploy still operator**
- [x] `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm build` green on the Phase 7.5 verification pass
- [x] No production deploy forced while any auth/ingest secret is missing

### Should-fix before calling production “ready”

- [x] Device deactivate/reject path (Phase 7.2 — `devices.setLifecycle`)
- [x] Bounded ingest rate limit that preserves legitimate retries (Phase 7.2)
- [x] Env inventory + validation helpers (7C / 7.2)
- [x] Production auth setup guide (`docs/production-auth-setup.md`) — **operator must still supply real IdP values**
- [x] Backup/RPO/RTO documented from Convex product reality (7G) — see `docs/backup-and-disaster-recovery.md` (**restore drill still operator**)
- [x] Scheduled job inventory + run visibility (7H) — `docs/scheduled-jobs-audit.md`, `jobRunState`
- [x] Observability / ops overview (7I) — `docs/observability-audit.md`, `/admin/ops`, ingest op windows
- [x] Frontend production readiness (7J) — `docs/frontend-production-readiness.md`
- [x] Deployment runbook (7K) — `docs/deployment-runbook.md`
- [ ] Separate Resend/Arkesel production credentials
- [ ] Confirm gateway does not print uplink bearer/key on serial
- [ ] Isolated staging Convex + real IdP browser E2E
- [ ] Dashboard backup + isolated restore drill

### Explicit non-goals this phase

- Remote generator control
- Resetting production data
- Claiming backups exist without dashboard verification
- Copying development secrets into production by default

---

## 6. Recommended implementation order (next)

1. ~~7A–7I~~ — Complete on development (see §§9–11).
2. ~~7J / 7K / 7L~~ — Complete on development (see §12); staging IdP still operator.
3. **Operator** — Provision staging + production Convex; real IdP; backup restore drill; HTTPS host.
4. **Hardware** — Physical ESP32 / RS485 / DSE validation (not software-completable).
5. Final production deploy only after §5 blockers are operator-complete.

---

## 7. Development deployment status

- Development deployment name in docs: `effervescent-kangaroo-10`.
- Phase 6 claimed: tests + tsc + production frontend build previously green (re-verify in 7M).
- **Do not** change development while preparing production unless a fix is required for shared code.

## 8. Production deployment status

- **Not started.** Prior attempt aborted on missing `AUTH_JWT_ISSUER`.
- Agent will not invent issuer/JWKS/audience/signing keys.
- Agent will not run production deploy until the blocker checklist is operator-complete.

---

## 9. Phase 7.2 delivery notes

### Authentication (7B)

- Guide: `docs/production-auth-setup.md`
- `productionConfig` rejects placeholder hosts and non-https issuers/JWKS
- Providers still empty until the operator sets real values

### Device lifecycle (7D)

- Optional `devices.lifecycle` (`active` | `inactive`); missing ⇒ active
- `devices.setLifecycle` requires `manage.devices`, audits, idempotent
- `ingest.acceptBatch` and `deviceHealth.recordHeartbeat` return `inactive` before writes
- HTTP maps inactive to **403**
- History (telemetry/alarms/health events) is not deleted

### Ingestion hardening (7E)

| Limit | Default | Override env |
|---|---|---|
| Body size | 8192 bytes | (code constant) |
| Samples / batch | 8 | (code constant) |
| Per-device requests / window | 60 / 60s | `INGEST_RATE_LIMIT_DEVICE` |
| Per-IP requests / window | 600 / 60s | `INGEST_RATE_LIMIT_IP` |
| Window | 60000 ms | `INGEST_RATE_WINDOW_MS` |

- Exceeded limit → HTTP **429** + `Retry-After`
- Windows age out; no permanent block
- Shared `INGEST_SECRET` retained for ESP32/NCU1 compatibility
- Rate-limit rows pruned every 15 minutes

### Credential rotation (future)

1. Keep shared secret working.
2. Add optional per-device bearer (NVS) accepted alongside shared secret.
3. Migrate fleet device-by-device.
4. Retire shared secret only after all production gateways rotate.

### Operator recovery

- Inactive device: Gateway detail → Reactivate (or `devices.setLifecycle` active).
- Rate limit: wait for `Retry-After` / window; raise `INGEST_RATE_LIMIT_*` on Convex if duty cycle requires it.
- Auth: follow `docs/production-auth-setup.md`; never paste secrets into `VITE_*`.

---

## 10. Phase 7.3 delivery notes

| Area | Status |
|---|---|
| Database safety audit | `docs/database-safety-audit.md` |
| Migration framework | `convex/migrations.ts` — additive, dry-run default, not cron |
| Backup/DR docs | `docs/backup-and-disaster-recovery.md` |
| Scheduled jobs audit | `docs/scheduled-jobs-audit.md` |
| Job visibility | `jobRunState` + `api.jobStatus.list` |
| Backup path/manifest guards | `src/ops/backupArtifact.ts` |
| Real dashboard backup | **NOT TESTED — OPERATOR ACTION REQUIRED** |
| Restore drill | **NOT TESTED — OPERATOR ACTION REQUIRED** |
| Periodic Pro backups enabled | **OPERATOR ACTION REQUIRED** |
| Production deploy | **Not done** |

---

## 11. Phase 7.4 delivery notes

| Item | Status |
|---|---|
| Observability audit | `docs/observability-audit.md` |
| Retention policy | `docs/observability-retention.md` |
| Ingest hourly counters | `ingestOpWindows` + HTTP wiring |
| Ops overview API/UI | `api.ops.overview`, `/admin/ops` |
| Health event prune (14d) | Cron every 15 min |
| External APM | Not introduced |
| Live DSE validation | Not claimed |

---

## 12. Phase 7.5 delivery notes (7J / 7K / 7L)

| Area | Status |
|---|---|
| 7J Frontend production readiness | **COMPLETE** (software) — `docs/frontend-production-readiness.md` |
| 7J Hosted IdP login UI | **OPERATOR ACTION REQUIRED / DEFERRED** |
| 7K Deployment runbook | **COMPLETE** — `docs/deployment-runbook.md` |
| 7K productionConfig expansion | **COMPLETE** — notify-when-enabled + app URL profile |
| 7K Production deploy | **Not done** |
| 7L Staging environment | **OPERATOR ACTION REQUIRED** — not provisioned |
| 7L Software E2E (Vitest / convex-test) | **COMPLETE** — `docs/staging-e2e-report.md` |
| 7L Browser IdP E2E | **BLOCKED** |
| 7L Scale simulation | **COMPLETE** (simulation — not production load) |
| Backup restore drill | **OPERATOR ACTION REQUIRED** |
| Shared `INGEST_SECRET` | Known risk — future per-device credentials |
| Hardware / live DSE | **BLOCKED** — not claimed |

### Phase 7 overall

**Partially complete.** Software gates 7A–7L are implemented and verified on development. Production readiness remains blocked on operator IdP, secrets, staging/production infrastructure, backup restore, and hardware validation.

### Files added/updated in 7.5

- `docs/frontend-production-readiness.md`
- `docs/deployment-runbook.md`
- `docs/staging-e2e-report.md`
- `docs/phase7-production-readiness.md` (this section)
- `src/fleet/sessionGates.ts`, `src/ui/AppErrorBoundary.tsx`
- Ops / Settings / Shell / form pending guards
- `convex/productionConfig.ts` + tests
- `src/fleet/sessionGates.test.ts`, `scaleSimulation.test.ts`, observability ACL test
