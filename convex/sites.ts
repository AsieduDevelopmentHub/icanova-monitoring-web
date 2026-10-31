import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { writeAudit } from "./audits";
import { assertSameOrg, requireName, requirePermission } from "./auth";
import { boundedPage } from "./limits";

export async function requireSite(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  siteId: Id<"sites">,
) {
  const site = await ctx.db.get(siteId);
  if (!site) {
    throw new Error("Forbidden");
  }
  assertSameOrg(site.organizationId, organizationId);
  return site;
}

export const list = query({
  args: {
    organizationId: v.id("organizations"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "view.dashboard");
    return await ctx.db
      .query("sites")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .paginate(boundedPage(args.paginationOpts));
  },
});

export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "manage.sites");
    const name = requireName(args.name, "Site name");
    const siteId = await ctx.db.insert("sites", {
      organizationId: args.organizationId,
      name,
      generatorCount: 0,
    });
    await writeAudit(ctx, args.organizationId, "site.create", siteId);
    return siteId;
  },
});

/** Rename site metadata only. No hierarchy or location fields exist. */
export const rename = mutation({
  args: {
    organizationId: v.id("organizations"),
    siteId: v.id("sites"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "manage.sites");
    const site = await requireSite(ctx, args.organizationId, args.siteId);
    const name = requireName(args.name, "Site name");
    if (site.name === name) {
      return { siteId: site._id, changed: false as const };
    }
    await ctx.db.patch(site._id, { name });
    await writeAudit(ctx, args.organizationId, "site.rename", site._id);
    return { siteId: site._id, changed: true as const };
  },
});
