import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { writeAudit } from "./audits";
import { requireAnyPermission, requirePermission } from "./auth";
import { requireDevice } from "./devices";
import { MAX_PAGE, boundedPage } from "./limits";
import { requireSite } from "./sites";

const kind = v.union(v.literal("controller"), v.literal("transport"));
const state = v.union(
  v.literal("active"),
  v.literal("acknowledged"),
  v.literal("cleared"),
  v.literal("resolved"),
);

type AlarmState = "active" | "acknowledged" | "cleared" | "resolved";

function cleanSearch(value: string) {
  const search = value.trim().toLowerCase();
  if (search.length > 80) {
    throw new Error("Search is too long");
  }
  return search;
}

function cleanText(value: string, label: string, max: number) {
  const text = value.trim();
  if (text.length < 1 || text.length > max) {
    throw new Error(`${label} must be 1 to ${max} characters`);
  }
  return text;
}

async function loadAlarm(ctx: QueryCtx | MutationCtx, alarmId: Id<"alarms">) {
  const alarm = await ctx.db.get(alarmId);
  if (!alarm) {
    throw new Error("Not found");
  }
  return alarm;
}

async function writeEvent(
  ctx: MutationCtx,
  alarm: { _id: Id<"alarms">; organizationId: Id<"organizations">; state: string },
  action: string,
  note: string | null,
  toState: AlarmState | null,
) {
  const identity = await ctx.auth.getUserIdentity();
  await ctx.db.insert("alarmEvents", {
    organizationId: alarm.organizationId,
    alarmId: alarm._id,
    action,
    actorToken: identity?.tokenIdentifier ?? "unknown",
    note,
    fromState: alarm.state,
    toState,
    at: Date.now(),
  });
  await writeAudit(ctx, alarm.organizationId, `alarm.${action}`, alarm._id);
}

export const list = query({
  args: {
    organizationId: v.id("organizations"),
    state: v.union(v.literal("all"), state),
    kind: v.union(v.literal("all"), kind),
    deviceId: v.union(v.id("devices"), v.null()),
    search: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "view.alarms");
    if (args.deviceId) {
      await requireDevice(ctx, args.organizationId, args.deviceId);
    }
    const search = cleanSearch(args.search);
    const filtered = args.state !== "all" || args.kind !== "all" || args.deviceId !== null || search !== "";
    const indexed = ctx.db
      .query("alarms")
      .withIndex("by_org_raised", (q) => q.eq("organizationId", args.organizationId))
      .order("desc");
    if (!filtered) {
      const page = await indexed.paginate(boundedPage(args.paginationOpts));
      return { rows: page.page, capped: false, isDone: page.isDone, continueCursor: page.continueCursor };
    }
    const batch = await indexed.take(200);
    const rows = batch
      .filter((alarm) => {
        if (args.state !== "all" && alarm.state !== args.state) {
          return false;
        }
        if (args.kind !== "all" && alarm.kind !== args.kind) {
          return false;
        }
        if (args.deviceId && alarm.deviceId !== args.deviceId) {
          return false;
        }
        if (!search) {
          return true;
        }
        return `${alarm.summary} ${alarm.detail} ${alarm.kind} ${alarm.state}`.toLowerCase().includes(search);
      })
      .slice(0, MAX_PAGE);
    return { rows, capped: batch.length === 200, isDone: true, continueCursor: null };
  },
});

export const detail = query({
  args: { alarmId: v.id("alarms") },
  handler: async (ctx, args) => {
    const alarm = await loadAlarm(ctx, args.alarmId);
    await requirePermission(ctx, alarm.organizationId, "view.alarms");
    const comments = await ctx.db
      .query("alarmComments")
      .withIndex("by_alarm", (q) => q.eq("alarmId", alarm._id))
      .take(MAX_PAGE);
    const events = await ctx.db
      .query("alarmEvents")
      .withIndex("by_alarm_time", (q) => q.eq("alarmId", alarm._id))
      .take(MAX_PAGE);
    if (
      comments.some((comment) => comment.organizationId !== alarm.organizationId) ||
      events.some((event) => event.organizationId !== alarm.organizationId)
    ) {
      throw new Error("Forbidden");
    }
    return { alarm, comments, events };
  },
});

export const members = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireAnyPermission(ctx, args.organizationId, ["manage.alarms", "manage.users"]);
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) => q.eq("organizationId", args.organizationId))
      .take(MAX_PAGE);
    const rows = [];
    for (const membership of memberships) {
      const user = await ctx.db.get(membership.userId);
      if (!user) {
        continue;
      }
      rows.push({
        userId: user._id,
        name: user.name ?? user.email ?? user._id,
      });
    }
    return rows;
  },
});

export const raise = mutation({
  args: {
    organizationId: v.id("organizations"),
    siteId: v.id("sites"),
    deviceId: v.id("devices"),
    generatorId: v.union(v.id("generators"), v.null()),
    kind,
    summary: v.string(),
    detail: v.string(),
    sourceTime: v.union(v.number(), v.null()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "manage.alarms");
    await requireSite(ctx, args.organizationId, args.siteId);
    const device = await requireDevice(ctx, args.organizationId, args.deviceId);
    if (device.siteId !== args.siteId) {
      throw new Error("Forbidden");
    }
    if (args.generatorId) {
      const generator = await ctx.db.get(args.generatorId);
      if (
        !generator ||
        generator.organizationId !== args.organizationId ||
        generator.deviceId !== args.deviceId
      ) {
        throw new Error("Forbidden");
      }
    }
    if (args.sourceTime !== null && !Number.isFinite(args.sourceTime)) {
      throw new Error("Invalid sample");
    }
    const alarmId = await ctx.db.insert("alarms", {
      organizationId: args.organizationId,
      siteId: args.siteId,
      deviceId: args.deviceId,
      generatorId: args.generatorId,
      kind: args.kind,
      state: "active",
      summary: cleanText(args.summary, "Summary", 160),
      detail: cleanText(args.detail, "Detail", 500),
      raisedAt: Date.now(),
      sourceTime: args.sourceTime,
      acknowledgedAt: null,
      acknowledgedBy: null,
      assignedTo: null,
      clearedAt: null,
      resolvedAt: null,
      resolvedBy: null,
    });
    const alarm = await ctx.db.get(alarmId);
    if (!alarm) {
      throw new Error("Not found");
    }
    await writeEvent(ctx, alarm, "raise", null, "active");
    return alarmId;
  },
});

export const acknowledge = mutation({
  args: { alarmId: v.id("alarms") },
  handler: async (ctx, args) => {
    const alarm = await loadAlarm(ctx, args.alarmId);
    const { user } = await requirePermission(ctx, alarm.organizationId, "manage.alarms");
    if (alarm.state !== "active") {
      throw new Error("Invalid transition");
    }
    await ctx.db.patch(alarm._id, {
      state: "acknowledged",
      acknowledgedAt: Date.now(),
      acknowledgedBy: user._id,
    });
    await writeEvent(ctx, alarm, "acknowledge", null, "acknowledged");
    return alarm._id;
  },
});

export const assign = mutation({
  args: {
    alarmId: v.id("alarms"),
    userId: v.union(v.id("users"), v.null()),
  },
  handler: async (ctx, args) => {
    const alarm = await loadAlarm(ctx, args.alarmId);
    await requirePermission(ctx, alarm.organizationId, "manage.alarms");
    if (alarm.state === "resolved") {
      throw new Error("Invalid transition");
    }
    const assignee = args.userId;
    if (assignee) {
      const membership = await ctx.db
        .query("memberships")
        .withIndex("by_org_user", (q) =>
          q.eq("organizationId", alarm.organizationId).eq("userId", assignee),
        )
        .unique();
      if (!membership) {
        throw new Error("Forbidden");
      }
    }
    await ctx.db.patch(alarm._id, { assignedTo: args.userId });
    await writeEvent(
      ctx,
      alarm,
      "assign",
      args.userId ? String(args.userId) : "unassigned",
      null,
    );
    return alarm._id;
  },
});

export const comment = mutation({
  args: { alarmId: v.id("alarms"), body: v.string() },
  handler: async (ctx, args) => {
    const alarm = await loadAlarm(ctx, args.alarmId);
    const { user } = await requirePermission(ctx, alarm.organizationId, "manage.alarms");
    const body = cleanText(args.body, "Comment", 500);
    const commentId = await ctx.db.insert("alarmComments", {
      organizationId: alarm.organizationId,
      alarmId: alarm._id,
      authorId: user._id,
      body,
      at: Date.now(),
    });
    await writeEvent(ctx, alarm, "comment", body, null);
    return commentId;
  },
});

export const clear = mutation({
  args: { alarmId: v.id("alarms") },
  handler: async (ctx, args) => {
    const alarm = await loadAlarm(ctx, args.alarmId);
    await requirePermission(ctx, alarm.organizationId, "manage.alarms");
    if (alarm.state !== "active" && alarm.state !== "acknowledged") {
      throw new Error("Invalid transition");
    }
    await ctx.db.patch(alarm._id, { state: "cleared", clearedAt: Date.now() });
    await writeEvent(ctx, alarm, "clear", null, "cleared");
    return alarm._id;
  },
});

export const resolve = mutation({
  args: { alarmId: v.id("alarms") },
  handler: async (ctx, args) => {
    const alarm = await loadAlarm(ctx, args.alarmId);
    const { user } = await requirePermission(ctx, alarm.organizationId, "manage.alarms");
    if (alarm.state !== "acknowledged" && alarm.state !== "cleared") {
      throw new Error("Invalid transition");
    }
    await ctx.db.patch(alarm._id, {
      state: "resolved",
      resolvedAt: Date.now(),
      resolvedBy: user._id,
    });
    await writeEvent(ctx, alarm, "resolve", null, "resolved");
    return alarm._id;
  },
});
