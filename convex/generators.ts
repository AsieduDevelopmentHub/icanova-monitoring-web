import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { writeAudit } from "./audits";
import { assertSameOrg, requireName, requirePermission } from "./auth";
import { requireDevice } from "./devices";
import { boundedPage } from "./limits";
import { noteGenerator } from "./siteSummary";
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
      .query("generators")
      .withIndex("by_org_site", (q) =>
        q.eq("organizationId", args.organizationId).eq("siteId", args.siteId),
      )
      .paginate(boundedPage(args.paginationOpts));
  },
});

export const detail = query({
  args: { generatorId: v.id("generators") },
  handler: async (ctx, args) => {
    const generator = await ctx.db.get(args.generatorId);
    if (!generator) {
      throw new Error("Not found");
    }
    await requirePermission(ctx, generator.organizationId, "view.telemetry");
    const current = await ctx.db
      .query("telemetryCurrent")
      .withIndex("by_generator", (q) => q.eq("generatorId", generator._id))
      .unique();
    if (current && current.organizationId !== generator.organizationId) {
      throw new Error("Forbidden");
    }
    return {
      generatorId: generator._id,
      organizationId: generator.organizationId,
      siteId: generator.siteId,
      deviceId: generator.deviceId,
      name: generator.name,
      current: current ?? null,
    };
  },
});

export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    siteId: v.id("sites"),
    deviceId: v.id("devices"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "manage.devices");
    await requireSite(ctx, args.organizationId, args.siteId);
    const device = await requireDevice(ctx, args.organizationId, args.deviceId);
    assertSameOrg(device.siteId, args.siteId);
    const name = requireName(args.name, "Generator name");
    const generatorId = await ctx.db.insert("generators", {
      organizationId: args.organizationId,
      siteId: args.siteId,
      deviceId: args.deviceId,
      name,
    });
    const counted = await noteGenerator(ctx, args.organizationId, args.siteId);
    if (counted === "recount") {
      await ctx.scheduler.runAfter(0, internal.generators.recountGenerators, {
        siteId: args.siteId,
        cursor: null,
        seen: 0,
      });
    }
    await writeAudit(ctx, args.organizationId, "generator.create", generatorId);
    return generatorId;
  },
});

/** Paged absolute count for a site that predates generatorCount. Not the request path. */
export const recountGenerators = internalMutation({
  args: {
    siteId: v.id("sites"),
    cursor: v.union(v.string(), v.null()),
    seen: v.number(),
  },
  handler: async (ctx, args) => {
    const site = await ctx.db.get(args.siteId);
    if (!site) {
      return;
    }
    const page = await ctx.db
      .query("generators")
      .withIndex("by_org_site", (q) => q.eq("organizationId", site.organizationId).eq("siteId", site._id))
      .paginate({ numItems: 50, cursor: args.cursor });
    const seen = args.seen + page.page.length;
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.generators.recountGenerators, {
        siteId: site._id,
        cursor: page.continueCursor,
        seen,
      });
      return;
    }
    await ctx.db.patch(site._id, { generatorCount: seen, recounting: false });
    const summary = await ctx.db
      .query("siteSummaries")
      .withIndex("by_site", (q) => q.eq("siteId", site._id))
      .unique();
    if (summary && summary.organizationId === site.organizationId) {
      await ctx.db.patch(summary._id, { generators: seen });
    }
  },
});
