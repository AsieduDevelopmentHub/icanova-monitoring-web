import { mutation, query } from "./_generated/server";
import { ensureUser } from "./auth";

export const me = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    return await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
  },
});

export const ensure = mutation({
  args: {},
  handler: async (ctx) => {
    const { user } = await ensureUser(ctx);
    return user._id;
  },
});
