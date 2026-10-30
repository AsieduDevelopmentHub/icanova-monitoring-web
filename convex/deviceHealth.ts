import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireAnyPermission, requirePermission } from "./auth";
import {
  EMPTY_HEALTH_TALLIES,
  deriveOverall,
  freshnessFromTelemetry,
  gatewayFromContact,
  healthChanged,
  modbusFromLink,
  shiftHealthTallies,
  type GatewayStatus,
  type HealthSnapshot,
  type HealthTallies,
  type ModbusStatus,
  type OverallStatus,
  type TelemetryFreshness,
} from "./deviceHealthLogic";
import { deviceIsActive } from "./deviceLifecycle";
import { recordJobRun } from "./jobStatus";
import {
  HEALTH_EVENT_PRUNE_BATCH,
  HEALTH_EVENT_RETENTION_MS,
  HEALTH_STALE_MS,
  HEALTH_SWEEP_BATCH,
  MAX_PAGE,
  boundedPage,
} from "./limits";
import { emitHealthEvent } from "./notifyEmit";

type HealthReason = "heartbeat" | "ingest" | "sweep" | "reconcile";

type ApplyArgs = {
  organizationId: Id<"organizations">;
  deviceId: Id<"devices">;
  siteId: Id<"sites">;
  generatorId: Id<"generators"> | null;
  at: number;
  reason: HealthReason;
  lastHeartbeatAt?: number | null;
  lastAcceptedBatchAt?: number | null;
  lastTelemetryAt?: number | null;
  link?: string | null;
  /** When true, gateway is forced offline regardless of contact age. */
  forceGatewayOffline?: boolean;
  /** When true, freshness is forced stale if telemetry exists. */
  forceTelemetryStale?: boolean;
};

function snapshotOf(row: {
  gatewayStatus: GatewayStatus;
  modbusStatus: ModbusStatus;
  telemetryFreshness: TelemetryFreshness;
  overallStatus: OverallStatus;
}): HealthSnapshot {
  return {
    gatewayStatus: row.gatewayStatus,
    modbusStatus: row.modbusStatus,
    telemetryFreshness: row.telemetryFreshness,
    overallStatus: row.overallStatus,
  };
}

function talliesFromSummary(
  row:
    | Doc<"siteSummaries">
    | Doc<"orgHealthSummaries">
    | null
    | undefined,
): HealthTallies {
  if (!row) {
    return { ...EMPTY_HEALTH_TALLIES };
  }
  return {
    devicesTracked: row.devicesTracked ?? 0,
    gatewayOnline: row.gatewayOnline ?? 0,
    gatewayOffline: row.gatewayOffline ?? 0,
    gatewayUnknown: row.gatewayUnknown ?? 0,
    modbusOk: row.modbusOk ?? 0,
    modbusDegraded: row.modbusDegraded ?? 0,
    modbusFail: row.modbusFail ?? 0,
    modbusUnknown: row.modbusUnknown ?? 0,
    telemetryFresh: row.telemetryFresh ?? 0,
    telemetryStale: row.telemetryStale ?? 0,
    telemetryMissing: row.telemetryMissing ?? 0,
    overallHealthy: row.overallHealthy ?? 0,
    overallDegraded: row.overallDegraded ?? 0,
    overallUnhealthy: row.overallUnhealthy ?? 0,
    overallUnknown: row.overallUnknown ?? 0,
    activeCommProblems: row.activeCommProblems ?? 0,
  };
}

async function ensureSiteSummary(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  siteId: Id<"sites">,
) {
  const existing = await ctx.db
    .query("siteSummaries")
    .withIndex("by_site", (q) => q.eq("siteId", siteId))
    .unique();
  if (existing) {
    if (existing.organizationId !== organizationId) {
      throw new Error("Forbidden");
    }
    return existing;
  }
  const site = await ctx.db.get(siteId);
  if (!site || site.organizationId !== organizationId) {
    throw new Error("Forbidden");
  }
  const id = await ctx.db.insert("siteSummaries", {
    organizationId,
    siteId,
    generators: typeof site.generatorCount === "number" ? site.generatorCount : null,
    reporting: 0,
    linkOk: 0,
    linkFail: 0,
    linkDegraded: 0,
    linkOther: 0,
    lastTelemetryAt: null,
    ...EMPTY_HEALTH_TALLIES,
    lastGatewayContactAt: null,
  });
  const created = await ctx.db.get(id);
  if (!created) {
    throw new Error("Not found");
  }
  return created;
}

async function ensureOrgSummary(ctx: MutationCtx, organizationId: Id<"organizations">) {
  const existing = await ctx.db
    .query("orgHealthSummaries")
    .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
    .unique();
  if (existing) {
    return existing;
  }
  const id = await ctx.db.insert("orgHealthSummaries", {
    organizationId,
    ...EMPTY_HEALTH_TALLIES,
    lastGatewayContactAt: null,
    lastTelemetryAt: null,
    updatedAt: Date.now(),
  });
  const created = await ctx.db.get(id);
  if (!created) {
    throw new Error("Not found");
  }
  return created;
}

async function writeTallies(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  siteId: Id<"sites">,
  previous: HealthSnapshot | null,
  next: HealthSnapshot,
  wasTracked: boolean,
  contactAt: number | null,
  telemetryAt: number | null,
) {
  const site = await ensureSiteSummary(ctx, organizationId, siteId);
  const org = await ensureOrgSummary(ctx, organizationId);
  const siteNext = shiftHealthTallies(talliesFromSummary(site), previous, next, wasTracked);
  const orgNext = shiftHealthTallies(talliesFromSummary(org), previous, next, wasTracked);
  await ctx.db.patch(site._id, {
    ...siteNext,
    lastGatewayContactAt:
      contactAt != null
        ? Math.max(site.lastGatewayContactAt ?? 0, contactAt)
        : site.lastGatewayContactAt ?? null,
    lastTelemetryAt:
      telemetryAt != null
        ? Math.max(site.lastTelemetryAt ?? 0, telemetryAt)
        : site.lastTelemetryAt,
  });
  await ctx.db.patch(org._id, {
    ...orgNext,
    lastGatewayContactAt:
      contactAt != null
        ? Math.max(org.lastGatewayContactAt ?? 0, contactAt)
        : org.lastGatewayContactAt,
    lastTelemetryAt:
      telemetryAt != null
        ? Math.max(org.lastTelemetryAt ?? 0, telemetryAt)
        : org.lastTelemetryAt,
    updatedAt: Date.now(),
  });
}

async function applyDeviceHealth(ctx: MutationCtx, args: ApplyArgs) {
  const existing = await ctx.db
    .query("deviceHealthCurrent")
    .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
    .unique();
  if (existing && existing.organizationId !== args.organizationId) {
    throw new Error("Forbidden");
  }

  const lastHeartbeatAt =
    args.lastHeartbeatAt !== undefined
      ? args.lastHeartbeatAt
      : (existing?.lastHeartbeatAt ?? null);
  const lastAcceptedBatchAt =
    args.lastAcceptedBatchAt !== undefined
      ? args.lastAcceptedBatchAt
      : (existing?.lastAcceptedBatchAt ?? null);
  const lastGatewayContactAt = Math.max(lastHeartbeatAt ?? 0, lastAcceptedBatchAt ?? 0) || null;
  const lastTelemetryAt =
    args.lastTelemetryAt !== undefined
      ? args.lastTelemetryAt
      : (existing?.lastTelemetryAt ?? null);
  const link = args.link !== undefined ? args.link : (existing?.link ?? null);

  let gatewayStatus = gatewayFromContact(lastGatewayContactAt, args.at);
  if (args.forceGatewayOffline) {
    gatewayStatus = lastGatewayContactAt == null ? "unknown" : "offline";
  }
  const modbusStatus = modbusFromLink(link);
  let telemetryFreshness = freshnessFromTelemetry(lastTelemetryAt, args.at);
  if (args.forceTelemetryStale && lastTelemetryAt != null) {
    telemetryFreshness = "stale";
  }
  const overallStatus = deriveOverall(gatewayStatus, modbusStatus, telemetryFreshness);
  const nextSnap: HealthSnapshot = {
    gatewayStatus,
    modbusStatus,
    telemetryFreshness,
    overallStatus,
  };
  const previousSnap = existing ? snapshotOf(existing) : null;
  const changed = !previousSnap || healthChanged(previousSnap, nextSnap);

  let gatewayOfflineNotified = existing?.gatewayOfflineNotified ?? false;
  let telemetryStaleNotified = existing?.telemetryStaleNotified ?? false;

  if (changed) {
    await writeTallies(
      ctx,
      args.organizationId,
      args.siteId,
      previousSnap,
      nextSnap,
      Boolean(existing),
      lastGatewayContactAt,
      lastTelemetryAt,
    );
    await ctx.db.insert("deviceHealthEvents", {
      organizationId: args.organizationId,
      deviceId: args.deviceId,
      siteId: args.siteId,
      generatorId: args.generatorId,
      at: args.at,
      reason: args.reason,
      ...(previousSnap && previousSnap.gatewayStatus !== nextSnap.gatewayStatus
        ? { gatewayFrom: previousSnap.gatewayStatus, gatewayTo: nextSnap.gatewayStatus }
        : nextSnap.gatewayStatus !== (previousSnap?.gatewayStatus ?? "unknown")
          ? { gatewayTo: nextSnap.gatewayStatus }
          : {}),
      ...(previousSnap && previousSnap.modbusStatus !== nextSnap.modbusStatus
        ? { modbusFrom: previousSnap.modbusStatus, modbusTo: nextSnap.modbusStatus }
        : !previousSnap && nextSnap.modbusStatus !== "unknown"
          ? { modbusTo: nextSnap.modbusStatus }
          : {}),
      ...(previousSnap && previousSnap.telemetryFreshness !== nextSnap.telemetryFreshness
        ? {
            freshnessFrom: previousSnap.telemetryFreshness,
            freshnessTo: nextSnap.telemetryFreshness,
          }
        : !previousSnap
          ? { freshnessTo: nextSnap.telemetryFreshness }
          : {}),
      ...(previousSnap && previousSnap.overallStatus !== nextSnap.overallStatus
        ? { overallFrom: previousSnap.overallStatus, overallTo: nextSnap.overallStatus }
        : !previousSnap
          ? { overallTo: nextSnap.overallStatus }
          : {}),
    });

    if (
      previousSnap &&
      previousSnap.gatewayStatus !== "offline" &&
      nextSnap.gatewayStatus === "offline"
    ) {
      const emitted = await emitHealthEvent(ctx, {
        organizationId: args.organizationId,
        event: "health.gateway.offline",
        deviceId: args.deviceId,
        siteId: args.siteId,
        generatorId: args.generatorId,
        at: args.at,
      });
      gatewayOfflineNotified = emitted.created || gatewayOfflineNotified;
    }
    if (
      previousSnap &&
      previousSnap.gatewayStatus === "offline" &&
      nextSnap.gatewayStatus === "online" &&
      gatewayOfflineNotified
    ) {
      await emitHealthEvent(ctx, {
        organizationId: args.organizationId,
        event: "health.gateway.recovered",
        deviceId: args.deviceId,
        siteId: args.siteId,
        generatorId: args.generatorId,
        at: args.at,
      });
      gatewayOfflineNotified = false;
    }
    if (
      previousSnap &&
      previousSnap.telemetryFreshness !== "stale" &&
      nextSnap.telemetryFreshness === "stale"
    ) {
      const emitted = await emitHealthEvent(ctx, {
        organizationId: args.organizationId,
        event: "health.telemetry.stale",
        deviceId: args.deviceId,
        siteId: args.siteId,
        generatorId: args.generatorId,
        at: args.at,
      });
      telemetryStaleNotified = emitted.created || telemetryStaleNotified;
    }
    if (
      previousSnap &&
      previousSnap.telemetryFreshness === "stale" &&
      nextSnap.telemetryFreshness === "fresh" &&
      telemetryStaleNotified
    ) {
      await emitHealthEvent(ctx, {
        organizationId: args.organizationId,
        event: "health.telemetry.recovered",
        deviceId: args.deviceId,
        siteId: args.siteId,
        generatorId: args.generatorId,
        at: args.at,
      });
      telemetryStaleNotified = false;
    }
  } else if (existing) {
    // Contact timestamps may move without a status change (repeat heartbeat).
    await writeContactOnly(
      ctx,
      args.organizationId,
      args.siteId,
      lastGatewayContactAt,
      lastTelemetryAt,
    );
  }

  const doc = {
    organizationId: args.organizationId,
    deviceId: args.deviceId,
    siteId: args.siteId,
    generatorId: args.generatorId,
    lastHeartbeatAt,
    lastAcceptedBatchAt,
    lastGatewayContactAt,
    lastTelemetryAt,
    link,
    gatewayStatus,
    modbusStatus,
    telemetryFreshness,
    overallStatus,
    gatewayOfflineNotified,
    telemetryStaleNotified,
    updatedAt: args.at,
  };

  if (existing) {
    await ctx.db.patch(existing._id, doc);
    return { ...existing, ...doc };
  }
  const id = await ctx.db.insert("deviceHealthCurrent", doc);
  if (!changed) {
    await writeTallies(
      ctx,
      args.organizationId,
      args.siteId,
      null,
      nextSnap,
      false,
      lastGatewayContactAt,
      lastTelemetryAt,
    );
  }
  return { _id: id, ...doc };
}

async function writeContactOnly(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  siteId: Id<"sites">,
  contactAt: number | null,
  telemetryAt: number | null,
) {
  if (contactAt == null && telemetryAt == null) {
    return;
  }
  const site = await ensureSiteSummary(ctx, organizationId, siteId);
  const org = await ensureOrgSummary(ctx, organizationId);
  await ctx.db.patch(site._id, {
    lastGatewayContactAt:
      contactAt != null
        ? Math.max(site.lastGatewayContactAt ?? 0, contactAt)
        : site.lastGatewayContactAt ?? null,
    lastTelemetryAt:
      telemetryAt != null
        ? Math.max(site.lastTelemetryAt ?? 0, telemetryAt)
        : site.lastTelemetryAt,
  });
  await ctx.db.patch(org._id, {
    lastGatewayContactAt:
      contactAt != null
        ? Math.max(org.lastGatewayContactAt ?? 0, contactAt)
        : org.lastGatewayContactAt,
    lastTelemetryAt:
      telemetryAt != null
        ? Math.max(org.lastTelemetryAt ?? 0, telemetryAt)
        : org.lastTelemetryAt,
    updatedAt: Date.now(),
  });
}

/** Authenticated heartbeat. Does not refresh telemetry freshness or invent Modbus. */
export const recordHeartbeat = internalMutation({
  args: { identity: v.string() },
  handler: async (ctx, args) => {
    if (!/^[0-9a-f]{12}$/.test(args.identity)) {
      return { status: "ignored" as const };
    }
    const matches = await ctx.db
      .query("devices")
      .withIndex("by_identity", (q) => q.eq("identity", args.identity))
      .take(2);
    if (matches.length === 0) {
      return { status: "unknown" as const };
    }
    if (matches.length > 1) {
      return { status: "ambiguous" as const };
    }
    const device = matches[0];
    if (!deviceIsActive(device)) {
      return { status: "inactive" as const };
    }
    const generators = await ctx.db
      .query("generators")
      .withIndex("by_device", (q) => q.eq("deviceId", device._id))
      .take(1);
    const generator = generators[0] ?? null;
    const at = Date.now();
    await applyDeviceHealth(ctx, {
      organizationId: device.organizationId,
      deviceId: device._id,
      siteId: device.siteId,
      generatorId: generator && generator.organizationId === device.organizationId ? generator._id : null,
      at,
      reason: "heartbeat",
      lastHeartbeatAt: at,
    });
    return { status: "ok" as const };
  },
});

/** After an accepted batch: contact + Modbus link + fresh telemetry. */
export async function recordAcceptedBatch(
  ctx: MutationCtx,
  args: {
    organizationId: Id<"organizations">;
    deviceId: Id<"devices">;
    siteId: Id<"sites">;
    generatorId: Id<"generators">;
    link: string | null;
    at: number;
  },
) {
  await applyDeviceHealth(ctx, {
    organizationId: args.organizationId,
    deviceId: args.deviceId,
    siteId: args.siteId,
    generatorId: args.generatorId,
    at: args.at,
    reason: "ingest",
    lastAcceptedBatchAt: args.at,
    lastTelemetryAt: args.at,
    link: args.link,
  });
}

export const sweep = internalMutation({
  args: {
    cursorContact: v.optional(v.union(v.string(), v.null())),
    cursorFresh: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const cutoff = now - HEALTH_STALE_MS;
    let continued = false;
    let processed = 0;

    const online = await ctx.db
      .query("deviceHealthCurrent")
      .withIndex("by_gateway_contact", (q) =>
        q.eq("gatewayStatus", "online").lt("lastGatewayContactAt", cutoff),
      )
      .take(HEALTH_SWEEP_BATCH);
    for (const row of online) {
      if (row.lastGatewayContactAt == null || row.lastGatewayContactAt >= cutoff) {
        continue;
      }
      await applyDeviceHealth(ctx, {
        organizationId: row.organizationId,
        deviceId: row.deviceId,
        siteId: row.siteId,
        generatorId: row.generatorId,
        at: now,
        reason: "sweep",
        forceGatewayOffline: true,
      });
      processed += 1;
    }
    if (online.length === HEALTH_SWEEP_BATCH) {
      continued = true;
    }

    const fresh = await ctx.db
      .query("deviceHealthCurrent")
      .withIndex("by_freshness_telemetry", (q) =>
        q.eq("telemetryFreshness", "fresh").lt("lastTelemetryAt", cutoff),
      )
      .take(HEALTH_SWEEP_BATCH);
    for (const row of fresh) {
      if (row.lastTelemetryAt == null || row.lastTelemetryAt >= cutoff) {
        continue;
      }
      await applyDeviceHealth(ctx, {
        organizationId: row.organizationId,
        deviceId: row.deviceId,
        siteId: row.siteId,
        generatorId: row.generatorId,
        at: now,
        reason: "sweep",
        forceTelemetryStale: true,
      });
      processed += 1;
    }
    if (fresh.length === HEALTH_SWEEP_BATCH) {
      continued = true;
    }

    if (continued) {
      await ctx.scheduler.runAfter(0, internal.deviceHealth.sweep, {
        cursorContact: args.cursorContact ?? null,
        cursorFresh: args.cursorFresh ?? null,
      });
    }
    await recordJobRun(ctx, {
      jobName: "deviceHealth.sweep",
      processed,
      pendingHint: continued ? HEALTH_SWEEP_BATCH : 0,
      durationMs: Date.now() - now,
      status: continued ? "partial" : "ok",
    });
  },
});

/** Delete aged health transition rows. Never deletes alarms or audits. */
export const pruneHealthEvents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const started = Date.now();
    const cutoff = started - HEALTH_EVENT_RETENTION_MS;
    const batch = await ctx.db
      .query("deviceHealthEvents")
      .withIndex("by_at", (q) => q.lt("at", cutoff))
      .take(HEALTH_EVENT_PRUNE_BATCH);
    for (const row of batch) {
      await ctx.db.delete(row._id);
    }
    await recordJobRun(ctx, {
      jobName: "deviceHealth.pruneHealthEvents",
      processed: batch.length,
      pendingHint: batch.length === HEALTH_EVENT_PRUNE_BATCH ? HEALTH_EVENT_PRUNE_BATCH : 0,
      durationMs: Date.now() - started,
      status: batch.length === HEALTH_EVENT_PRUNE_BATCH ? "partial" : "ok",
    });
    return { deleted: batch.length };
  },
});

/** Rebuild site health tallies from current rows. Bounded pages. */
export const reconcileSite = internalMutation({
  args: {
    siteId: v.id("sites"),
    cursor: v.union(v.string(), v.null()),
    tallies: v.optional(
      v.object({
        devicesTracked: v.number(),
        gatewayOnline: v.number(),
        gatewayOffline: v.number(),
        gatewayUnknown: v.number(),
        modbusOk: v.number(),
        modbusDegraded: v.number(),
        modbusFail: v.number(),
        modbusUnknown: v.number(),
        telemetryFresh: v.number(),
        telemetryStale: v.number(),
        telemetryMissing: v.number(),
        overallHealthy: v.number(),
        overallDegraded: v.number(),
        overallUnhealthy: v.number(),
        overallUnknown: v.number(),
        activeCommProblems: v.number(),
      }),
    ),
    lastGatewayContactAt: v.optional(v.union(v.number(), v.null())),
    lastTelemetryAt: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const site = await ctx.db.get(args.siteId);
    if (!site) {
      return;
    }
    let tallies = args.tallies ? { ...args.tallies } : { ...EMPTY_HEALTH_TALLIES };
    let lastGatewayContactAt = args.lastGatewayContactAt ?? null;
    let lastTelemetryAt = args.lastTelemetryAt ?? null;
    const page = await ctx.db
      .query("deviceHealthCurrent")
      .withIndex("by_site", (q) => q.eq("siteId", args.siteId))
      .paginate({ numItems: HEALTH_SWEEP_BATCH, cursor: args.cursor });
    for (const row of page.page) {
      if (row.organizationId !== site.organizationId) {
        continue;
      }
      tallies = shiftHealthTallies(tallies, null, snapshotOf(row), false);
      if (row.lastGatewayContactAt != null) {
        lastGatewayContactAt = Math.max(lastGatewayContactAt ?? 0, row.lastGatewayContactAt);
      }
      if (row.lastTelemetryAt != null) {
        lastTelemetryAt = Math.max(lastTelemetryAt ?? 0, row.lastTelemetryAt);
      }
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.deviceHealth.reconcileSite, {
        siteId: args.siteId,
        cursor: page.continueCursor,
        tallies,
        lastGatewayContactAt,
        lastTelemetryAt,
      });
      return;
    }
    const summary = await ensureSiteSummary(ctx, site.organizationId, site._id);
    await ctx.db.patch(summary._id, {
      ...tallies,
      lastGatewayContactAt,
      lastTelemetryAt: lastTelemetryAt ?? summary.lastTelemetryAt,
    });
  },
});

export const getForDevice = query({
  args: { deviceId: v.id("devices") },
  handler: async (ctx, args) => {
    const device = await ctx.db.get(args.deviceId);
    if (!device) {
      throw new Error("Not found");
    }
    await requireAnyPermission(ctx, device.organizationId, [
      "view.diagnostics",
      "view.dashboard",
    ]);
    const health = await ctx.db
      .query("deviceHealthCurrent")
      .withIndex("by_device", (q) => q.eq("deviceId", device._id))
      .unique();
    if (health && health.organizationId !== device.organizationId) {
      throw new Error("Forbidden");
    }
    return health;
  },
});

export const getForGenerator = query({
  args: { generatorId: v.id("generators") },
  handler: async (ctx, args) => {
    const generator = await ctx.db.get(args.generatorId);
    if (!generator) {
      throw new Error("Not found");
    }
    await requireAnyPermission(ctx, generator.organizationId, [
      "view.diagnostics",
      "view.dashboard",
      "view.telemetry",
    ]);
    const health = await ctx.db
      .query("deviceHealthCurrent")
      .withIndex("by_device", (q) => q.eq("deviceId", generator.deviceId))
      .unique();
    if (health && health.organizationId !== generator.organizationId) {
      throw new Error("Forbidden");
    }
    return health;
  },
});

export const listEvents = query({
  args: {
    deviceId: v.id("devices"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const device = await ctx.db.get(args.deviceId);
    if (!device) {
      throw new Error("Not found");
    }
    await requireAnyPermission(ctx, device.organizationId, [
      "view.diagnostics",
      "view.dashboard",
    ]);
    const page = await ctx.db
      .query("deviceHealthEvents")
      .withIndex("by_device_at", (q) => q.eq("deviceId", device._id))
      .order("desc")
      .paginate(boundedPage(args.paginationOpts));
    if (page.page.some((row) => row.organizationId !== device.organizationId)) {
      throw new Error("Forbidden");
    }
    return page;
  },
});

export const orgSummary = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "view.dashboard");
    const summary = await ctx.db
      .query("orgHealthSummaries")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .unique();
    if (!summary) {
      return { ready: false as const, ...EMPTY_HEALTH_TALLIES, lastGatewayContactAt: null, lastTelemetryAt: null };
    }
    return {
      ready: true as const,
      ...talliesFromSummary(summary),
      lastGatewayContactAt: summary.lastGatewayContactAt,
      lastTelemetryAt: summary.lastTelemetryAt,
    };
  },
});

export const siteHealthSummary = query({
  args: {
    organizationId: v.id("organizations"),
    siteId: v.id("sites"),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "view.dashboard");
    const site = await ctx.db.get(args.siteId);
    if (!site || site.organizationId !== args.organizationId) {
      throw new Error("Forbidden");
    }
    const summary = await ctx.db
      .query("siteSummaries")
      .withIndex("by_site", (q) => q.eq("siteId", args.siteId))
      .unique();
    if (!summary || summary.organizationId !== args.organizationId) {
      return { ready: false as const, ...EMPTY_HEALTH_TALLIES, lastGatewayContactAt: null, lastTelemetryAt: null };
    }
    return {
      ready: true as const,
      ...talliesFromSummary(summary),
      lastGatewayContactAt: summary.lastGatewayContactAt ?? null,
      lastTelemetryAt: summary.lastTelemetryAt,
    };
  },
});

/** Test / admin: schedule a site reconcile. Requires manage.devices. */
export const requestSiteReconcile = mutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, args) => {
    const site = await ctx.db.get(args.siteId);
    if (!site) {
      throw new Error("Not found");
    }
    await requirePermission(ctx, site.organizationId, "manage.devices");
    await ctx.scheduler.runAfter(0, internal.deviceHealth.reconcileSite, {
      siteId: args.siteId,
      cursor: null,
    });
  },
});

export async function loadHealth(
  ctx: QueryCtx,
  deviceId: Id<"devices">,
  organizationId: Id<"organizations">,
) {
  const health = await ctx.db
    .query("deviceHealthCurrent")
    .withIndex("by_device", (q) => q.eq("deviceId", deviceId))
    .unique();
  if (health && health.organizationId !== organizationId) {
    throw new Error("Forbidden");
  }
  return health;
}

void MAX_PAGE;
