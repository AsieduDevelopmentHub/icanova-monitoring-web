import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { writeAudit } from "./audits";
import { assertSameOrg, requireName, requirePermission } from "./identity";
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

/** Rename site metadata only. */
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

function requireCoordinate(value: number, kind: "latitude" | "longitude"): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${kind} must be a finite number`);
  }
  if (kind === "latitude" && (value < -90 || value > 90)) {
    throw new Error("latitude must be between -90 and 90");
  }
  if (kind === "longitude" && (value < -180 || value > 180)) {
    throw new Error("longitude must be between -180 and 180");
  }
  return value;
}

/** Set WGS84 coordinates for a site (cloud source of truth for maps). */
export const setLocation = mutation({
  args: {
    organizationId: v.id("organizations"),
    siteId: v.id("sites"),
    latitude: v.number(),
    longitude: v.number(),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "manage.sites");
    const site = await requireSite(ctx, args.organizationId, args.siteId);
    const latitude = requireCoordinate(args.latitude, "latitude");
    const longitude = requireCoordinate(args.longitude, "longitude");
    await ctx.db.patch(site._id, {
      latitude,
      longitude,
      locationUpdatedAt: Date.now(),
    });
    await writeAudit(ctx, args.organizationId, "site.location", site._id);
    return { siteId: site._id, latitude, longitude };
  },
});

/** Device Soft-AP sync: resolve enrolled device → its site, then set location. */
export const setLocationForIdentity = internalMutation({
  args: {
    identity: v.string(),
    latitude: v.number(),
    longitude: v.number(),
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const identity = args.identity.trim().toLowerCase();
    if (!/^[0-9a-f]{12}$/.test(identity)) {
      return { status: "invalid" as const };
    }
    const latitude = requireCoordinate(args.latitude, "latitude");
    const longitude = requireCoordinate(args.longitude, "longitude");
    const matches = await ctx.db
      .query("devices")
      .withIndex("by_identity", (q) => q.eq("identity", identity))
      .take(5);
    const scoped = args.organizationId
      ? matches.filter((device) => device.organizationId === args.organizationId)
      : matches;
    if (scoped.length === 0) {
      return { status: "unknown" as const };
    }
    if (scoped.length > 1) {
      return { status: "ambiguous" as const };
    }
    const device = scoped[0];
    if (device.lifecycle === "inactive") {
      return { status: "inactive" as const };
    }
    const site = await ctx.db.get(device.siteId);
    if (!site || site.organizationId !== device.organizationId) {
      return { status: "unknown" as const };
    }
    await ctx.db.patch(site._id, {
      latitude,
      longitude,
      locationUpdatedAt: Date.now(),
    });
    return {
      status: "ok" as const,
      siteId: site._id,
      organizationId: device.organizationId,
    };
  },
});
