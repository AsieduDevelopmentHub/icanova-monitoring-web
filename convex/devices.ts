import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { writeAudit } from "./audits";
import { assertSameOrg, requireName, requirePermission } from "./auth";
import { MAX_PAGE, boundedPage } from "./limits";
import { emitDeviceRegistered } from "./notifyEmit";
import { requireSite } from "./sites";

export const list = query({
  args: {
    organizationId: v.id("organizations"),
    siteId: v.id("sites"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "view.dashboard");
    await requireSite(ctx, args.organizationId, args.siteId);
    return await ctx.db
      .query("devices")
      .withIndex("by_org_site", (q) =>
        q.eq("organizationId", args.organizationId).eq("siteId", args.siteId),
      )
      .paginate(boundedPage(args.paginationOpts));
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
    });
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
          ...device,
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
        ...device,
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
      device,
      siteName: site?.name ?? null,
      generators,
      poll: poll ?? null,
      health: health ?? null,
    };
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
