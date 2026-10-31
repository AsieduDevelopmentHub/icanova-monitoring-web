# Browser E2E operator guide (Phase 8.1)

**Related evidence:** `docs/browser-e2e-report.md`  
**Specs:** `e2e/unsigned.spec.ts`, `e2e/authenticated.spec.ts`  
**Config:** `playwright.config.ts` — default `E2E_BASE_URL=http://127.0.0.1:4173`

Production hosts are **forbidden** as E2E targets.

---

## 1. Unsigned smoke (no IdP)

```bash
pnpm build
pnpm test:e2e:install
pnpm test:e2e
```

Expected: unsigned suite passes; authenticated suite **skipped** unless `E2E_OIDC=1`.

---

## 2. Authenticated staging run (requires real IdP)

### Required environment

Copy `.env.e2e.example` → `.env.e2e` (gitignored). Never commit credentials.

| Variable | Required | Notes |
|---|---|---|
| `E2E_BASE_URL` | Yes | Staging SPA origin only (preview or staging host). Not production. |
| `E2E_OIDC` | Yes (`1`) | Enables `e2e/authenticated.spec.ts` |
| `VITE_CONVEX_URL` | Build-time | Must be `https://dapper-roadrunner-247.convex.cloud` for staging |
| `VITE_OIDC_ISSUER` | Build-time | Real https IdP issuer |
| `VITE_OIDC_CLIENT_ID` | Build-time | Public SPA client |
| `VITE_OIDC_AUDIENCE` | Build-time | Must equal Convex `AUTH_JWT_AUDIENCE` (`dse-gateway`) |
| `VITE_OIDC_REDIRECT_URI` | Build-time | `{E2E_BASE_URL}/auth/callback` |
| IdP test user | Manual | Synthetic staging account with org membership |

### Commands

```bash
# Build SPA against staging Convex + public OIDC settings (from .env.staging.local / CI env):
# VITE_CONVEX_URL=https://dapper-roadrunner-247.convex.cloud
# VITE_OIDC_*=...
pnpm build

E2E_OIDC=1 E2E_BASE_URL=http://127.0.0.1:4173 pnpm test:e2e
```

Or point `E2E_BASE_URL` at a deployed staging frontend that was built with the same `VITE_*` values.

### Security

- Do not put client secrets in `VITE_*` or Playwright env.
- Do not use production IdP users or production Convex URLs.
- Do not weaken Convex `requirePermission` to make tests pass.

---

## 3. Coverage expectations (`e2e/authenticated.spec.ts`)

| Scenario | Spec intent | Status without IdP |
|---|---|---|
| Login / callback host safety | `/auth/login` not production | Skipped |
| Session → dashboard | Signed-in shell | Skipped |
| Logout / clear session | Session chrome cleared | Skipped |
| Ops section ACL surface | `/admin/ops` heading | Skipped (deep ACL is convex-test) |
| Fleet pages load when signed in | generators/gateways/sites/alarms/notify/settings | Skipped |
| Tenant isolation | Cross-org denial in UI | Skipped — needs two synthetic accounts (see checklist) |

Lab self-hosted JWKS (`issue-operator-token.py --staging`) proves Convex JWT accept via `/me`, **not** browser OIDC.

---

## 4. Current blockers

| Item | Status |
|---|---|
| Vercel / hosted staging SPA | **Absent** — use local preview + staging Convex, or operator-provisioned host |
| Real OIDC IdP + `VITE_OIDC_*` | **BLOCKED — OPERATOR** |
| `E2E_OIDC=1` evidence | **BLOCKED** until IdP exists |
