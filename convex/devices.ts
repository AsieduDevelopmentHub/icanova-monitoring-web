import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { writeAudit } from "./audits";
import { assertSameOrg, requireName, requirePermission } from "./auth";
import { lifecycleLabel } from "./deviceLifecycle";
export { deviceIsActive, lifecycleLabel } from "./deviceLifecycle";
import {
  deviceCredentialMatches,
  hashIngestCredential,
} from "./ingestAuth";
import { MAX_PAGE, boundedPage } from "./limits";
import { emitDeviceRegistered } from "./notifyEmit";
import { requireSite } from "./sites";

/** Strip credential hashes from any client-facing device document. */
export function publicDevice(device: Doc<"devices">) {
  const {
    ingestCredentialHash: _h,
    ingestCredentialPreviousHash: _p,
    ...safe
  } = device;
  return {
    ...safe,
    lifecycle: lifecycleLabel(device),
    hasIngestCredential: Boolean(device.ingestCredentialHash),
  };
}

export const list = query({
  args: {
    organizationId: v.id("organizations"),
    siteId: v.id("sites"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "view.dashboard");
    await requireSite(ctx, args.organizationId, args.siteId);
    const page = await ctx.db
      .query("devices")
      .withIndex("by_org_site", (q) =>
        q.eq("organizationId", args.organizationId).eq("siteId", args.siteId),
      )
      .paginate(boundedPage(args.paginationOpts));
    return {
      ...page,
      page: page.page.map((device) => publicDevice(device)),
    };
  },
});

export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    siteId: v.id("sites"),
    name: v.string(),
    identity: v.string(),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "manage.devices");
    await requireSite(ctx, args.organizationId, args.siteId);
    const name = requireName(args.name, "Device name");
    const identity = requireName(args.identity, "Device identity");
    const existing = await ctx.db
      .query("devices")
      .withIndex("by_org_identity", (q) =>
        q.eq("organizationId", args.organizationId).eq("identity", identity),
      )
      .unique();
    if (existing) {
      throw new Error("Already registered");
    }
    const deviceId = await ctx.db.insert("devices", {
      organizationId: args.organizationId,
      siteId: args.siteId,
      name,
      identity,
      lifecycle: "active",
      lifecycleChangedAt: Date.now(),
    });
    const orgSummary = await ctx.db
      .query("orgHealthSummaries")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .unique();
    if (orgSummary) {
      await ctx.db.patch(orgSummary._id, {
        devicesActive: (orgSummary.devicesActive ?? 0) + 1,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("orgHealthSummaries", {
        organizationId: args.organizationId,
        devicesTracked: 0,
        gatewayOnline: 0,
        gatewayOffline: 0,
        gatewayUnknown: 0,
        modbusOk: 0,
        modbusDegraded: 0,
        modbusFail: 0,
        modbusUnknown: 0,
        telemetryFresh: 0,
        telemetryStale: 0,
        telemetryMissing: 0,
        overallHealthy: 0,
        overallDegraded: 0,
        overallUnhealthy: 0,
        overallUnknown: 0,
        activeCommProblems: 0,
        devicesActive: 1,
        devicesInactive: 0,
        lastGatewayContactAt: null,
        lastTelemetryAt: null,
        updatedAt: Date.now(),
      });
    }
    await writeAudit(ctx, args.organizationId, "device.create", deviceId);
    await emitDeviceRegistered(ctx, {
      organizationId: args.organizationId,
      siteId: args.siteId,
      deviceId,
      deviceName: name,
    });
    return deviceId;
  },
});

export const inventory = query({
  args: {
    organizationId: v.id("organizations"),
    search: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "view.dashboard");
    const search = args.search.trim().toLowerCase();
    if (search.length > 80) {
      throw new Error("Search is too long");
    }
    const indexed = ctx.db
      .query("devices")
      .withIndex("by_org_site", (q) => q.eq("organizationId", args.organizationId));
    if (search) {
      const batch = await indexed.take(200);
      const rows = [];
      for (const device of batch) {
        if (rows.length >= MAX_PAGE) {
          break;
        }
        const haystack = `${device.name} ${device.identity}`.toLowerCase();
        if (!haystack.includes(search)) {
          continue;
        }
        const site = await ctx.db.get(device.siteId);
        const health = await ctx.db
          .query("deviceHealthCurrent")
          .withIndex("by_device", (q) => q.eq("deviceId", device._id))
          .unique();
        if (health && health.organizationId !== args.organizationId) {
          throw new Error("Forbidden");
        }
        rows.push({
          ...publicDevice(device),
          siteName: site && site.organizationId === args.organizationId ? site.name : null,
          gatewayStatus: health?.gatewayStatus ?? "unknown",
          modbusStatus: health?.modbusStatus ?? "unknown",
          telemetryFreshness: health?.telemetryFreshness ?? "missing",
          overallStatus: health?.overallStatus ?? "unknown",
        });
      }
      return { rows, capped: batch.length === 200, isDone: true, continueCursor: null };
    }
    const page = await indexed.paginate(boundedPage(args.paginationOpts));
    const rows = [];
    for (const device of page.page) {
      const site = await ctx.db.get(device.siteId);
      const health = await ctx.db
        .query("deviceHealthCurrent")
        .withIndex("by_device", (q) => q.eq("deviceId", device._id))
        .unique();
      if (health && health.organizationId !== args.organizationId) {
        throw new Error("Forbidden");
      }
      rows.push({
        ...publicDevice(device),
        siteName: site && site.organizationId === args.organizationId ? site.name : null,
        gatewayStatus: health?.gatewayStatus ?? "unknown",
        modbusStatus: health?.modbusStatus ?? "unknown",
        telemetryFreshness: health?.telemetryFreshness ?? "missing",
        overallStatus: health?.overallStatus ?? "unknown",
      });
    }
    return { rows, capped: false, isDone: page.isDone, continueCursor: page.continueCursor };
  },
});

export const detail = query({
  args: { deviceId: v.id("devices") },
  handler: async (ctx, args) => {
    const device = await ctx.db.get(args.deviceId);
    if (!device) {
      throw new Error("Not found");
    }
    await requirePermission(ctx, device.organizationId, "view.dashboard");
    const site = await ctx.db.get(device.siteId);
    if (site && site.organizationId !== device.organizationId) {
      throw new Error("Forbidden");
    }
    const generators = await ctx.db
      .query("generators")
      .withIndex("by_device", (q) => q.eq("deviceId", device._id))
      .take(20);
    if (generators.some((generator) => generator.organizationId !== device.organizationId)) {
      throw new Error("Forbidden");
    }
    const poll = await ctx.db
      .query("devicePolls")
      .withIndex("by_device", (q) => q.eq("deviceId", device._id))
      .unique();
    if (poll && poll.organizationId !== device.organizationId) {
      throw new Error("Forbidden");
    }
    const health = await ctx.db
      .query("deviceHealthCurrent")
      .withIndex("by_device", (q) => q.eq("deviceId", device._id))
      .unique();
    if (health && health.organizationId !== device.organizationId) {
      throw new Error("Forbidden");
    }
    return {
      device: publicDevice(device),
      siteName: site?.name ?? null,
      generators,
      poll: poll ?? null,
      health: health ?? null,
    };
  },
});

/**
 * Set or rotate a per-device ingest credential. Stores only SHA-256 hex.
 * Shared INGEST_SECRET remains accepted. Never returns the plaintext or hash.
 */
export const setIngestCredential = mutation({
  args: {
    deviceId: v.id("devices"),
    plaintext: v.string(),
  },
  handler: async (ctx, args) => {
    const device = await ctx.db.get(args.deviceId);
    if (!device) {
      throw new Error("Not found");
    }
    await requirePermission(ctx, device.organizationId, "manage.devices");
    const secret = args.plaintext.trim();
    if (secret.length < 16) {
      throw new Error("Credential is too short");
    }
    const hash = await hashIngestCredential(secret);
    const at = Date.now();
    await ctx.db.patch(device._id, {
      ingestCredentialPreviousHash: device.ingestCredentialHash,
      ingestCredentialHash: hash,
      ingestCredentialVersion: (device.ingestCredentialVersion ?? 0) + 1,
      ingestCredentialRotatedAt: at,
    });
    await writeAudit(ctx, device.organizationId, "device.ingest_credential.rotate", device._id);
    return {
      deviceId: device._id,
      hasIngestCredential: true,
      version: (device.ingestCredentialVersion ?? 0) + 1,
    };
  },
});

/** Revoke device credentials; shared INGEST_SECRET still works until cutover. */
export const clearIngestCredential = mutation({
  args: { deviceId: v.id("devices") },
  handler: async (ctx, args) => {
    const device = await ctx.db.get(args.deviceId);
    if (!device) {
      throw new Error("Not found");
    }
    await requirePermission(ctx, device.organizationId, "manage.devices");
    await ctx.db.patch(device._id, {
      ingestCredentialHash: undefined,
      ingestCredentialPreviousHash: undefined,
      ingestCredentialRotatedAt: Date.now(),
    });
    await writeAudit(ctx, device.organizationId, "device.ingest_credential.revoke", device._id);
    return { deviceId: device._id, hasIngestCredential: false };
  },
});

/**
 * HTTP dual-auth helper: verify a presented bearer against device credential hashes.
 * Does not accept inactive devices. Does not log the bearer.
 */
export const verifyDeviceIngestCredential = internalMutation({
  args: {
    identity: v.string(),
    presented: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = args.identity.trim().toLowerCase();
    if (!/^[0-9a-f]{12}$/.test(identity)) {
      return { ok: false as const, reason: "bad_identity" as const };
    }
    const matches = await ctx.db
      .query("devices")
      .withIndex("by_identity", (q) => q.eq("identity", identity))
      .take(2);
    if (matches.length !== 1) {
      return { ok: false as const, reason: "unknown" as const };
    }
    const device = matches[0]!;
    if (lifecycleLabel(device) === "inactive") {
      return { ok: false as const, reason: "inactive" as const, organizationId: device.organizationId };
    }
    if (!device.ingestCredentialHash && !device.ingestCredentialPreviousHash) {
      return { ok: false as const, reason: "no_credential" as const };
    }
    const presentedHash = await hashIngestCredential(args.presented);
    if (
      !deviceCredentialMatches(
        presentedHash,
        device.ingestCredentialHash,
        device.ingestCredentialPreviousHash,
      )
    ) {
      return { ok: false as const, reason: "mismatch" as const };
    }
    return {
      ok: true as const,
      organizationId: device.organizationId,
      deviceId: device._id,
    };
  },
});

/**
 * Activate or deactivate a device. Idempotent. Does not delete history.
 * Deactivated devices are rejected by ingest and heartbeat before writes.
 */
export const setLifecycle = mutation({
  args: {
    deviceId: v.id("devices"),
    lifecycle: v.union(v.literal("active"), v.literal("inactive")),
  },
  handler: async (ctx, args) => {
    const device = await ctx.db.get(args.deviceId);
    if (!device) {
      throw new Error("Not found");
    }
    await requirePermission(ctx, device.organizationId, "manage.devices");
    const current = lifecycleLabel(device);
    if (current === args.lifecycle) {
      return { deviceId: device._id, lifecycle: current, changed: false as const };
    }
    const at = Date.now();
    await ctx.db.patch(device._id, {
      lifecycle: args.lifecycle,
      lifecycleChangedAt: at,
    });
    const orgSummary = await ctx.db
      .query("orgHealthSummaries")
      .withIndex("by_org", (q) => q.eq("organizationId", device.organizationId))
      .unique();
    if (orgSummary) {
      const active = orgSummary.devicesActive ?? 0;
      const inactive = orgSummary.devicesInactive ?? 0;
      if (args.lifecycle === "inactive") {
        await ctx.db.patch(orgSummary._id, {
          devicesActive: Math.max(0, active - 1),
          devicesInactive: inactive + 1,
          updatedAt: at,
        });
      } else {
        await ctx.db.patch(orgSummary._id, {
          devicesActive: active + 1,
          devicesInactive: Math.max(0, inactive - 1),
          updatedAt: at,
        });
      }
    }
    await writeAudit(
      ctx,
      device.organizationId,
      args.lifecycle === "inactive" ? "device.deactivate" : "device.activate",
      device._id,
    );
    return { deviceId: device._id, lifecycle: args.lifecycle, changed: true as const };
  },
});

export async function requireDevice(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  deviceId: Id<"devices">,
) {
  const device = await ctx.db.get(deviceId);
  if (!device) {
    throw new Error("Forbidden");
  }
  assertSameOrg(device.organizationId, organizationId);
  return device;
}
