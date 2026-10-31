# Database safety audit (Phase 7F)

**Deployment audited:** development `effervescent-kangaroo-10`  
**Date:** 2026-10-30  
**Rule:** Additive schema only. No destructive migrations in this phase.

---

## 1. Schema inventory

| Table | Purpose | Growth | Key indexes | Retention | Risks |
|---|---|---|---|---|---|
| `users` | Auth subjects | Low | `by_token` | Keep | Token identifiers only |
| `organizations` | Tenants | Low | — | Keep | Root of tenancy |
| `roles` / `memberships` | Authz | Low | `by_org`, `by_org_user`, `by_user` | Keep | Must stay org-scoped |
| `sites` | Sites + generatorCount | Low–med | `by_org` | Keep | `generatorCount` optional during recount |
| `devices` | Gateways | Med (≤10k) | `by_org_site`, `by_org_identity`, `by_identity` | Keep | `lifecycle` optional (missing=active); shared identity across orgs → ambiguous ingest |
| `generators` | 1:1 device binding | Med | `by_org_site`, `by_device` | Keep | Must match device org/site |
| `telemetryCurrent` | Live sample / generator | Med overwrite | `by_generator`, `by_org_site` | Keep current | High write rate; not history |
| `telemetryBuckets` | 15-min history | High | `by_generator_time`, `by_bucket` | **7 days** prune | Grows without prune; prune is bounded |
| `siteSummaries` / `orgHealthSummaries` | Incremental tallies | Low | `by_site`, `by_org` | Keep | Can drift; reconcile exists for sites |
| `deviceHealthCurrent` | Health dimensions | Med | device/org/site/sweep indexes | Keep | Sweep must stay indexed |
| `deviceHealthEvents` | Transitions | Med–high | `by_device_at`, `by_org_at`, `by_site_at` | Keep (no prune yet) | Can grow; deferred retention |
| `alarms` + comments/events | Alarm lifecycle | Med | org/site/generator/code indexes | Keep | Do not clear from job failure |
| `messages` / `notificationDispatches` / prefs | Notify outbox | Med | idempotency + lease indexes | Keep | Lease/claimGeneration required |
| `userNotifications` | In-app inbox | Med | user/org idempotency | Keep | — |
| `modbusRecords` / `devicePolls` | LAN diagnostics | Med | `by_device_time` | Keep | Optional evidence |
| `audits` | Security audit | Med | `by_org_time` | Keep | Never delete in 7.3 |
| `ingestCursors` | Epoch/boot/seq | Med | `by_device` | Keep | Critical for replay safety |
| `ingestRateWindows` | Rate counters | Med churn | `by_key`, `by_updated` | ~2h prune | Bounded by prune |
| `retentionState` | Prune progress | 1 row | — | Keep | — |
| `jobRunState` | Job visibility | ~jobs | `by_job` | Keep | No secrets |
| `migrationState` | Backfill progress | few | `by_name` | Keep | dryRun default |
| `files` / `reports` / maintenance | Ancillary | Low | org indexes | Keep | Reports may hold exports |

---

## 2. High-write / unbounded growth

| Area | Finding | Mitigation |
|---|---|---|
| `telemetryBuckets` | Continuous inserts | Indexed prune every 1 min, `PRUNE_BATCH`/`PRUNE_ROUNDS` |
| `deviceHealthEvents` | One row per transition | No prune yet — **deferred**; monitor growth |
| `messages` | Outbox growth | Delivery terminal states; no automatic wipe |
| `modbusRecords` | Diagnostics | Cap reads at 200; retention deferred |
| Fleet queries | Must not scan 10k | Site/org summaries + pagination (`MAX_PAGE=50`) |

---

## 3. Migration strategy (enforced)

1. Add optional fields/tables (existing rows remain readable).
2. Deploy readers that treat missing as defaults (e.g. lifecycle).
3. Optional bounded backfill (`convex/migrations.ts`), **dry-run by default**, operator-started.
4. Verify via `migrationState` + tests.
5. Field removal only in a separately approved later phase.

**No competing migration frameworks.** Progress lives in `migrationState`.

Example backfill: `device.lifecycle.active_default` — fills missing lifecycle to `active` in batches of 40, resumable, idempotent.

**Do not** execute large backfills automatically from crons.

---

## 4. Integrity invariants

| Invariant | Enforcement |
|---|---|
| Org ownership on telemetry/alarms/health | `organizationId` on rows; ingest resolves device by identity then uses device org |
| Site belongs to org | `requireSite` / create paths |
| One generator per device | `generators.create` check |
| Inactive devices cannot ingest | `deviceIsActive` before telemetry/health writes |
| Cross-tenant deny | Permission + org equality checks |
| Cursor ordering | `orderBatch` + `ingestCursors` |
| Notify idempotency | `notificationDispatches` + message keys |
| Delivery stale workers | `claimGeneration` + lease reclaim |

---

## 5. Optional fields (backward compatible)

- `devices.lifecycle`, `lifecycleChangedAt`
- Health/summary optional counters on older `siteSummaries`
- Message lease / claim fields
- Telemetry `extra` / `epoch`

---

## 6. Deferred / known gaps

- Automatic prune for `deviceHealthEvents` / `modbusRecords` / old `audits`
- Full org health reconcile job (site reconcile exists)
- Automated destructive field drops — **out of scope**
