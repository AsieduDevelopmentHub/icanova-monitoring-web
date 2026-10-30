/**
 * Policies and preferences are stored for a later delivery phase.
 * Ingest must not call sendEmail or sendSms. A future phase may emit one
 * alarm.raised notice when a new alarm row is inserted, never once per sample.
 * Email and SMS stay operator-requested and are not sent from this phase.
 */
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { writeAudit } from "./audits";
import { requireAnyPermission, requirePermission, userByToken } from "./auth";
import { notConfiguredError, providerDecision } from "./delivery";
import { MAX_ATTEMPTS, boundedPage } from "./limits";

const channel = v.union(v.literal("email"), v.literal("sms"), v.literal("push"));
const eventName = v.union(v.literal("alarm.raised"), v.literal("maintenance.recorded"));

type Channel = "email" | "sms" | "push";

function currentDecision(kind: Channel) {
  return providerDecision(kind, {
    resend: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM),
    arkesel: Boolean(process.env.ARKESEL_API_KEY && process.env.ARKESEL_SENDER),
  });
}

export const listPolicies = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "configure.notifications");
    return await ctx.db
      .query("notificationPolicies")
      .withIndex("by_org_event", (q) => q.eq("organizationId", args.organizationId))
      .take(50);
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
      .take(10);
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

export const savePreference = mutation({
  args: {
    organizationId: v.id("organizations"),
    email: v.union(v.string(), v.null()),
    phone: v.union(v.string(), v.null()),
    emailEnabled: v.boolean(),
    smsEnabled: v.boolean(),
    pushEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAnyPermission(ctx, args.organizationId, [
      "view.dashboard",
      "configure.notifications",
    ]);
    const email = cleanDestination(args.email);
    const phone = cleanDestination(args.phone);
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }
    await requireAnyPermission(ctx, args.organizationId, [
      "view.dashboard",
      "configure.notifications",
    ]);
    const user = await userByToken(ctx, identity.tokenIdentifier);
    if (!user) {
      throw new Error("Forbidden");
    }
    return await ctx.db
      .query("notificationPreferences")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", user._id),
      )
      .unique();
  },
});

export const listDeliveries = query({
  args: {
    organizationId: v.id("organizations"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "configure.notifications");
    return await ctx.db
      .query("messages")
      .withIndex("by_org_created", (q) => q.eq("organizationId", args.organizationId))
      .order("desc")
      .paginate(boundedPage(args.paginationOpts));
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
      .take(10);
    const ids = [];
    for (const policy of policies) {
      if (!policy.enabled || policy.organizationId !== args.organizationId) {
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
        event: args.event,
        attempt: 1,
        body: args.event,
      });
      ids.push(id);
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
    if (previous.status === "sent" || previous.status === "queued") {
      throw new Error("Invalid transition");
    }
    if (previous.attempt >= MAX_ATTEMPTS) {
      throw new Error("Attempt limit");
    }
    return await insertAttempt(ctx, {
      organizationId: previous.organizationId,
      channel: previous.channel,
      to: previous.to,
      event: previous.event,
      attempt: previous.attempt + 1,
      body: previous.body,
      subject: previous.subject,
    });
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
  ctx: { db: { insert: Function } },
  args: {
    organizationId: import("./_generated/dataModel").Id<"organizations">;
    channel: Channel;
    to: string;
    event?: string;
    attempt: number;
    body: string;
    subject?: string;
  },
) {
  const decision = currentDecision(args.channel);
  const status = decision === "send" ? "queued" : "not_configured";
  const id = await ctx.db.insert("messages", {
    organizationId: args.organizationId,
    channel: args.channel,
    to: args.to,
    subject: args.subject,
    body: args.body,
    status,
    attempt: args.attempt,
    error: status === "not_configured" ? notConfiguredError(args.channel) : undefined,
    event: args.event,
    createdAt: Date.now(),
  });
  return id;
}
