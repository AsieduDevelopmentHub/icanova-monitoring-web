import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { DELIVERY_LEASE_MS, MAX_ATTEMPTS } from "./limits";
import { isPermission, type Permission } from "./permissions";
import { pushPayloadPath, vapidConfigured } from "./delivery";
import {
  alarmEmailHtml,
  alarmEmailSubject,
  alarmSms,
  deviceRegisteredEmail,
  severityAtLeast,
  type NotifySeverity,
} from "./notifyTemplates";

export const NOTIFY_EVENTS = [
  "alarm.raised",
  "alarm.acknowledged",
  "alarm.cleared",
  "device.registered",
  "health.gateway.offline",
  "health.gateway.recovered",
  "health.telemetry.stale",
  "health.telemetry.recovered",
] as const;

export type NotifyEvent = (typeof NOTIFY_EVENTS)[number];

const HEALTH_EVENTS = new Set<NotifyEvent>([
  "health.gateway.offline",
  "health.gateway.recovered",
  "health.telemetry.stale",
  "health.telemetry.recovered",
]);

type PolicyChannel = "email" | "sms" | "push" | "inapp";

const BACKOFF_MS = [5_000, 30_000, 180_000];

function asSeverity(value: string | undefined): NotifySeverity {
  if (value === "critical" || value === "warning" || value === "informational") {
    return value;
  }
  return "warning";
}

async function orgSettings(ctx: MutationCtx, organizationId: Id<"organizations">) {
  const row = await ctx.db
    .query("notificationSettings")
    .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
    .unique();
  return {
    minSeverity: (row?.minSeverity ?? "warning") as NotifySeverity,
    escalateAfterMinutes: row?.escalateAfterMinutes ?? null,
  };
}

async function memberSnapshot(ctx: MutationCtx, organizationId: Id<"organizations">) {
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_org_user", (q) => q.eq("organizationId", organizationId))
    .take(200);
  const rows: Array<{
    user: Doc<"users">;
    permissions: Permission[];
    preference: Doc<"notificationPreferences"> | null;
  }> = [];
  for (const membership of memberships) {
    const role = await ctx.db.get(membership.roleId);
    const user = await ctx.db.get(membership.userId);
    if (!role || !user || role.organizationId !== organizationId) {
      continue;
    }
    if (!role.permissions.every(isPermission)) {
      continue;
    }
    const preference = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", organizationId).eq("userId", user._id),
      )
      .unique();
    rows.push({
      user,
      permissions: role.permissions as Permission[],
      preference,
    });
  }
  return rows;
}

function siteAllowed(
  preference: Doc<"notificationPreferences"> | null,
  siteId: Id<"sites"> | null,
): boolean {
  const sites = preference?.subscribedSiteIds;
  if (!sites || sites.length === 0 || siteId === null) {
    return true;
  }
  return sites.some((id) => id === siteId);
}

function preferenceSeverity(
  preference: Doc<"notificationPreferences"> | null,
  severity: NotifySeverity,
): boolean {
  const minimum = preference?.minSeverity ?? "informational";
  return severityAtLeast(severity, minimum);
}

function needsPermission(event: NotifyEvent): Permission {
  if (event === "device.registered") {
    return "manage.devices";
  }
  if (HEALTH_EVENTS.has(event)) {
    return "view.diagnostics";
  }
  return "view.alarms";
}

function resolveRecipients(
  members: Awaited<ReturnType<typeof memberSnapshot>>,
  args: {
    event: NotifyEvent;
    severity: NotifySeverity;
    siteId: Id<"sites"> | null;
    assignedTo: Id<"users"> | null;
    escalationOnly: boolean;
  },
) {
  const required = needsPermission(args.event);
  const byUser = new Map<
    string,
    {
      user: Doc<"users">;
      permissions: Permission[];
      preference: Doc<"notificationPreferences"> | null;
    }
  >();
  for (const member of members) {
    if (args.escalationOnly && !member.permissions.includes("configure.notifications")) {
      continue;
    }
    const isAssignee = args.assignedTo !== null && member.user._id === args.assignedTo;
    const hasRole =
      member.permissions.includes(required) ||
      member.permissions.includes("manage.alarms") ||
      member.permissions.includes("configure.notifications");
    if (!isAssignee && !hasRole) {
      continue;
    }
    if (!preferenceSeverity(member.preference, args.severity)) {
      continue;
    }
    if (!siteAllowed(member.preference, args.siteId)) {
      continue;
    }
    byUser.set(String(member.user._id), member);
  }
  return [...byUser.values()];
}

async function policyEnabled(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  event: NotifyEvent,
  channel: PolicyChannel,
) {
  const policies = await ctx.db
    .query("notificationPolicies")
    .withIndex("by_org_event", (q) => q.eq("organizationId", organizationId).eq("event", event))
    .take(20);
  return policies.some((policy) => policy.channel === channel && policy.enabled);
}

/**
 * Create inbox and outbox rows for one lifecycle event. Idempotent on the
 * dispatch key. Provider I/O is scheduled, never run here.
 */
export async function emitNotificationEvent(
  ctx: MutationCtx,
  args: {
    organizationId: Id<"organizations">;
    event: NotifyEvent;
    severity: NotifySeverity;
    title: string;
    body: string;
    idempotencyKey: string;
    alarmId?: Id<"alarms">;
    generatorId?: Id<"generators"> | null;
    siteId?: Id<"sites"> | null;
    deviceId?: Id<"devices"> | null;
    assignedTo?: Id<"users"> | null;
    escalationOnly?: boolean;
    emailSubject?: string;
    emailHtml?: string;
    smsBody?: string;
  },
): Promise<{ created: boolean; messageIds: Id<"messages">[] }> {
  const existing = await ctx.db
    .query("notificationDispatches")
    .withIndex("by_org_key", (q) =>
      q.eq("organizationId", args.organizationId).eq("idempotencyKey", args.idempotencyKey),
    )
    .unique();
  if (existing) {
    return { created: false, messageIds: [] };
  }
  const settings = await orgSettings(ctx, args.organizationId);
  if (!severityAtLeast(args.severity, settings.minSeverity)) {
    await ctx.db.insert("notificationDispatches", {
      organizationId: args.organizationId,
      idempotencyKey: args.idempotencyKey,
      event: args.event,
      createdAt: Date.now(),
    });
    return { created: false, messageIds: [] };
  }
  await ctx.db.insert("notificationDispatches", {
    organizationId: args.organizationId,
    idempotencyKey: args.idempotencyKey,
    event: args.event,
    createdAt: Date.now(),
  });
  const members = await memberSnapshot(ctx, args.organizationId);
  const recipients = resolveRecipients(members, {
    event: args.event,
    severity: args.severity,
    siteId: args.siteId ?? null,
    assignedTo: args.assignedTo ?? null,
    escalationOnly: args.escalationOnly === true,
  });
  const messageIds: Id<"messages">[] = [];
  const inappOn = await policyEnabled(ctx, args.organizationId, args.event, "inapp");
  const emailOn = await policyEnabled(ctx, args.organizationId, args.event, "email");
  const smsOn = await policyEnabled(ctx, args.organizationId, args.event, "sms");
  const pushOn = await policyEnabled(ctx, args.organizationId, args.event, "push");
  const pushPath = pushPayloadPath({
    alarmId: args.alarmId ? String(args.alarmId) : null,
    deviceId: args.deviceId ? String(args.deviceId) : null,
    generatorId: args.generatorId ? String(args.generatorId) : null,
  });
  for (const recipient of recipients) {
    const preference = recipient.preference;
    if (inappOn && preference?.inAppEnabled === true) {
      const key = `${args.idempotencyKey}:inapp:${recipient.user._id}`;
      const prior = await ctx.db
        .query("userNotifications")
        .withIndex("by_org_idempotency", (q) =>
          q.eq("organizationId", args.organizationId).eq("idempotencyKey", key),
        )
        .unique();
      if (!prior) {
        await ctx.db.insert("userNotifications", {
          organizationId: args.organizationId,
          userId: recipient.user._id,
          event: args.event,
          severity: args.severity,
          title: args.title,
          body: args.body,
          alarmId: args.alarmId,
          generatorId: args.generatorId ?? undefined,
          siteId: args.siteId ?? undefined,
          deviceId: args.deviceId ?? undefined,
          readAt: null,
          createdAt: Date.now(),
          idempotencyKey: key,
        });
      }
    }
    if (emailOn && preference?.emailEnabled && preference.email) {
      const id = await queueMessage(ctx, {
        organizationId: args.organizationId,
        channel: "email",
        to: preference.email,
        userId: recipient.user._id,
        event: args.event,
        subject: args.emailSubject ?? args.title,
        body: args.emailHtml ?? args.body,
        idempotencyKey: `${args.idempotencyKey}:email:${recipient.user._id}`,
        alarmId: args.alarmId,
        siteId: args.siteId ?? undefined,
        generatorId: args.generatorId ?? undefined,
        deviceId: args.deviceId ?? undefined,
      });
      if (id) {
        messageIds.push(id);
      }
    }
    if (smsOn && preference?.smsEnabled && preference.phone) {
      const id = await queueMessage(ctx, {
        organizationId: args.organizationId,
        channel: "sms",
        to: preference.phone,
        userId: recipient.user._id,
        event: args.event,
        body: args.smsBody ?? args.body,
        idempotencyKey: `${args.idempotencyKey}:sms:${recipient.user._id}`,
        alarmId: args.alarmId,
        siteId: args.siteId ?? undefined,
        generatorId: args.generatorId ?? undefined,
        deviceId: args.deviceId ?? undefined,
      });
      if (id) {
        messageIds.push(id);
      }
    }
    if (pushOn && preference?.pushEnabled === true) {
      const subscriptions = await ctx.db
        .query("pushSubscriptions")
        .withIndex("by_org_user", (q) =>
          q.eq("organizationId", args.organizationId).eq("userId", recipient.user._id),
        )
        .take(20);
      const pushBody = JSON.stringify({
        title: args.title.slice(0, 80),
        body: args.body.slice(0, 140),
        severity: args.severity,
        event: args.event,
        path: pushPath,
      });
      for (const subscription of subscriptions) {
        if (subscription.status !== "active") {
          continue;
        }
        const id = await queueMessage(ctx, {
          organizationId: args.organizationId,
          channel: "push",
          to: `push:${subscription._id}`,
          userId: recipient.user._id,
          event: args.event,
          subject: args.title.slice(0, 80),
          body: pushBody,
          idempotencyKey: `${args.idempotencyKey}:push:${subscription._id}`,
          alarmId: args.alarmId,
          siteId: args.siteId ?? undefined,
          generatorId: args.generatorId ?? undefined,
          deviceId: args.deviceId ?? undefined,
        });
        if (id) {
          messageIds.push(id);
        }
      }
    }
  }
  for (const messageId of messageIds) {
    const row = await ctx.db.get(messageId);
    if (row?.status === "pending") {
      await ctx.scheduler.runAfter(0, internal.notify.deliverMessage, { messageId });
    }
  }
  if (
    args.event === "alarm.raised" &&
    !args.escalationOnly &&
    args.alarmId &&
    settings.escalateAfterMinutes !== null &&
    Number.isFinite(settings.escalateAfterMinutes) &&
    settings.escalateAfterMinutes > 0
  ) {
    const alarm = await ctx.db.get(args.alarmId);
    const raisedAt = alarm?.raisedAt ?? Date.now();
    const dueAt = raisedAt + Math.floor(settings.escalateAfterMinutes * 60_000);
    const delay = Math.max(0, dueAt - Date.now());
    await ctx.scheduler.runAfter(delay, internal.notifyEmit.checkEscalation, {
      alarmId: args.alarmId,
      dueAt,
    });
  }
  return { created: true, messageIds };
}

async function queueMessage(
  ctx: MutationCtx,
  args: {
    organizationId: Id<"organizations">;
    channel: "email" | "sms" | "push";
    to: string;
    userId: Id<"users">;
    event: string;
    subject?: string;
    body: string;
    idempotencyKey: string;
    alarmId?: Id<"alarms">;
    siteId?: Id<"sites">;
    generatorId?: Id<"generators">;
    deviceId?: Id<"devices">;
  },
): Promise<Id<"messages"> | null> {
  const prior = await ctx.db
    .query("messages")
    .withIndex("by_org_idempotency", (q) =>
      q.eq("organizationId", args.organizationId).eq("idempotencyKey", args.idempotencyKey),
    )
    .unique();
  if (prior) {
    return null;
  }
  const resend = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
  const arkesel = Boolean(process.env.ARKESEL_API_KEY && process.env.ARKESEL_SENDER);
  const vapid = vapidConfigured({
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
    subject: process.env.VAPID_SUBJECT,
  });
  const configured =
    args.channel === "email"
      ? resend
      : args.channel === "sms"
        ? arkesel
        : vapid;
  const notConfigured =
    args.channel === "email"
      ? "Resend is not configured"
      : args.channel === "sms"
        ? "Arkesel is not configured"
        : "VAPID is not configured";
  return await ctx.db.insert("messages", {
    organizationId: args.organizationId,
    channel: args.channel,
    to: args.to,
    subject: args.subject,
    body: args.body,
    status: configured ? "pending" : "not_configured",
    attempt: 0,
    error: configured ? undefined : notConfigured,
    failureCategory: configured ? undefined : "not_configured",
    event: args.event,
    createdAt: Date.now(),
    userId: args.userId,
    alarmId: args.alarmId,
    siteId: args.siteId,
    generatorId: args.generatorId,
    deviceId: args.deviceId,
    idempotencyKey: args.idempotencyKey,
  });
}

export async function emitForAlarm(
  ctx: MutationCtx,
  alarm: Doc<"alarms">,
  event: "alarm.raised" | "alarm.acknowledged" | "alarm.cleared",
  idempotencyKey: string,
  escalationOnly = false,
) {
  const organization = await ctx.db.get(alarm.organizationId);
  const site = await ctx.db.get(alarm.siteId);
  const generator = alarm.generatorId ? await ctx.db.get(alarm.generatorId) : null;
  if (!organization || !site) {
    return { created: false, messageIds: [] as Id<"messages">[] };
  }
  const severity = asSeverity(alarm.severity);
  const context = {
    organizationName: organization.name,
    siteName: site.name,
    generatorName: generator?.name ?? null,
    alarmId: String(alarm._id),
    summary: alarm.summary,
    severity,
    category: alarm.category ?? null,
    state: alarm.state,
    firstOccurredAt: alarm.firstOccurredAt ?? alarm.raisedAt,
    lastOccurredAt: alarm.lastOccurredAt ?? alarm.raisedAt,
    acknowledged: alarm.acknowledgedAt !== null,
  };
  return await emitNotificationEvent(ctx, {
    organizationId: alarm.organizationId,
    event,
    severity,
    title: alarmEmailSubject(context, event),
    body: alarm.summary,
    idempotencyKey,
    alarmId: alarm._id,
    generatorId: alarm.generatorId,
    siteId: alarm.siteId,
    deviceId: alarm.deviceId,
    assignedTo: alarm.assignedTo,
    escalationOnly,
    emailSubject: alarmEmailSubject(context, event),
    emailHtml: alarmEmailHtml(context, event),
    smsBody: alarmSms(context, event),
  });
}

export async function emitDeviceRegistered(
  ctx: MutationCtx,
  args: {
    organizationId: Id<"organizations">;
    siteId: Id<"sites">;
    deviceId: Id<"devices">;
    deviceName: string;
  },
) {
  const organization = await ctx.db.get(args.organizationId);
  const site = await ctx.db.get(args.siteId);
  if (!organization || !site) {
    return { created: false, messageIds: [] as Id<"messages">[] };
  }
  const copy = deviceRegisteredEmail(organization.name, site.name, args.deviceName, String(args.deviceId));
  return await emitNotificationEvent(ctx, {
    organizationId: args.organizationId,
    event: "device.registered",
    severity: "informational",
    title: copy.subject,
    body: `Device ${args.deviceName} registered at ${site.name}`,
    idempotencyKey: `device:${args.deviceId}:registered`,
    siteId: args.siteId,
    deviceId: args.deviceId,
    emailSubject: copy.subject,
    emailHtml: copy.html,
    smsBody: copy.sms,
  });
}

/**
 * Health transitions only. Modbus fail/recover stays on the alarm channel
 * (COMM_LINK_FAIL) so operators are not double-paged.
 */
export async function emitHealthEvent(
  ctx: MutationCtx,
  args: {
    organizationId: Id<"organizations">;
    event:
      | "health.gateway.offline"
      | "health.gateway.recovered"
      | "health.telemetry.stale"
      | "health.telemetry.recovered";
    deviceId: Id<"devices">;
    siteId: Id<"sites">;
    generatorId: Id<"generators"> | null;
    at: number;
  },
) {
  const organization = await ctx.db.get(args.organizationId);
  const site = await ctx.db.get(args.siteId);
  const device = await ctx.db.get(args.deviceId);
  if (!organization || !site || !device || device.organizationId !== args.organizationId) {
    return { created: false, messageIds: [] as Id<"messages">[] };
  }
  const titles: Record<typeof args.event, string> = {
    "health.gateway.offline": `Gateway offline — ${device.name}`,
    "health.gateway.recovered": `Gateway recovered — ${device.name}`,
    "health.telemetry.stale": `Telemetry stale — ${device.name}`,
    "health.telemetry.recovered": `Telemetry recovered — ${device.name}`,
  };
  const bodies: Record<typeof args.event, string> = {
    "health.gateway.offline": `No gateway contact at ${site.name} for device ${device.name}.`,
    "health.gateway.recovered": `Gateway contact restored for ${device.name} at ${site.name}.`,
    "health.telemetry.stale": `Stored telemetry for ${device.name} at ${site.name} is older than three minutes.`,
    "health.telemetry.recovered": `Fresh telemetry resumed for ${device.name} at ${site.name}.`,
  };
  const severity =
    args.event === "health.gateway.offline" || args.event === "health.telemetry.stale"
      ? ("warning" as const)
      : ("informational" as const);
  const title = titles[args.event];
  const body = bodies[args.event];
  return await emitNotificationEvent(ctx, {
    organizationId: args.organizationId,
    event: args.event,
    severity,
    title,
    body,
    idempotencyKey: `health:${args.deviceId}:${args.event}:${args.at}`,
    siteId: args.siteId,
    deviceId: args.deviceId,
    generatorId: args.generatorId,
    emailSubject: title,
    emailHtml: [
      `<p>${body}</p>`,
      `<p>Organization: ${organization.name}</p>`,
      `<p>Site: ${site.name}</p>`,
      `<p>Device: ${device.name}</p>`,
      `<p>Open: /gateways/${args.deviceId}</p>`,
    ].join("\n"),
    smsBody: `iCanOva ${args.event}: ${device.name} @ ${site.name}`,
  });
}

export const checkEscalation = internalMutation({
  args: {
    alarmId: v.id("alarms"),
    dueAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const alarm = await ctx.db.get(args.alarmId);
    if (!alarm) {
      return { status: "missing" as const };
    }
    if (alarm.state !== "active" || alarm.acknowledgedAt !== null) {
      return { status: "stopped" as const };
    }
    const settings = await orgSettings(ctx, alarm.organizationId);
    if (
      settings.escalateAfterMinutes === null ||
      !Number.isFinite(settings.escalateAfterMinutes) ||
      settings.escalateAfterMinutes <= 0
    ) {
      return { status: "disabled" as const };
    }
    const dueAt =
      args.dueAt ?? alarm.raisedAt + Math.floor(settings.escalateAfterMinutes * 60_000);
    const remaining = dueAt - Date.now();
    if (remaining > 0) {
      await ctx.scheduler.runAfter(remaining, internal.notifyEmit.checkEscalation, {
        alarmId: args.alarmId,
        dueAt,
      });
      return { status: "rescheduled" as const, remaining };
    }
    return {
      status: "escalated" as const,
      ...(await emitForAlarm(ctx, alarm, "alarm.raised", `alarm:${alarm._id}:escalation:1`, true)),
    };
  },
});

function leaseExpired(message: Doc<"messages">, now: number): boolean {
  if (message.status !== "processing") {
    return false;
  }
  const expires = message.leaseExpiresAt ?? (message.lastAttemptAt ?? 0) + DELIVERY_LEASE_MS;
  return expires <= now;
}

export const claimMessage = internalMutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      return null;
    }
    if (
      message.status === "sent" ||
      message.status === "cancelled" ||
      message.status === "suppressed" ||
      message.status === "uncertain"
    ) {
      return null;
    }
    if (message.status === "not_configured") {
      return null;
    }
    const now = Date.now();
    if (message.status === "processing" && !leaseExpired(message, now)) {
      return null;
    }
    if (message.alarmId && message.event?.startsWith("alarm.")) {
      const alarm = await ctx.db.get(message.alarmId);
      if (!alarm) {
        await ctx.db.patch(message._id, {
          status: "cancelled",
          failureCategory: "cancelled",
          error: "Alarm missing",
        });
        return null;
      }
      if (message.event === "alarm.raised" && (alarm.state === "cleared" || alarm.state === "resolved")) {
        await ctx.db.patch(message._id, {
          status: "cancelled",
          failureCategory: "cancelled",
          error: "Alarm no longer active",
        });
        return null;
      }
    }
    const reclaiming = message.status === "processing";
    const attempt = reclaiming ? message.attempt : message.attempt + 1;
    const claimGeneration = (message.claimGeneration ?? 0) + 1;
    const leaseExpiresAt = now + DELIVERY_LEASE_MS;
    await ctx.db.patch(message._id, {
      status: "processing",
      attempt,
      claimGeneration,
      leaseExpiresAt,
      lastAttemptAt: now,
      failureCategory: undefined,
      error: reclaiming ? "Reclaimed expired processing lease" : undefined,
    });
    await ctx.scheduler.runAfter(DELIVERY_LEASE_MS + 1_000, internal.notifyEmit.reclaimIfStale, {
      messageId: message._id,
      claimGeneration,
    });
    return {
      messageId: message._id,
      organizationId: message.organizationId,
      channel: message.channel,
      to: message.to,
      subject: message.subject,
      body: message.body,
      attempt,
      claimGeneration,
      idempotencyKey: message.idempotencyKey ?? `message:${message._id}`,
      status: "processing" as const,
    };
  },
});

export const reclaimIfStale = internalMutation({
  args: {
    messageId: v.id("messages"),
    claimGeneration: v.number(),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      return { status: "missing" as const };
    }
    if (message.status !== "processing" || (message.claimGeneration ?? 0) !== args.claimGeneration) {
      return { status: "ignored" as const };
    }
    if (!leaseExpired(message, Date.now())) {
      return { status: "leased" as const };
    }
    await ctx.db.patch(message._id, {
      status: "pending",
      leaseExpiresAt: undefined,
      nextAttemptAt: Date.now(),
      error: "Processing lease expired",
      failureCategory: "uncertain",
    });
    await ctx.scheduler.runAfter(0, internal.notify.deliverMessage, { messageId: message._id });
    return { status: "reclaimed" as const };
  },
});

export const completeMessage = internalMutation({
  args: {
    messageId: v.id("messages"),
    claimGeneration: v.number(),
    status: v.string(),
    providerId: v.optional(v.string()),
    error: v.optional(v.string()),
    failureCategory: v.optional(
      v.union(
        v.literal("rejected"),
        v.literal("uncertain"),
        v.literal("not_configured"),
        v.literal("cancelled"),
        v.literal("suppressed"),
      ),
    ),
    scheduleRetry: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      return { status: "missing" as const };
    }
    if ((message.claimGeneration ?? 0) !== args.claimGeneration) {
      return { status: "stale" as const };
    }
    if (message.status !== "processing") {
      return { status: "ignored" as const };
    }
    await ctx.db.patch(message._id, {
      status: args.status,
      providerId: args.providerId,
      error: args.error?.slice(0, 300),
      failureCategory: args.failureCategory,
      lastAttemptAt: Date.now(),
      leaseExpiresAt: undefined,
    });
    // Uncertain outcomes may already have been accepted by the provider.
    // Automatic retry is only safe for definite rejections.
    if (
      args.scheduleRetry &&
      args.status === "failed" &&
      args.failureCategory === "rejected" &&
      message.attempt < MAX_ATTEMPTS
    ) {
      const delay = BACKOFF_MS[Math.min(message.attempt - 1, BACKOFF_MS.length - 1)] ?? 180_000;
      await ctx.db.patch(message._id, {
        status: "pending",
        nextAttemptAt: Date.now() + delay,
      });
      await ctx.scheduler.runAfter(delay, internal.notify.deliverMessage, {
        messageId: message._id,
      });
    }
    return { status: "completed" as const, messageId: message._id };
  },
});
