/**
 * Organization policies, personal preferences, in-app inbox, and delivery history.
 * Alarm lifecycle emits through notifyEmit. Provider I/O runs in notify actions.
 */
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { writeAudit } from "./audits";
import { requireAnyPermission, requirePermission } from "./identity";
import { notConfiguredError, providerDecision, vapidConfigured } from "./delivery";
import { MAX_ATTEMPTS, boundedPage } from "./limits";
import { requireSite } from "./sites";

const channel = v.union(
  v.literal("email"),
  v.literal("sms"),
  v.literal("push"),
  v.literal("inapp"),
);
const eventName = v.union(
  v.literal("alarm.raised"),
  v.literal("alarm.acknowledged"),
  v.literal("alarm.cleared"),
  v.literal("device.registered"),
  v.literal("maintenance.recorded"),
  v.literal("health.gateway.offline"),
  v.literal("health.gateway.recovered"),
  v.literal("health.telemetry.stale"),
  v.literal("health.telemetry.recovered"),
);
const severity = v.union(
  v.literal("critical"),
  v.literal("warning"),
  v.literal("informational"),
);

type Channel = "email" | "sms" | "push" | "inapp";

function currentDecision(kind: Channel) {
  if (kind === "inapp") {
    return "send" as const;
  }
  return providerDecision(kind === "push" ? "push" : kind, {
    resend: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM),
    arkesel: Boolean(process.env.ARKESEL_API_KEY && process.env.ARKESEL_SENDER),
    vapid: vapidConfigured({
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
      subject: process.env.VAPID_SUBJECT,
    }),
  });
}

export const listPolicies = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    try {
      await requirePermission(ctx, args.organizationId, "configure.notifications");
    } catch {
      return [];
    }
    return await ctx.db
      .query("notificationPolicies")
      .withIndex("by_org_event", (q) => q.eq("organizationId", args.organizationId))
      .take(80);
  },
});

export const savePolicy = mutation({
  args: {
    organizationId: v.id("organizations"),
    channel,
    event: eventName,
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "configure.notifications");
    const existing = await ctx.db
      .query("notificationPolicies")
      .withIndex("by_org_event", (q) =>
        q.eq("organizationId", args.organizationId).eq("event", args.event),
      )
      .take(20);
    const match = existing.find((policy) => policy.channel === args.channel);
    if (match) {
      if (match.organizationId !== args.organizationId) {
        throw new Error("Forbidden");
      }
      await ctx.db.patch(match._id, { enabled: args.enabled });
      await writeAudit(ctx, args.organizationId, "notification.policy", match._id);
      return match._id;
    }
    const policyId = await ctx.db.insert("notificationPolicies", args);
    await writeAudit(ctx, args.organizationId, "notification.policy", policyId);
    return policyId;
  },
});

export const getSettings = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    try {
      await requirePermission(ctx, args.organizationId, "configure.notifications");
    } catch {
      return null;
    }
    const row = await ctx.db
      .query("notificationSettings")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .unique();
    return {
      minSeverity: row?.minSeverity ?? "warning",
      escalateAfterMinutes: row?.escalateAfterMinutes ?? null,
    };
  },
});

export const saveSettings = mutation({
  args: {
    organizationId: v.id("organizations"),
    minSeverity: severity,
    escalateAfterMinutes: v.union(v.number(), v.null()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "configure.notifications");
    if (
      args.escalateAfterMinutes !== null &&
      (!Number.isFinite(args.escalateAfterMinutes) ||
        args.escalateAfterMinutes < 1 ||
        args.escalateAfterMinutes > 24 * 60)
    ) {
      throw new Error("Escalation minutes must be 1 to 1440, or null");
    }
    const existing = await ctx.db
      .query("notificationSettings")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .unique();
    const fields = {
      minSeverity: args.minSeverity,
      escalateAfterMinutes: args.escalateAfterMinutes,
    };
    if (existing) {
      await ctx.db.patch(existing._id, fields);
      await writeAudit(ctx, args.organizationId, "notification.settings", existing._id);
      return existing._id;
    }
    const id = await ctx.db.insert("notificationSettings", {
      organizationId: args.organizationId,
      ...fields,
    });
    await writeAudit(ctx, args.organizationId, "notification.settings", id);
    return id;
  },
});

export const savePreference = mutation({
  args: {
    organizationId: v.id("organizations"),
    email: v.union(v.string(), v.null()),
    phone: v.union(v.string(), v.null()),
    emailEnabled: v.boolean(),
    smsEnabled: v.boolean(),
    pushEnabled: v.boolean(),
    inAppEnabled: v.optional(v.boolean()),
    minSeverity: v.optional(severity),
    subscribedSiteIds: v.optional(v.array(v.id("sites"))),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAnyPermission(ctx, args.organizationId, [
      "view.dashboard",
      "configure.notifications",
    ]);
    const email = cleanDestination(args.email);
    const phone = cleanDestination(args.phone);
    const siteIds = args.subscribedSiteIds ?? [];
    for (const siteId of siteIds) {
      await requireSite(ctx, args.organizationId, siteId);
    }
    const existing = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", user._id),
      )
      .unique();
    const fields = {
      email,
      phone,
      emailEnabled: args.emailEnabled,
      smsEnabled: args.smsEnabled,
      pushEnabled: args.pushEnabled,
      inAppEnabled: args.inAppEnabled ?? true,
      minSeverity: args.minSeverity ?? "informational",
      subscribedSiteIds: siteIds,
    };
    if (existing) {
      await ctx.db.patch(existing._id, fields);
      await writeAudit(ctx, args.organizationId, "notification.preference", existing._id);
      return existing._id;
    }
    const preferenceId = await ctx.db.insert("notificationPreferences", {
      organizationId: args.organizationId,
      userId: user._id,
      ...fields,
    });
    await writeAudit(ctx, args.organizationId, "notification.preference", preferenceId);
    return preferenceId;
  },
});

export const myPreference = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const { user } = await requireAnyPermission(ctx, args.organizationId, [
      "view.dashboard",
      "configure.notifications",
    ]);
    return await ctx.db
      .query("notificationPreferences")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", user._id),
      )
      .unique();
  },
});

export const unreadCount = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const { user } = await requireAnyPermission(ctx, args.organizationId, [
      "view.dashboard",
      "view.alarms",
    ]);
    const rows = await ctx.db
      .query("userNotifications")
      .withIndex("by_org_user_created", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", user._id),
      )
      .order("desc")
      .take(100);
    return rows.filter((row) => row.readAt == null).length;
  },
});

export const listInbox = query({
  args: {
    organizationId: v.id("organizations"),
    unreadOnly: v.boolean(),
    event: v.union(v.string(), v.null()),
    severity: v.union(severity, v.literal("all")),
    siteId: v.union(v.id("sites"), v.null()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { user } = await requireAnyPermission(ctx, args.organizationId, [
      "view.dashboard",
      "view.alarms",
    ]);
    if (args.siteId) {
      await requireSite(ctx, args.organizationId, args.siteId);
    }
    const page = await ctx.db
      .query("userNotifications")
      .withIndex("by_org_user_created", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", user._id),
      )
      .order("desc")
      .paginate(boundedPage(args.paginationOpts));
    const filtered = page.page.filter((row) => {
      if (args.unreadOnly && row.readAt != null) {
        return false;
      }
      if (args.event && row.event !== args.event) {
        return false;
      }
      if (args.severity !== "all" && row.severity !== args.severity) {
        return false;
      }
      if (args.siteId && row.siteId !== args.siteId) {
        return false;
      }
      return true;
    });
    return { ...page, page: filtered };
  },
});

export const markRead = mutation({
  args: {
    organizationId: v.id("organizations"),
    notificationId: v.id("userNotifications"),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAnyPermission(ctx, args.organizationId, [
      "view.dashboard",
      "view.alarms",
    ]);
    const row = await ctx.db.get(args.notificationId);
    if (!row || row.organizationId !== args.organizationId || row.userId !== user._id) {
      throw new Error("Forbidden");
    }
    if (row.readAt == null) {
      await ctx.db.patch(row._id, { readAt: Date.now() });
    }
    return row._id;
  },
});

export const markAllRead = mutation({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const { user } = await requireAnyPermission(ctx, args.organizationId, [
      "view.dashboard",
      "view.alarms",
    ]);
    const rows = await ctx.db
      .query("userNotifications")
      .withIndex("by_org_user_created", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", user._id),
      )
      .order("desc")
      .take(100);
    const now = Date.now();
    let count = 0;
    for (const row of rows) {
      if (row.readAt == null) {
        await ctx.db.patch(row._id, { readAt: now });
        count += 1;
      }
    }
    return count;
  },
});

export const markUnread = mutation({
  args: {
    organizationId: v.id("organizations"),
    notificationId: v.id("userNotifications"),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAnyPermission(ctx, args.organizationId, [
      "view.dashboard",
      "view.alarms",
    ]);
    const row = await ctx.db.get(args.notificationId);
    if (!row || row.organizationId !== args.organizationId || row.userId !== user._id) {
      throw new Error("Forbidden");
    }
    if (row.readAt != null) {
      await ctx.db.patch(row._id, { readAt: null });
    }
    return row._id;
  },
});

/** Compact unread critical count for dashboard attention (creation ≠ delivery). */
export const unreadCriticalCount = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const { user } = await requireAnyPermission(ctx, args.organizationId, [
      "view.dashboard",
      "view.alarms",
    ]);
    const rows = await ctx.db
      .query("userNotifications")
      .withIndex("by_org_user_created", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", user._id),
      )
      .order("desc")
      .take(100);
    return rows.filter((row) => row.readAt == null && row.severity === "critical").length;
  },
});

export const listDeliveries = query({
  args: {
    organizationId: v.id("organizations"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "configure.notifications");
    const page = await ctx.db
      .query("messages")
      .withIndex("by_org_created", (q) => q.eq("organizationId", args.organizationId))
      .order("desc")
      .paginate(boundedPage(args.paginationOpts));
    return {
      ...page,
      page: page.page.map((row) => ({
        _id: row._id,
        channel: row.channel,
        // Never surface raw push endpoints; keep opaque label for push outbox rows.
        to: row.channel === "push" ? "browser subscription" : row.to,
        event: row.event ?? null,
        status: row.status,
        attempt: row.attempt,
        createdAt: row.createdAt,
        lastAttemptAt: row.lastAttemptAt ?? null,
        nextAttemptAt: row.nextAttemptAt ?? null,
        leaseExpiresAt: row.leaseExpiresAt ?? null,
        failureCategory: row.failureCategory ?? null,
        providerId: row.providerId ?? null,
        error: row.error ?? null,
        alarmId: row.alarmId ?? null,
        parentMessageId: row.parentMessageId ?? null,
        idempotencyKey: row.idempotencyKey ?? null,
      })),
    };
  },
});

export const requestDelivery = mutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    event: eventName,
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "configure.notifications");
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.userId),
      )
      .unique();
    if (!membership) {
      throw new Error("Forbidden");
    }
    const preference = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.userId),
      )
      .unique();
    const policies = await ctx.db
      .query("notificationPolicies")
      .withIndex("by_org_event", (q) =>
        q.eq("organizationId", args.organizationId).eq("event", args.event),
      )
      .take(20);
    const ids: Id<"messages">[] = [];
    for (const policy of policies) {
      if (!policy.enabled || policy.organizationId !== args.organizationId) {
        continue;
      }
      if (policy.channel === "inapp") {
        continue;
      }
      if (policy.channel === "push") {
        if (!preference?.pushEnabled) {
          continue;
        }
        const subscriptions = await ctx.db
          .query("pushSubscriptions")
          .withIndex("by_org_user", (q) =>
            q.eq("organizationId", args.organizationId).eq("userId", args.userId),
          )
          .take(20);
        const active = subscriptions.filter((row) => row.status === "active");
        const pushBody = JSON.stringify({
          title: "iCaNova notification",
          body: args.event,
          severity: "informational",
          event: args.event,
          path: "/notifications",
        });
        if (active.length === 0) {
          // Preference on but no browser subscription — record not_configured / rejected path for operators.
          const id = await insertAttempt(ctx, {
            organizationId: args.organizationId,
            channel: "push",
            to: "push",
            userId: args.userId,
            event: args.event,
            attempt: 1,
            body: pushBody,
            subject: "iCaNova notification",
          });
          ids.push(id);
          continue;
        }
        for (const subscription of active) {
          const id = await insertAttempt(ctx, {
            organizationId: args.organizationId,
            channel: "push",
            to: `push:${subscription._id}`,
            userId: args.userId,
            event: args.event,
            attempt: 1,
            body: pushBody,
            subject: "iCaNova notification",
          });
          ids.push(id);
          const row = await ctx.db.get(id);
          if (row?.status === "pending") {
            await ctx.scheduler.runAfter(0, internal.notify.deliverMessage, { messageId: id });
          }
        }
        continue;
      }
      const destination = destinationFor(policy.channel, preference);
      if (!destination.allowed) {
        continue;
      }
      const id = await insertAttempt(ctx, {
        organizationId: args.organizationId,
        channel: policy.channel,
        to: destination.to,
        userId: args.userId,
        event: args.event,
        attempt: 1,
        body: args.event,
      });
      ids.push(id);
      const row = await ctx.db.get(id);
      if (row?.status === "pending") {
        await ctx.scheduler.runAfter(0, internal.notify.deliverMessage, { messageId: id });
      }
    }
    await writeAudit(ctx, args.organizationId, "notification.request", args.userId);
    return ids;
  },
});

export const retryDelivery = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const previous = await ctx.db.get(args.messageId);
    if (!previous) {
      throw new Error("Not found");
    }
    await requirePermission(ctx, previous.organizationId, "configure.notifications");
    if (
      previous.status === "sent" ||
      previous.status === "processing" ||
      previous.status === "pending" ||
      previous.status === "cancelled" ||
      previous.status === "suppressed"
    ) {
      throw new Error("Invalid transition");
    }
    if (previous.attempt >= MAX_ATTEMPTS) {
      throw new Error("Attempt limit");
    }
    if (!previous.userId) {
      throw new Error("Message has no recipient");
    }
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", previous.organizationId).eq("userId", previous.userId!),
      )
      .unique();
    if (!membership) {
      throw new Error("Recipient is no longer a member");
    }
    const preference = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", previous.organizationId).eq("userId", previous.userId!),
      )
      .unique();
    const destination = destinationFor(previous.channel, preference);
    if (!destination.allowed) {
      throw new Error("Recipient preference disables this channel");
    }
    let retryTo = destination.to;
    if (previous.channel === "push") {
      if (previous.to.startsWith("push:")) {
        const subscriptionId = previous.to.slice(5) as Id<"pushSubscriptions">;
        const subscription = await ctx.db.get(subscriptionId);
        if (!subscription || subscription.status !== "active" || subscription.userId !== previous.userId) {
          throw new Error("Push subscription is no longer active");
        }
        retryTo = previous.to;
      } else {
        // Placeholder destination when preference is on but no browser subscription was stored.
        retryTo = "push";
      }
    }
    if (previous.event) {
      const policies = await ctx.db
        .query("notificationPolicies")
        .withIndex("by_org_event", (q) =>
          q.eq("organizationId", previous.organizationId).eq("event", previous.event as never),
        )
        .take(20);
      const policy = policies.find((row) => row.channel === previous.channel && row.enabled);
      if (!policy) {
        throw new Error("Event policy disables this channel");
      }
    }
    if (previous.siteId && preference?.subscribedSiteIds && preference.subscribedSiteIds.length > 0) {
      if (!preference.subscribedSiteIds.some((siteId) => siteId === previous.siteId)) {
        throw new Error("Recipient is not subscribed to this site");
      }
    }
    if (previous.alarmId) {
      const alarm = await ctx.db.get(previous.alarmId);
      if (!alarm) {
        throw new Error("Alarm missing");
      }
      if (
        previous.event === "alarm.raised" &&
        (alarm.state === "cleared" || alarm.state === "resolved" || alarm.state === "acknowledged")
      ) {
        throw new Error("Alarm no longer eligible for raised delivery");
      }
    }
    // Preserve the original event idempotency base so Resend can dedupe; attempt suffix distinguishes history rows.
    const baseKey = previous.idempotencyKey?.replace(/:retry:\d+$/, "") ?? `message:${previous._id}`;
    const id = await insertAttempt(ctx, {
      organizationId: previous.organizationId,
      channel: previous.channel,
      to: retryTo,
      userId: previous.userId,
      event: previous.event,
      attempt: previous.attempt + 1,
      body: previous.body,
      subject: previous.subject,
      alarmId: previous.alarmId,
      siteId: previous.siteId,
      generatorId: previous.generatorId,
      deviceId: previous.deviceId,
      idempotencyKey: `${baseKey}:retry:${previous.attempt + 1}`,
      parentMessageId: previous.parentMessageId ?? previous._id,
    });
    const row = await ctx.db.get(id);
    if (row?.status === "pending") {
      await ctx.scheduler.runAfter(0, internal.notify.deliverMessage, { messageId: id });
    }
    return id;
  },
});

function cleanDestination(value: string | null) {
  if (value === null) {
    return null;
  }
  const text = value.trim();
  if (text.length < 3 || text.length > 120) {
    throw new Error("Destination must be 3 to 120 characters");
  }
  return text;
}

function destinationFor(
  kind: Channel,
  preference: {
    email: string | null;
    phone: string | null;
    emailEnabled: boolean;
    smsEnabled: boolean;
    pushEnabled: boolean;
  } | null,
): { allowed: boolean; to: string } {
  if (!preference) {
    return { allowed: false, to: "" };
  }
  if (kind === "email" && preference.emailEnabled && preference.email) {
    return { allowed: true, to: preference.email };
  }
  if (kind === "sms" && preference.smsEnabled && preference.phone) {
    return { allowed: true, to: preference.phone };
  }
  if (kind === "push" && preference.pushEnabled) {
    return { allowed: true, to: "push" };
  }
  return { allowed: false, to: "" };
}

async function insertAttempt(
  ctx: MutationCtx,
  args: {
    organizationId: Id<"organizations">;
    channel: Exclude<Channel, "inapp">;
    to: string;
    userId?: Id<"users">;
    event?: string;
    attempt: number;
    body: string;
    subject?: string;
    alarmId?: Id<"alarms">;
    siteId?: Id<"sites">;
    generatorId?: Id<"generators">;
    deviceId?: Id<"devices">;
    idempotencyKey?: string;
    parentMessageId?: Id<"messages">;
  },
) {
  const decision = currentDecision(args.channel);
  const status = decision === "send" ? "pending" : "not_configured";
  return await ctx.db.insert("messages", {
    organizationId: args.organizationId,
    channel: args.channel,
    to: args.to,
    subject: args.subject,
    body: args.body,
    status,
    attempt: args.attempt,
    error: status === "not_configured" ? notConfiguredError(args.channel) : undefined,
    failureCategory: status === "not_configured" ? "not_configured" : undefined,
    event: args.event,
    createdAt: Date.now(),
    userId: args.userId,
    alarmId: args.alarmId,
    siteId: args.siteId,
    generatorId: args.generatorId,
    deviceId: args.deviceId,
    idempotencyKey: args.idempotencyKey,
    parentMessageId: args.parentMessageId,
  });
}
