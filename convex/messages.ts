import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const record = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    channel: v.union(v.literal("email"), v.literal("sms")),
    to: v.string(),
    subject: v.optional(v.string()),
    body: v.string(),
    providerId: v.optional(v.string()),
    status: v.string(),
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
