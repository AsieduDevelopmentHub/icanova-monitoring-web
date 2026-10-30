import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { writeAudit } from "./audits";
import { requireAnyPermission, requirePermission } from "./auth";
import { requireDevice } from "./devices";
import { MAX_PAGE, boundedPage } from "./limits";
import { emitForAlarm } from "./notifyEmit";
import { requireSite } from "./sites";

/** Stable id for the only automatic alarm. It is a link transition, not a DSE name. */
export const COMM_LINK_FAIL = "comm.link.fail";

const COMM_SUMMARY = "Controller communication failed";
const COMM_DETAIL =
  "The gateway reported link fail after link ok on the same boot. This is a communication fault, not a generator alarm and not an engine stop.";

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

type AlarmCategory = "generator" | "communication" | "gateway";
type AlarmSeverity = "critical" | "warning" | "informational";

function derivedCategory(alarm: Doc<"alarms">): AlarmCategory {
  if (
    alarm.category === "generator" ||
    alarm.category === "communication" ||
    alarm.category === "gateway"
  ) {
    return alarm.category;
  }
  return alarm.kind === "controller" ? "generator" : "communication";
}

function derivedSeverity(alarm: Doc<"alarms">): AlarmSeverity {
  if (
    alarm.severity === "critical" ||
    alarm.severity === "warning" ||
    alarm.severity === "informational"
  ) {
    return alarm.severity;
  }
  return "warning";
}

async function presentAlarm(ctx: QueryCtx | MutationCtx, alarm: Doc<"alarms">) {
  const site = await ctx.db.get(alarm.siteId);
  const generator = alarm.generatorId ? await ctx.db.get(alarm.generatorId) : null;
  const actor = alarm.acknowledgedBy ? await ctx.db.get(alarm.acknowledgedBy) : null;
  const siteName = site && site.organizationId === alarm.organizationId ? site.name : "—";
  const generatorName =
    generator && generator.organizationId === alarm.organizationId ? generator.name : "—";
  return {
    ...alarm,
    category: derivedCategory(alarm),
    severity: derivedSeverity(alarm),
    source: alarm.source ?? "operator",
    code: alarm.code ?? null,
    occurrenceCount: alarm.occurrenceCount ?? 1,
    firstOccurredAt: alarm.firstOccurredAt ?? alarm.raisedAt,
    lastOccurredAt: alarm.lastOccurredAt ?? alarm.raisedAt,
    siteName,
    generatorName,
    acknowledgedByName: actor?.name ?? actor?.email ?? null,
  };
}

async function writeEvent(
  ctx: MutationCtx,
  alarm: { _id: Id<"alarms">; organizationId: Id<"organizations">; state: string },
  action: string,
  note: string | null,
  toState: AlarmState | null,
  actorToken?: string,
) {
  const identity = await ctx.auth.getUserIdentity();
  const actor = actorToken ?? identity?.tokenIdentifier ?? "unknown";
  await ctx.db.insert("alarmEvents", {
    organizationId: alarm.organizationId,
    alarmId: alarm._id,
    action,
    actorToken: actor,
    note,
    fromState: alarm.state,
    toState,
    at: Date.now(),
  });
  await writeAudit(ctx, alarm.organizationId, `alarm.${action}`, alarm._id, actorToken);
}

export const list = query({
  args: {
    organizationId: v.id("organizations"),
    state: v.union(v.literal("all"), state),
    kind: v.union(v.literal("all"), kind),
    deviceId: v.union(v.id("devices"), v.null()),
    search: v.string(),
    severity: v.optional(
      v.union(
        v.literal("all"),
        v.literal("critical"),
        v.literal("warning"),
        v.literal("informational"),
      ),
    ),
    category: v.optional(
      v.union(
        v.literal("all"),
        v.literal("generator"),
        v.literal("communication"),
        v.literal("gateway"),
      ),
    ),
    siteId: v.optional(v.union(v.id("sites"), v.null())),
    generatorId: v.optional(v.union(v.id("generators"), v.null())),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "view.alarms");
    if (args.deviceId) {
      await requireDevice(ctx, args.organizationId, args.deviceId);
    }
    const search = cleanSearch(args.search);
    const severity = args.severity ?? "all";
    const category = args.category ?? "all";
    const siteId = args.siteId ?? null;
    const generatorId = args.generatorId ?? null;
    if (siteId) {
      await requireSite(ctx, args.organizationId, siteId);
    }
    if (generatorId) {
      const generator = await ctx.db.get(generatorId);
      if (!generator || generator.organizationId !== args.organizationId) {
        throw new Error("Forbidden");
      }
      if (siteId && generator.siteId !== siteId) {
        throw new Error("Forbidden");
      }
    }
    const filtered =
      args.state !== "all" ||
      args.kind !== "all" ||
      args.deviceId !== null ||
      search !== "" ||
      severity !== "all" ||
      category !== "all" ||
      generatorId !== null;
    if (!filtered && siteId) {
      const page = await ctx.db
        .query("alarms")
        .withIndex("by_org_site_raised", (q) =>
          q.eq("organizationId", args.organizationId).eq("siteId", siteId),
        )
        .order("desc")
        .paginate(boundedPage(args.paginationOpts));
      return {
        rows: await Promise.all(page.page.map((alarm) => presentAlarm(ctx, alarm))),
        capped: false,
        isDone: page.isDone,
        continueCursor: page.continueCursor,
      };
    }
    const indexed = ctx.db
      .query("alarms")
      .withIndex("by_org_raised", (q) => q.eq("organizationId", args.organizationId))
      .order("desc");
    if (!filtered) {
      const page = await indexed.paginate(boundedPage(args.paginationOpts));
      return {
        rows: await Promise.all(page.page.map((alarm) => presentAlarm(ctx, alarm))),
        capped: false,
        isDone: page.isDone,
        continueCursor: page.continueCursor,
      };
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
        if (siteId && alarm.siteId !== siteId) {
          return false;
        }
        if (generatorId && alarm.generatorId !== generatorId) {
          return false;
        }
        if (severity !== "all" && derivedSeverity(alarm) !== severity) {
          return false;
        }
        if (category !== "all" && derivedCategory(alarm) !== category) {
          return false;
        }
        if (!search) {
          return true;
        }
        return `${alarm.summary} ${alarm.detail} ${alarm.kind} ${alarm.state} ${alarm.code ?? ""} ${alarm.category ?? ""}`
          .toLowerCase()
          .includes(search);
      })
      .slice(0, MAX_PAGE);
    return {
      rows: await Promise.all(rows.map((alarm) => presentAlarm(ctx, alarm))),
      capped: batch.length === 200,
      isDone: true,
      continueCursor: null,
    };
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
    return { alarm: await presentAlarm(ctx, alarm), comments, events };
  },
});

/** Latest alarm records for one site. Not an organization total. */
export const forSite = query({
  args: {
    organizationId: v.id("organizations"),
    siteId: v.id("sites"),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "view.alarms");
    await requireSite(ctx, args.organizationId, args.siteId);
    const batch = await ctx.db
      .query("alarms")
      .withIndex("by_org_site_raised", (q) =>
        q.eq("organizationId", args.organizationId).eq("siteId", args.siteId),
      )
      .order("desc")
      .take(MAX_PAGE + 1);
    const capped = batch.length > MAX_PAGE;
    const rows = await Promise.all(batch.slice(0, MAX_PAGE).map((alarm) => presentAlarm(ctx, alarm)));
    return { rows, capped };
  },
});

/** Latest alarm records for one generator. */
export const forGenerator = query({
  args: { generatorId: v.id("generators") },
  handler: async (ctx, args) => {
    const generator = await ctx.db.get(args.generatorId);
    if (!generator) {
      throw new Error("Not found");
    }
    await requirePermission(ctx, generator.organizationId, "view.alarms");
    const batch = await ctx.db
      .query("alarms")
      .withIndex("by_generator_raised", (q) => q.eq("generatorId", generator._id))
      .order("desc")
      .take(MAX_PAGE + 1);
    if (batch.some((alarm) => alarm.organizationId !== generator.organizationId)) {
      throw new Error("Forbidden");
    }
    const capped = batch.length > MAX_PAGE;
    const rows = await Promise.all(batch.slice(0, MAX_PAGE).map((alarm) => presentAlarm(ctx, alarm)));
    return { rows, capped };
  },
});

/** Site and generator names for the alarm filters. Bounded. Requires view.alarms. */
export const scope = query({
  args: {
    organizationId: v.id("organizations"),
    siteId: v.union(v.id("sites"), v.null()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "view.alarms");
    const sites = await ctx.db
      .query("sites")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .take(MAX_PAGE + 1);
    let generators: Doc<"generators">[] = [];
    const selectedSite = args.siteId;
    if (selectedSite) {
      await requireSite(ctx, args.organizationId, selectedSite);
      generators = await ctx.db
        .query("generators")
        .withIndex("by_org_site", (q) =>
          q.eq("organizationId", args.organizationId).eq("siteId", selectedSite),
        )
        .take(MAX_PAGE + 1);
    }
    return {
      sites: sites.slice(0, MAX_PAGE).map((site) => ({ id: site._id, name: site.name })),
      sitesCapped: sites.length > MAX_PAGE,
      generators: generators.slice(0, MAX_PAGE).map((generator) => ({
        id: generator._id,
        name: generator.name,
      })),
      generatorsCapped: generators.length > MAX_PAGE,
    };
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
    const now = Date.now();
    const alarmId = await ctx.db.insert("alarms", {
      organizationId: args.organizationId,
      siteId: args.siteId,
      deviceId: args.deviceId,
      generatorId: args.generatorId,
      kind: args.kind,
      state: "active",
      summary: cleanText(args.summary, "Summary", 160),
      detail: cleanText(args.detail, "Detail", 500),
      raisedAt: now,
      sourceTime: args.sourceTime,
      acknowledgedAt: null,
      acknowledgedBy: null,
      assignedTo: null,
      clearedAt: null,
      resolvedAt: null,
      resolvedBy: null,
      category: args.kind === "controller" ? "generator" : "communication",
      severity: "informational",
      source: "operator",
      occurrenceCount: 1,
      firstOccurredAt: now,
      lastOccurredAt: now,
    });
    const alarm = await ctx.db.get(alarmId);
    if (!alarm) {
      throw new Error("Not found");
    }
    await writeEvent(ctx, alarm, "raise", null, "active");
    await emitForAlarm(ctx, alarm, "alarm.raised", `alarm:${alarmId}:alarm.raised`);
    return alarmId;
  },
});

export const acknowledge = mutation({
  args: { alarmId: v.id("alarms") },
  handler: async (ctx, args) => {
    const alarm = await loadAlarm(ctx, args.alarmId);
    const { user } = await requireAnyPermission(ctx, alarm.organizationId, [
      "acknowledge.alarms",
      "manage.alarms",
    ]);
    if (alarm.state !== "active") {
      throw new Error("Invalid transition");
    }
    await ctx.db.patch(alarm._id, {
      state: "acknowledged",
      acknowledgedAt: Date.now(),
      acknowledgedBy: user._id,
    });
    await writeEvent(ctx, alarm, "acknowledge", null, "acknowledged");
    const updated = await ctx.db.get(alarm._id);
    if (updated) {
      await emitForAlarm(ctx, updated, "alarm.acknowledged", `alarm:${alarm._id}:alarm.acknowledged`);
    }
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
    const updated = await ctx.db.get(alarm._id);
    if (updated) {
      await emitForAlarm(ctx, updated, "alarm.cleared", `alarm:${alarm._id}:alarm.cleared`);
    }
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

async function openCommunication(ctx: MutationCtx, generatorId: Id<"generators">) {
  const rows = await ctx.db
    .query("alarms")
    .withIndex("by_generator_code_raised", (q) =>
      q.eq("generatorId", generatorId).eq("code", COMM_LINK_FAIL),
    )
    .order("desc")
    .take(16);
  return (
    rows.find((alarm) => alarm.state === "active" || alarm.state === "acknowledged") ?? null
  );
}

/**
 * Communication alarms follow an ordered link transition on one boot.
 * Boot ids are random, so a different boot neither raises nor clears.
 * A repeated fail updates the open alarm. It does not create another row
 * and it does not increment the occurrence count. Recovery is fail then ok
 * on the boot that opened the alarm. unknown, degraded, and missing values
 * do not raise or clear. alarmCount is ignored.
 * A new open or clear may emit one notification through notifyEmit.
 */
export async function observeCommunicationLink(
  ctx: MutationCtx,
  args: {
    organizationId: Id<"organizations">;
    siteId: Id<"sites">;
    deviceId: Id<"devices">;
    generatorId: Id<"generators">;
    previousLink: string | null;
    link: string;
    boot: number;
    seq: number;
    ordered: boolean;
    at: number;
  },
) {
  if (!args.ordered) {
    return "unordered" as const;
  }
  const open = await openCommunication(ctx, args.generatorId);
  const sameEvidence =
    open !== null && open.evidenceBoot === args.boot && (open.evidenceSeq ?? 0) <= args.seq;
  if (args.previousLink === "ok" && args.link === "fail") {
    if (open) {
      if (sameEvidence) {
        await ctx.db.patch(open._id, { lastOccurredAt: args.at, evidenceSeq: args.seq });
      }
      return "open" as const;
    }
    const alarmId = await ctx.db.insert("alarms", {
      organizationId: args.organizationId,
      siteId: args.siteId,
      deviceId: args.deviceId,
      generatorId: args.generatorId,
      kind: "transport",
      state: "active",
      summary: COMM_SUMMARY,
      detail: COMM_DETAIL,
      raisedAt: args.at,
      sourceTime: null,
      acknowledgedAt: null,
      acknowledgedBy: null,
      assignedTo: null,
      clearedAt: null,
      resolvedAt: null,
      resolvedBy: null,
      category: "communication",
      code: COMM_LINK_FAIL,
      severity: "warning",
      source: "telemetry.link",
      occurrenceCount: 1,
      firstOccurredAt: args.at,
      lastOccurredAt: args.at,
      evidenceBoot: args.boot,
      evidenceSeq: args.seq,
    });
    const alarm = await ctx.db.get(alarmId);
    if (!alarm) {
      throw new Error("Not found");
    }
    await writeEvent(ctx, alarm, "raise", null, "active", "ingest");
    await emitForAlarm(ctx, alarm, "alarm.raised", `alarm:${alarmId}:alarm.raised`);
    return "raised" as const;
  }
  if (args.previousLink === "fail" && args.link === "fail" && open && sameEvidence) {
    await ctx.db.patch(open._id, { lastOccurredAt: args.at, evidenceSeq: args.seq });
    return "repeated" as const;
  }
  if (args.previousLink === "fail" && args.link === "ok" && open && sameEvidence) {
    await ctx.db.patch(open._id, {
      state: "cleared",
      clearedAt: args.at,
      lastOccurredAt: args.at,
    });
    await writeEvent(ctx, open, "clear", null, "cleared", "ingest");
    const cleared = await ctx.db.get(open._id);
    if (cleared) {
      await emitForAlarm(ctx, cleared, "alarm.cleared", `alarm:${open._id}:alarm.cleared`);
    }
    return "cleared" as const;
  }
  return "ignored" as const;
}
