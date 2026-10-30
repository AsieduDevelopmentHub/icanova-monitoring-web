import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

const channel = v.union(v.literal("email"), v.literal("sms"), v.literal("push"));

export const record = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    channel,
    to: v.string(),
    subject: v.optional(v.string()),
    body: v.string(),
    providerId: v.optional(v.string()),
    status: v.string(),
    attempt: v.number(),
    error: v.optional(v.string()),
    event: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const organization = await ctx.db.get(args.organizationId);
    if (!organization) {
      throw new Error("Forbidden");
    }
    return await ctx.db.insert("messages", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const get = internalQuery({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.messageId);
  },
});

export const complete = internalMutation({
  args: {
    messageId: v.id("messages"),
    status: v.string(),
    providerId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Not found");
    }
    await ctx.db.patch(message._id, {
      status: args.status,
      providerId: args.providerId,
      error: args.error?.slice(0, 300),
    });
    return message.organizationId;
  },
});
