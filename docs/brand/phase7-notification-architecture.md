# Phase 7 — Notification architecture audit

**Date:** 2026-10-31  
**Repo:** `icanova-monitoring-web` (`dse-gateway-web` local folder)  
**Branch:** `master` (dirty tree preserved; no commit)

## 1. Existing notification channels

| Channel | Status | Mechanism |
|---|---|---|
| In-app | Working | `userNotifications` via `emitNotificationEvent` when org `inapp` policy + `inAppEnabled` |
| Email | Working when configured | `messages` (`channel: email`) → Node action Resend |
| SMS | Working when configured | `messages` (`channel: sms`) → Node action Arkesel |
| Push | Stub | Policy + `pushEnabled` exist; `providerDecision("push")` was always `not_configured` |

No FCM, WhatsApp, or Telegram.

## 2. Existing notification lifecycle

1. Source (`alarms`, `deviceHealth`, `devices`) calls `notifyEmit.emit*`.
2. `notificationDispatches` enforces once-per-org-idempotency-key.
3. Org `notificationSettings.minSeverity` gate.
4. Recipients from memberships + roles + prefs + site filter.
5. Parallel: in-app insert; email/sms outbox + `scheduler.notify.deliverMessage`.
6. Optional alarm escalation scheduler.
7. Read path: `markRead` / `markAllRead` on `userNotifications`.

## 3. Existing delivery mechanisms

- Async outbox worker: `convex/notify.ts` `"use node"` action `deliverMessage`.
- Claim / lease / complete / reclaim in `notifyEmit`.
- No global delivery cron; per-message reclaim after lease.
- Manual `requestDelivery` / `retryDelivery` for admins.

## 4. Existing notification types

Emitted: `alarm.raised|acknowledged|cleared`, `device.registered`, `health.gateway.offline|recovered`, `health.telemetry.stale|recovered`.  
Schema-only (not emitted): `maintenance.recorded`.  
Severities: `critical` | `warning` | `informational`.

## 5. Existing user preferences

Table `notificationPreferences`: destinations, channel toggles (`email`/`sms`/`push`/`inApp`), `minSeverity`, `subscribedSiteIds`.  
Org: `notificationSettings`, `notificationPolicies` (channel × event).

## 6. Missing capabilities (pre-Phase 7)

- VAPID keys / sender / service worker / PushManager subscribe UX.
- `pushSubscriptions` storage and ownership enforcement.
- Push enqueue on emit (hot path skipped push).
- Inbox mark-unread; health events in Settings/Inbox filters.
- Unified dashboard “operational attention” strip.
- Distinction: creation ≠ delivery ≠ displayed/read.

## 7. Required schema changes

Add `pushSubscriptions` (user + org, endpoint/keys, status, delivery timestamps).  
Reuse `messages` with `channel: "push"` and `to: "push:{subscriptionId}"` (never raw endpoint in delivery list UI).  
No second inbox table.

## 8. VAPID integration design

- Secrets: Convex env `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:`).
- Public key: authenticated query only.
- Sender: extend existing `"use node"` `deliverMessage` with `web-push` library (same pattern as Resend/Arkesel).
- Client: explicit opt-in UI → permission → `PushManager.subscribe` → authorized mutation.
- Service worker: `public/sw-push.js` — push display + safe internal path navigation only.
- Optional: no forced prompt on login.

## 9. Delivery retry and failure strategy

Reuse existing claim/complete/backoff (`MAX_ATTEMPTS`, lease reclaim).  
410/404 → mark subscription `expired`/`disabled`, outcome `rejected` without endless retry.  
Timeouts → `uncertain` (no blind retry storm).  
Idempotency keys per subscription: `{eventKey}:push:{subscriptionId}`.

## 10. Security and authorization boundaries

- Auth0/JWT unchanged; server-side permission checks on all subscribe/unsubscribe/inbox/prefs.
- Users cannot register/delete another user’s subscriptions.
- Never return raw endpoints/keys in ordinary UI queries.
- Never put VAPID private key in `VITE_*` or client bundles.
- Compact push payloads; no telemetry values or credentials.
- Validate click navigation to internal allow-listed paths only.
- Org/site isolation preserved on emit and inbox queries.
