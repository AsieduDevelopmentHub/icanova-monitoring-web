import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { writeAudit } from "./audits";
import { requireAnyPermission, requireName, requirePermission } from "./auth";
import { boundedPage } from "./limits";

export const list = query({
  args: {
    organizationId: v.id("organizations"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "view.maintenance");
    return await ctx.db
      .query("maintenanceRecords")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .paginate(boundedPage(args.paginationOpts));
  },
});

export const generators = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireAnyPermission(ctx, args.organizationId, ["view.maintenance", "manage.maintenance"]);
    const rows = await ctx.db
      .query("generators")
      .withIndex("by_org_site", (q) => q.eq("organizationId", args.organizationId))
      .take(50);
    return rows
      .filter((row) => row.organizationId === args.organizationId)
      .map((row) => ({ generatorId: row._id, name: row.name }));
  },
});

export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    generatorId: v.id("generators"),
    summary: v.string(),
    notes: v.string(),
    performedAt: v.union(v.number(), v.null()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "manage.maintenance");
    const generator = await ctx.db.get(args.generatorId);
    if (!generator || generator.organizationId !== args.organizationId) {
      throw new Error("Forbidden");
    }
    if (args.performedAt !== null && !Number.isFinite(args.performedAt)) {
      throw new Error("Invalid sample");
    }
    const recordId = await ctx.db.insert("maintenanceRecords", {
      organizationId: args.organizationId,
      generatorId: args.generatorId,
      summary: requireName(args.summary, "Summary"),
      notes: args.notes.trim().slice(0, 500),
      performedAt: args.performedAt,
      recordedAt: Date.now(),
    });
    await writeAudit(ctx, args.organizationId, "maintenance.create", recordId);
    return recordId;
  },
});
