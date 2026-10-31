# Production environment readiness (Phase 8.0F)

**Status:** Inventory COMPLETE. Production deploy **not started**. Validator pass ≠ production approval.

---

## 1. Configuration layers

| Layer | Examples | Rule |
|---|---|---|
| Frontend public | `VITE_CONVEX_URL`, `VITE_OIDC_*`, Sentry/GA | No secrets |
| Convex server | `AUTH_*`, `INGEST_SECRET`, Resend/Arkesel | Dashboard / `convex env` only |
| Collector | `NCU_KEY`, `INGEST_URL`, `INGEST_SECRET` | Host secrets; not Vite |
| Firmware NVS | wifi, uplink host/path/bearer | Never print secrets on serial |
| Hosting | Domain, TLS cert, static `dist/` | Operator |

---

## 2. Fail-closed checks (code)

`convex/productionConfig.ts`:

- Missing / placeholder / invalid / valid classification via issue codes.
- `configurationAssessment()` returns `status`: `missing` \| `placeholder` \| `invalid` \| `valid_unverified`.
- **`valid_unverified`** means values look structurally sound but login, restore, and hardware were **not** proven.

Never print secret values in logs or UI.

---

## 3. Production blockers (still open)

| Gate | Status |
|---|---|
| Distinct production Convex | OPERATOR ACTION REQUIRED |
| Real IdP issuer/JWKS/audience | OPERATOR ACTION REQUIRED |
| Production `INGEST_SECRET` | OPERATOR ACTION REQUIRED |
| HTTPS app host + `VITE_CONVEX_URL` | OPERATOR ACTION REQUIRED |
| Notify providers if enabled | OPERATOR ACTION REQUIRED |
| Backup restore drill | VERIFIED (staging → `vivid-mosquito-28`); prod DR still operator |
| Hardware acceptance | BLOCKED |

---

## 4. Leakage checks (repo)

- No kangaroo URL hardcoded in `src/` / `convex/` production paths.
- `.env.example` uses placeholders only.
- `scripts/operator.mjs` is development-only.
