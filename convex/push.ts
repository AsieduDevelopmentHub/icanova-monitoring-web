/**
 * VAPID Web Push subscription ownership APIs.
 * Private key stays in Convex env; only the public key is exposed to authenticated clients.
 */
import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { writeAudit } from "./audits";
import { requireAnyPermission } from "./identity";
import { vapidConfigured } from "./delivery";

function vapidEnv() {
  return {
    publicKey: process.env.VAPID_PUBLIC_KEY ?? null,
    privateKey: process.env.VAPID_PRIVATE_KEY ?? null,
    subject: process.env.VAPID_SUBJECT ?? null,
  };
}

function assertHttpsEndpoint(endpoint: string) {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error("Invalid push endpoint");
  }
  if (url.protocol !== "https:") {
    throw new Error("Push endpoint must be HTTPS");
  }
  if (endpoint.length < 20 || endpoint.length > 2048) {
    throw new Error("Push endpoint length is invalid");
  }
  return endpoint;
}

function assertKeyMaterial(value: string, label: string) {
  const text = value.trim();
  if (text.length < 8 || text.length > 512) {
    throw new Error(`${label} is invalid`);
  }
  if (!/^[A-Za-z0-9_\-=]+$/.test(text)) {
    throw new Error(`${label} is invalid`);
  }
  return text;
}

/** Authenticated clients may read the public VAPID key when configured. Private key never leaves env. */
export const vapidPublicKey = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireAnyPermission(ctx, args.organizationId, [
      "view.dashboard",
      "configure.notifications",
    ]);
    const env = vapidEnv();
    const configured = vapidConfigured(env);
    return {
      configured,
      publicKey: configured ? env.publicKey!.trim() : null,
      subjectConfigured: Boolean(env.subject?.trim()),
    };
  },
});

/** Status for the current user — never includes endpoints or encryption keys. */
export const mySubscriptionStatus = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const { user } = await requireAnyPermission(ctx, args.organizationId, [
      "view.dashboard",
      "configure.notifications",
    ]);
    const rows = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", user._id),
      )
      .take(20);
    const active = rows.filter((row) => row.status === "active");
    return {
      activeCount: active.length,
      subscriptions: active.map((row) => ({
        id: row._id,
        createdAt: row.createdAt,
        userAgentLabel: row.userAgentLabel ?? null,
        lastSuccessAt: row.lastSuccessAt ?? null,
        lastFailureAt: row.lastFailureAt ?? null,
      })),
      vapidConfigured: vapidConfigured(vapidEnv()),
    };
  },
});

export const subscribe = mutation({
  args: {
    organizationId: v.id("organizations"),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    expirationTime: v.union(v.number(), v.null()),
    userAgentLabel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAnyPermission(ctx, args.organizationId, [
      "view.dashboard",
      "configure.notifications",
    ]);
    if (!vapidConfigured(vapidEnv())) {
      throw new Error("Browser push is not configured on this deployment");
    }
    const endpoint = assertHttpsEndpoint(args.endpoint.trim());
    const p256dh = assertKeyMaterial(args.p256dh, "p256dh");
    const auth = assertKeyMaterial(args.auth, "auth");
    const label = args.userAgentLabel?.trim().slice(0, 120) || undefined;
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_user_endpoint", (q) => q.eq("userId", user._id).eq("endpoint", endpoint))
      .unique();
    const now = Date.now();
    if (existing) {
      if (existing.userId !== user._id) {
        throw new Error("Forbidden");
      }
      await ctx.db.patch(existing._id, {
        organizationId: args.organizationId,
        p256dh,
        auth,
        expirationTime: args.expirationTime,
        userAgentLabel: label,
        status: "active",
        lastFailureAt: undefined,
        lastFailureReason: undefined,
      });
      await writeAudit(ctx, args.organizationId, "push.subscribe", existing._id);
      return existing._id;
    }
    const id = await ctx.db.insert("pushSubscriptions", {
      organizationId: args.organizationId,
      userId: user._id,
      endpoint,
      p256dh,
      auth,
      expirationTime: args.expirationTime,
      userAgentLabel: label,
      status: "active",
      createdAt: now,
    });
    await writeAudit(ctx, args.organizationId, "push.subscribe", id);
    return id;
  },
});

export const unsubscribe = mutation({
  args: {
    organizationId: v.id("organizations"),
    subscriptionId: v.optional(v.id("pushSubscriptions")),
    endpoint: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAnyPermission(ctx, args.organizationId, [
      "view.dashboard",
      "configure.notifications",
    ]);
    let row = args.subscriptionId ? await ctx.db.get(args.subscriptionId) : null;
    if (!row && args.endpoint) {
      row = await ctx.db
        .query("pushSubscriptions")
        .withIndex("by_user_endpoint", (q) =>
          q.eq("userId", user._id).eq("endpoint", args.endpoint!.trim()),
        )
        .unique();
    }
    if (!row || row.userId !== user._id || row.organizationId !== args.organizationId) {
      throw new Error("Forbidden");
    }
    await ctx.db.patch(row._id, {
      status: "disabled",
      lastFailureAt: Date.now(),
      lastFailureReason: "User unsubscribed",
    });
    await writeAudit(ctx, args.organizationId, "push.unsubscribe", row._id);
    return row._id;
  },
});

export const unsubscribeAll = mutation({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const { user } = await requireAnyPermission(ctx, args.organizationId, [
      "view.dashboard",
      "configure.notifications",
    ]);
    const rows = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", user._id),
      )
      .take(40);
    const now = Date.now();
    let count = 0;
    for (const row of rows) {
      if (row.status === "active") {
        await ctx.db.patch(row._id, {
          status: "disabled",
          lastFailureAt: now,
          lastFailureReason: "User disabled browser push",
        });
        count += 1;
      }
    }
    await writeAudit(ctx, args.organizationId, "push.unsubscribeAll", user._id);
    return count;
  },
});

/** Internal only — used by the Node delivery action. Never expose via public API. */
export const getSubscriptionInternal = internalQuery({
  args: { subscriptionId: v.id("pushSubscriptions") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.subscriptionId);
    if (!row) {
      return null;
    }
    return {
      _id: row._id,
      status: row.status,
      endpoint: row.endpoint,
      p256dh: row.p256dh,
      auth: row.auth,
      expirationTime: row.expirationTime,
    };
  },
});

/** Called from the push delivery action when the push service reports gone/invalid. */
export const markSubscriptionInvalid = internalMutation({
  args: {
    subscriptionId: v.id("pushSubscriptions"),
    reason: v.string(),
    expired: v.boolean(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.subscriptionId);
    if (!row) {
      return { status: "missing" as const };
    }
    await ctx.db.patch(row._id, {
      status: args.expired ? "expired" : "disabled",
      lastFailureAt: Date.now(),
      lastFailureReason: args.reason.slice(0, 200),
    });
    return { status: "updated" as const };
  },
});

export const recordSubscriptionDelivery = internalMutation({
  args: {
    subscriptionId: v.id("pushSubscriptions"),
    ok: v.boolean(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.subscriptionId);
    if (!row) {
      return { status: "missing" as const };
    }
    if (args.ok) {
      await ctx.db.patch(row._id, { lastSuccessAt: Date.now() });
    } else {
      await ctx.db.patch(row._id, {
        lastFailureAt: Date.now(),
        lastFailureReason: args.reason?.slice(0, 200),
      });
    }
    return { status: "updated" as const };
  },
});
