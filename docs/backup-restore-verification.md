# Backup and restore verification (Phase 8.1)

**Date:** 2026-10-31  
**Artifact path/manifest helpers:** COMPLETE (unit tested)  
**Staging snapshot export (preflight):** **VERIFIED** — see §5  
**Isolated restore drill:** **VERIFIED** — see §3 / §6  
**Phase 8.1 outcome:** Staging export + empty-recovery import + function deploy + read-only validation completed. Production DR still requires its own approved drill (or residual-risk acceptance).

Path/manifest validation alone is **not** sufficient; the restore gate is closed only by §3 evidence below.

---

## 1. What code proves today

| Check | Location | Proves |
|---|---|---|
| Required table document paths | `src/ops/backupArtifact.ts` / `scripts/restore-drill-check.mjs` | ZIP listing includes expected tables |
| Manifest counts / timestamps | `backupArtifact.ts` | Operator-supplied metadata consistency |
| Restore target guard | `restoreTargetAllowed` | Blocks forbidden deployment names |
| `RESTORE_TEST_STATUS` | constant | **VERIFIED** isolated recovery 2026-10-31 |

**Forbidden restore targets:** `effervescent-kangaroo-10`, `dapper-roadrunner-247`, `tremendous-sturgeon-449`.

---

## 2. Backup (staging source)

Documented procedure (CLI equivalent used in preflight):

```bash
pnpm exec convex export --deployment staging --path backups/staging-….zip
node scripts/restore-drill-check.mjs --paths-file backups/staging-paths-….txt
```

Dashboard alternative: Convex → `dapper-roadrunner-247` → Backup / Snapshots → download ZIP.

Secrets are **not** inside the ZIP (reconstruct env from vault after restore).

---

## 3. Isolated restore (authorized 2026-10-31)

**Never restore over kangaroo, roadrunner, or sturgeon.**

1. Create **empty** recovery deployment, e.g. reference `recovery` / name pattern `dse-recovery-YYYYMMDD` (`convex deployment create … --type prod`).  
2. Confirm identity ∉ forbidden list.  
3. Import snapshot into recovery only:

```bash
pnpm exec convex import --deployment recovery --replace-all path/to/staging-snapshot.zip
```

4. Deploy matching functions with a **recovery-only** deploy key (`.env.recovery.local`, not `.env.staging.local`).  
5. Reconstruct Auth/ingest env from vault — **do not** copy staging notify destinations; recovery has Auth + ingest only.  
6. Validate data + tenant isolation; **no email/SMS**.  
7. Record RPO/RTO below.  
8. Quarantine recovery (leave up only for evidence; no fleet/SPA notify traffic).

| Metric | Measured value |
|---|---|
| RPO (drill) | Snapshot `20261031-035257` (~23 KB); restore validated same day — **backup age ≪ 24 h** (meets recommended config RPO) |
| RTO / restore duration | Import **~13 s** (98 application docs); functions deploy **~25 s**; read-only validation **~75 s**; technical restore after empty recovery existed **under 5 minutes** (≪ 4 h target) |
| Drill date | 2026-10-31 |
| Backup source | `dapper-roadrunner-247` (staging) |
| Recovery deployment | `vivid-mosquito-28` (Convex reference `recovery`) |

---

## 4. Related docs

- `docs/backup-and-disaster-recovery.md`
- `docs/production-backup-recovery-plan.md`
- `docs/phase8-1-operator-checklist.md`
- `scripts/restore-drill-check.mjs`

---

## 5. Preflight evidence (2026-10-31) — export

| Check | Result |
|---|---|
| Source deployment | **PASS** — `dapper-roadrunner-247` (`--deployment staging`) |
| Snapshot created | **PASS** — Convex export timestamp `1793418779348296969` |
| Local ZIP | `backups/staging-dapper-roadrunner-247-20261031-035257.zip` (gitignored) |
| Size | 23379 bytes |
| Path list | `backups/staging-paths-20261031-035257.txt` (70 entries) |
| Required table paths | **PASS** (`restore-drill-check.mjs --paths-file`) |
| Prod credentials involved | **No** |

Dashboard snapshot URL (metadata only):  
https://dashboard.convex.dev/d/dapper-roadrunner-247/settings/snapshots

---

## 6. Restore evidence (2026-10-31) — recovery

| Check | Result |
|---|---|
| Authorization | **PASS** — operator authorized empty-recovery create + import |
| Recovery identity | **PASS** — `vivid-mosquito-28` / reference `recovery` (not kangaroo/roadrunner/sturgeon) |
| Import | **PASS** — `--replace-all` staging ZIP → recovery; **98** application documents (ZIP app rows excluding `_tables` metadata) |
| Functions deploy | **PASS** — `convex deploy --env-file .env.recovery.local` → `https://vivid-mosquito-28.convex.cloud` |
| Recovery env | **PASS** — `AUTH_JWT_ISSUER`, `AUTH_JWKS_URL`, `AUTH_JWT_AUDIENCE=icanova`, distinct `INGEST_SECRET`; **no** `RESEND_*` / `TEST_NOTIFY` / notify keys |
| Durable table counts vs ZIP | **PASS** — orgs 2, users 2, memberships 2, sites 2, devices 8, audits 47, roles 2, deviceHealthCurrent 2, notificationDispatches 10, jobRunState 5, … |
| Ephemeral note | `ingestRateWindows` ZIP=3 → recovery=0 after cron `ingestRateLimit.pruneStale` (expected; not durable config) |
| Auth `/me` | **PASS** — Auth0 access token `aud=icanova` → `https://vivid-mosquito-28.convex.site/me` **200**; subject matches JWT |
| Tenant isolation | **PASS** — `organizations.mine` → Auth0Station only; foreign Station org sites.list denied |
| Staging intact | **PASS** — roadrunner still 2 orgs / 8 devices / 47 audits |
| Prod untouched | **PASS** — `tremendous-sturgeon-449` still **0** Convex env vars |
| Notify traffic | **None** — recovery intentionally silent |

### Quarantine

- Recovery remains available for evidence only.  
- Do **not** point collectors, production SPA, or notify providers at `vivid-mosquito-28`.  
- Decommission or wipe when programme no longer needs the artifact; rotate any recovery deploy key after decommission.

**Does not claim:** production deployment DR verified, or live writer cutover.
