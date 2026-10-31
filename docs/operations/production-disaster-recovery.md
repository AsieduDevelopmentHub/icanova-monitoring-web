# Production disaster recovery (Phase 10)

**Date:** 2026-10-31  
**Status:** PROCEDURE DOCUMENTED — production-sourced DR **NOT DONE**  
**Must remain:** Do not modify or repurpose quarantined recovery `vivid-mosquito-28`. Do not run destructive restore against production without written break-glass authorization.

Canonical precursors:

- `docs/guide/backup-and-disaster-recovery.md`
- `docs/guide/backup-restore-verification.md`
- `docs/guide/production-backup-recovery-plan.md`
- `docs/status/phase-9-backup-dr.md`

---

## 1. Evidence classes (do not conflate)

| Class | What it is | Status |
|---|---|---|
| **A — Mosquito recovery drill evidence** | Staging snapshot from `dapper-roadrunner-247` restored into empty recovery `vivid-mosquito-28` | **VERIFIED** 2026-10-31 (`docs/guide/backup-restore-verification.md` §5–§6) |
| **B — Proposed production backup process** | Operator-owned schedule, vault, off-platform copies, and restore validation for `tremendous-sturgeon-449` | **DOCUMENTED HERE** — configuration / drills still required |
| **C — Actual production-sourced restore** | Backup taken from live production (sturgeon), restored into an empty lab/recovery deployment, validated | **NOT DONE** — production empty / not authorized; do not claim DR verified |

A successful mosquito drill proves tooling and procedure shape. It does **not** prove production RPO/RTO, production backup cadence, or production secret reconstruction.

---

## 2. What is backed up

### In a Convex deployment ZIP / snapshot

| Included | Notes |
|---|---|
| Application documents (orgs, users, memberships, sites, devices, generators, alarms, telemetry, audits, notify prefs/dispatches, ingest cursors, …) | Consistent snapshot per Convex Backup & Restore docs |
| Optional `_storage` file blobs | Include only if product uses storage that must survive restore |
| Table metadata needed for import | Present in export |

### Not in the ZIP (reconstruct separately)

| Not included | Owner |
|---|---|
| Env vars / secrets (`JWT_PRIVATE_KEY`, `JWKS`, `INGEST_SECRET`, Resend/Arkesel, VAPID, …) | Operator vault |
| Function / schema / cron source | Git |
| Pending scheduled function queue | Lost; re-arm via deploy + crons |
| Auth0 / IdP tenant config (if used) | IdP + operator |
| SPA hosting config / Pages project settings | Operator |
| Device NVS / Soft‑AP / firmware secrets | Hardware / device programme |
| Collector configs outside Convex | Operator |

Integrity helpers: `src/ops/backupArtifact.ts`, `scripts/restore-drill-check.mjs` (path/manifest checks — not a substitute for a live restore).

---

## 3. Frequency, retention, encryption, storage, access

### Proposed production backup process (Class B)

| Topic | Target / rule | Classification |
|---|---|---|
| Frequency | Daily automatic backups (Convex **Pro** periodic) **plus** manual backup before every production release / schema migration | OPERATOR CONFIGURATION REQUIRED |
| On-platform retention | Manual ~**7 days**; weekly/periodic ~**14 days** (Convex docs; confirm plan tier) | NOT VERIFIED for this project’s live plan |
| Off-platform retention | Encrypted copy of critical ZIPs for **≥30 days** if business requires | OPERATOR CONFIGURATION REQUIRED |
| Encryption | Convex platform: encrypted at rest (platform docs). Off-platform copies: encrypt at rest (operator-controlled store); never commit ZIPs to git | TARGET |
| Storage location | Convex dashboard backups for the **production** deployment; downloaded ZIPs only in approved encrypted object/file store (not the repo, not Slack) | TARGET |
| Access | Named deployment operator + security owner; least privilege on Convex team + vault; no shared personal laptops as sole copy | TARGET |
| Logging | Record deployment name, UTC timestamp, operator, include-storage flag, ticket/incident id for every backup and restore | REQUIRED |

CLI sketch (identity must be confirmed before use):

```bash
# Export — production only after written authorization; path outside git
pnpm exec convex export --deployment production --path <encrypted-store>/prod-….zip
node scripts/restore-drill-check.mjs --paths-file <path-list>
```

Never place `INGEST_SECRET`, JWT private keys, provider API keys, or PEM material in backup notes or ZIPs.

---

## 4. RPO / RTO (targets — not production-verified)

| Objective | Recommended target | Evidence today |
|---|---|---|
| **RPO** | ≤ 24 h for registration/config; tighter telemetry only with higher export cadence | Staging drill met ≪ 24 h backup age. **Production: NOT VERIFIED** |
| **RTO** | ≤ 4 h isolated restore + verify; ≤ 8 h return production writers | Staging technical restore ≪ 5 min after empty recovery existed. **Production: NOT VERIFIED** |

Treat these as programme targets until a **Class C** prod-sourced drill (or explicit residual-risk acceptance) is recorded.

---

## 5. Ordered restore (safe)

1. Confirm target deployment is **not** live production unless written break-glass authorization exists.  
2. Prefer restore into an **empty** recovery/lab deployment. Forbidden first targets without break-glass: `effervescent-kangaroo-10`, `dapper-roadrunner-247`, `tremendous-sturgeon-449` (guard also in `restoreTargetAllowed`).  
3. Take a fresh backup of the bad state before any destructive import.  
4. Import snapshot into the approved empty target only.  
5. Deploy matching function revision (schema of the backup).  
6. Reconstruct **environment-local** secrets from vault — **never** copy roadrunner secrets to sturgeon; never copy staging notify destinations into a lab restore.  
7. Run restore validation (§6).  
8. Operator approval before re-enabling collectors / notify.  
9. Quarantine or decommission lab recovery; rotate recovery deploy keys after decommission.

**Do not** point collectors, production SPA, or notify providers at `vivid-mosquito-28`.

---

## 6. Restore validation checklist

| Check | Expected | Evidence to capture |
|---|---|---|
| Deployment identity | Approved recovery/lab name; not kangaroo/roadrunner/sturgeon unless authorized | Dashboard URL / deployment ref |
| Durable table counts | Orgs, users, memberships, sites, devices, generators, alarms, audits match ZIP expectations | Count table vs ZIP manifest |
| Auth | Password / Convex Auth sign-in (or approved IdP) against restored auth + `users` rebind | `/me` or signed-in session proof (no secrets) |
| Tenant isolation | Foreign-org queries denied | Query result / audit note |
| Ingest | Dual-auth matrix only on staging/lab; prod only after launch auth | Status codes (not secrets) |
| Notify | Prefs present; **no** customer email/SMS from lab restores | Env list shows notify keys absent or disabled |
| Telemetry sample | Recent/current samples present if in snapshot | Screenshot or query id |
| Staging/prod intact | Source deployment unchanged if drill used a copy | Pre/post counts |
| RPO/RTO recorded | Actual backup age + wall-clock restore duration | Operator log |

Ephemeral tables (e.g. rate-limit windows) may be empty after cron prune — expected.

---

## 7. Ownership and communication

| Role | Responsibility |
|---|---|
| Deployment operator | Backups, drills, vault entries, Pages/SPA host alignment |
| Security owner | Secret rotation after restore/incident; access reviews |
| On-call | Execute this runbook; escalate Convex/IdP access blockers |
| Product / stakeholder | Written authorization for prod-sourced drill or residual-risk acceptance |

### Communication (incident / recovery)

1. Declare severity and whether writers (ingest / notify) are paused.  
2. State which evidence class is in play (A / B / C) — never imply Class C from mosquito alone.  
3. Notify stakeholders of RPO/RTO **estimates** vs measured values.  
4. After restore: confirm Auth, tenant isolation, ingest, and that mosquito/quarantine rules were respected.  
5. Post-incident: rotate compromised secrets; schedule Class C drill if still outstanding.

---

## 8. Rollback and service restoration

| Layer | Action |
|---|---|
| SPA | Redeploy last known-good Pages deployment (see `docs/deployment/cloudflare-production-cutover.md`) |
| Convex functions | Redeploy prior known-good revision to the **same** deployment; schema writes are forward-fix only |
| Data | Prefer empty-deployment restore + cutover plan over in-place overwrite |
| Config | Restore vault env carefully (wrong issuer/JWKS = Auth lockout) |
| Devices | Do **not** auto-roll device credentials; shared ingest secret remains fleet safety net until approved cutover |

---

## 9. Explicit non-claims

- Production DR test has **not** passed.  
- `tremendous-sturgeon-449` was empty / unauthorized as of Phase 9/10 programme notes — re-verify before any backup/restore involving production.  
- Mosquito remains **quarantined evidence only** — this document does not authorize changes to it.  
- Point-in-time recovery to an arbitrary timestamp is **unavailable** in public Convex docs; rely on snapshot cadence.
