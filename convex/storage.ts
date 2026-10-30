import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePermission } from "./auth";

export const createUploadUrl = mutation({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "view.dashboard");
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveFile = mutation({
  args: {
    organizationId: v.id("organizations"),
    storageId: v.id("_storage"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, args.organizationId, "view.dashboard");
    const name = args.name.trim();
    if (name.length < 1 || name.length > 120) {
      throw new Error("File name must be 1 to 120 characters");
    }
    return await ctx.db.insert("files", {
      organizationId: args.organizationId,
      storageId: args.storageId,
      name,
      ownerToken: identity.tokenIdentifier,
      createdAt: Date.now(),
    });
  },
});

export const fileUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const file = await ctx.db
      .query("files")
      .withIndex("by_storage", (q) => q.eq("storageId", args.storageId))
      .unique();
    if (!file) {
      return null;
    }
    const { identity } = await requirePermission(ctx, file.organizationId, "view.dashboard");
    if (file.ownerToken !== identity.tokenIdentifier) {
      return null;
    }
    return await ctx.storage.getUrl(args.storageId);
  },
});
