# Phase 7 — Notification centre & VAPID Web Push implementation notes

**Date:** 2026-10-31  
**Classification:** **PARTIALLY COMPLETE**

End-to-end browser delivery against a real push service was not verified in this session (VAPID keys not provisioned on staging/prod). Architecture, integration, tests, and build are complete with mocked / not_configured paths.

## 1. Initial repository state

- Branch: `master` (ahead of origin; dirty unrelated phase-8 docs preserved).
- No reset/clean/stash/commit.
- Work limited to `dse-gateway-web`.

## 2. Existing notification architecture

Unified pipeline already present: `emitNotificationEvent` → in-app `userNotifications` + outbox `messages` → Node `notify.deliverMessage` (Resend/Arkesel). Push was stubbed as always `not_configured`.

## 3. Final notification architecture

Same system extended:

- In-app centre unchanged as source of truth for “created”.
- Email / SMS unchanged.
- Browser push = `messages.channel === "push"` + `pushSubscriptions` + VAPID sender in the existing Node action.
- Policies/prefs still gate channels; push additionally requires an active subscription.

## 4. Existing channels preserved

In-app, email (Resend), SMS (Arkesel), alarm/health emit hooks, escalation, delivery history, retries.

## 5. VAPID implementation details

- Library: `web-push` inside `"use node"` `convex/notify.ts`.
- Env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (Convex server only).
- Public key via authenticated `api.push.vapidPublicKey`.
- No FCM / Firebase SDKs.

## 6. Browser subscription lifecycle

Explicit Settings UI → support check → explain → user click → permission → register `/sw-push.js` → `PushManager.subscribe` → `api.push.subscribe`. Unsubscribe disables rows + local subscription. No login-time prompt.

## 7. Service-worker behavior

`public/sw-push.js`: push event display, allow-listed internal path navigation only, no invented brand icons (none in `public/`).

## 8. Secure environment configuration

Documented in `.env.example` and `docs/guide/env-inventory.md`. Private key must never appear in `VITE_*`. Generate with `pnpm exec web-push generate-vapid-keys`.

## 9. Delivery and retry behavior

Reuses claim/complete/lease/backoff. 404/410 → `markSubscriptionInvalid`. Timeouts/5xx → `uncertain` (no blind retry storm). Idempotency per subscription: `{eventKey}:push:{subscriptionId}`. Server acceptance ≠ displayed/read.

## 10. Subscription storage and authorization

Table `pushSubscriptions` with org/user ownership. Status APIs never return endpoints/keys. Cross-user unsubscribe denied.

## 11. Notification centre changes

Read filters (all/unread/read), categories from real events, mark unread, health events in filters, clearer descriptions/links.

## 12. Preference changes

Channel toggles preserved; browser push panel for optional activation; push preference distinct from subscription.

## 13. Dashboard changes

“Needs attention” strip: critical/warning alarms, offline gateways, stale measurements, unread critical inbox — using existing queries only.

## 14. Files changed (primary)

- `convex/schema.ts`, `convex/delivery.ts`, `convex/push.ts`, `convex/notify.ts`, `convex/notifyEmit.ts`, `convex/notifications.ts`
- `public/sw-push.js`, `src/notify/webPush.ts`, `src/pages/Notifications.tsx`, `src/pages/Dashboard.tsx`, `src/pages/AlarmDetail.tsx`
- Tests: `src/notify/webPush.test.ts`, `src/fleet/push.convex.test.ts`
- Docs: `docs/brand/phase7-notification-architecture.md`, this file, `.env.example`, `docs/guide/env-inventory.md`

## 15. Schema and backend changes

Added `pushSubscriptions`. Extended emit to enqueue push. Extended delivery action. Added `markUnread`, `unreadCriticalCount`.

## 16. Security considerations

AuthZ on all push/inbox/prefs APIs; org isolation; no private key in client; masked push recipients in delivery history; path allow-list for clicks; compact payloads without telemetry secrets.

## 17. Test results

`pnpm test` — **176 passed** (35 files).

## 18. Build results

`pnpm build` — **passed** (`tsc --noEmit` + Vite).

## 19. Deployment requirements

1. Set Convex env on each deployment: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
2. Redeploy functions (`convex deploy --env-file …`) so schema + push module are live.
3. Serve SPA over HTTPS (secure context) so PushManager works.
4. Enable org push policies + user preference + browser subscription.
5. Staging acceptance: enable → receive real push → click navigates internally.

Dev/staging/recovery function deploys were refreshed with this change set. Production remains unauthorized / no `.env.production.local`.

## 20. Known limitations and deferred work

- Real-browser E2E push not executed here (no VAPID secrets in local env).
- No brand push icon/badge asset in `public/` yet.
- `maintenance.recorded` still schema-only (not emitted).
- Production Auth0/VAPID provisioning still operator-owned.
- Archive/dismiss fields not added (model has no archive column).
