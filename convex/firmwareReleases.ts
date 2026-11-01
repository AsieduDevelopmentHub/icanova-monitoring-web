import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requirePermission } from "./identity";
import { writeAudit } from "./audits";

const VERSION_RE = /^[0-9A-Za-z._+-]{1,40}$/;
const SHA_RE = /^[0-9a-f]{64}$/;

function requireVersion(version: string): string {
  const trimmed = version.trim();
  if (!VERSION_RE.test(trimmed)) {
    throw new Error("Invalid firmware version");
  }
  return trimmed;
}

function requireSha(sha256: string): string {
  const trimmed = sha256.trim().toLowerCase();
  if (!SHA_RE.test(trimmed)) {
    throw new Error("sha256 must be 64 lowercase hex characters");
  }
  return trimmed;
}

export const list = query({
  args: {
    organizationId: v.id("organizations"),
    channel: v.optional(v.union(v.literal("stable"), v.literal("beta"))),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "manage.devices");
    const channel = args.channel ?? "stable";
    const rows = await ctx.db
      .query("firmwareReleases")
      .withIndex("by_channel_created", (q) => q.eq("channel", channel))
      .order("desc")
      .take(40);
    return rows.map((row) => ({
      _id: row._id,
      version: row.version,
      channel: row.channel,
      sha256: row.sha256,
      size: row.size,
      gitHash: row.gitHash ?? null,
      notes: row.notes ?? null,
      published: row.published,
      createdAt: row.createdAt,
      createdBy: row.createdBy ?? null,
    }));
  },
});

export const createUploadUrl = mutation({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "manage.devices");
    return await ctx.storage.generateUploadUrl();
  },
});

export const publish = mutation({
  args: {
    organizationId: v.id("organizations"),
    version: v.string(),
    channel: v.union(v.literal("stable"), v.literal("beta")),
    storageId: v.id("_storage"),
    sha256: v.string(),
    size: v.number(),
    gitHash: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, args.organizationId, "manage.devices");
    const version = requireVersion(args.version);
    const sha256 = requireSha(args.sha256);
    if (!Number.isFinite(args.size) || args.size < 1 || args.size > 3_000_000) {
      throw new Error("Invalid firmware size");
    }
    const id = await ctx.db.insert("firmwareReleases", {
      version,
      channel: args.channel,
      storageId: args.storageId,
      sha256,
      size: Math.floor(args.size),
      gitHash: args.gitHash?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      published: true,
      createdAt: Date.now(),
      createdBy: identity.tokenIdentifier,
    });
    await writeAudit(ctx, args.organizationId, "firmware.publish", id);
    return id;
  },
});

export const setPublished = mutation({
  args: {
    organizationId: v.id("organizations"),
    releaseId: v.id("firmwareReleases"),
    published: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "manage.devices");
    const row = await ctx.db.get(args.releaseId);
    if (!row) {
      throw new Error("Not found");
    }
    await ctx.db.patch(row._id, { published: args.published });
    await writeAudit(
      ctx,
      args.organizationId,
      args.published ? "firmware.publish" : "firmware.unpublish",
      row._id,
    );
    return { releaseId: row._id, published: args.published };
  },
});

export const internalCreateUploadUrl = internalMutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const internalPublish = internalMutation({
  args: {
    version: v.string(),
    channel: v.union(v.literal("stable"), v.literal("beta")),
    storageId: v.id("_storage"),
    sha256: v.string(),
    size: v.number(),
    gitHash: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const version = requireVersion(args.version);
    const sha256 = requireSha(args.sha256);
    if (!Number.isFinite(args.size) || args.size < 1 || args.size > 3_000_000) {
      throw new Error("Invalid firmware size");
    }
    return await ctx.db.insert("firmwareReleases", {
      version,
      channel: args.channel,
      storageId: args.storageId,
      sha256,
      size: Math.floor(args.size),
      gitHash: args.gitHash?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      published: true,
      createdAt: Date.now(),
      createdBy: args.createdBy ?? "ci",
    });
  },
});

export const latestPublished = internalQuery({
  args: {
    channel: v.union(v.literal("stable"), v.literal("beta")),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("firmwareReleases")
      .withIndex("by_channel_created", (q) => q.eq("channel", args.channel))
      .order("desc")
      .take(20);
    return rows.find((row) => row.published) ?? null;
  },
});

export const resolveDownloadUrl = internalQuery({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});
