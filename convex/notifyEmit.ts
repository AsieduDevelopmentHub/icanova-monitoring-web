import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { isPermission, type Permission } from "./permissions";
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
] as const;

export type NotifyEvent = (typeof NOTIFY_EVENTS)[number];

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
  return event === "device.registered" ? "manage.devices" : "view.alarms";
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
    await ctx.scheduler.runAfter(
      Math.floor(settings.escalateAfterMinutes * 60_000),
      internal.notifyEmit.checkEscalation,
      { alarmId: args.alarmId },
    );
  }
  return { created: true, messageIds };
}

async function queueMessage(
  ctx: MutationCtx,
  args: {
    organizationId: Id<"organizations">;
    channel: "email" | "sms";
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
  const configured =
    args.channel === "email" ? resend : args.channel === "sms" ? arkesel : false;
  return await ctx.db.insert("messages", {
    organizationId: args.organizationId,
    channel: args.channel,
    to: args.to,
    subject: args.subject,
    body: args.body,
    status: configured ? "pending" : "not_configured",
    attempt: 0,
    error: configured ? undefined : args.channel === "email" ? "Resend is not configured" : "Arkesel is not configured",
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

export const checkEscalation = internalMutation({
  args: { alarmId: v.id("alarms") },
  handler: async (ctx, args) => {
    const alarm = await ctx.db.get(args.alarmId);
    if (!alarm) {
      return { status: "missing" as const };
    }
    if (alarm.state !== "active" || alarm.acknowledgedAt !== null) {
      return { status: "stopped" as const };
    }
    return {
      status: "escalated" as const,
      ...(await emitForAlarm(ctx, alarm, "alarm.raised", `alarm:${alarm._id}:escalation:1`, true)),
    };
  },
});

export const claimMessage = internalMutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      return null;
    }
    if (message.status === "sent" || message.status === "cancelled" || message.status === "suppressed") {
      return null;
    }
    if (message.status === "processing") {
      return null;
    }
    if (message.status === "not_configured") {
      return null;
    }
    if (message.alarmId && message.event?.startsWith("alarm.")) {
      const alarm = await ctx.db.get(message.alarmId);
      if (!alarm) {
        await ctx.db.patch(message._id, { status: "cancelled", error: "Alarm missing" });
        return null;
      }
      if (message.event === "alarm.raised" && (alarm.state === "cleared" || alarm.state === "resolved")) {
        await ctx.db.patch(message._id, { status: "cancelled", error: "Alarm no longer active" });
        return null;
      }
    }
    const attempt = message.attempt + 1;
    await ctx.db.patch(message._id, {
      status: "processing",
      attempt,
      lastAttemptAt: Date.now(),
    });
    return {
      ...message,
      attempt,
      status: "processing" as const,
    };
  },
});

export const completeMessage = internalMutation({
  args: {
    messageId: v.id("messages"),
    status: v.string(),
    providerId: v.optional(v.string()),
    error: v.optional(v.string()),
    scheduleRetry: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      return null;
    }
    await ctx.db.patch(message._id, {
      status: args.status,
      providerId: args.providerId,
      error: args.error?.slice(0, 300),
      lastAttemptAt: Date.now(),
    });
    if (args.scheduleRetry && args.status === "failed" && message.attempt < 3) {
      const delay = BACKOFF_MS[Math.min(message.attempt - 1, BACKOFF_MS.length - 1)] ?? 180_000;
      await ctx.db.patch(message._id, {
        status: "pending",
        nextAttemptAt: Date.now() + delay,
      });
      await ctx.scheduler.runAfter(delay, internal.notify.deliverMessage, {
        messageId: message._id,
      });
    }
    return message._id;
  },
});
