import { mutation, query } from "./_generated/server";
import { ensureUser, resolveAppUser } from "./identity";

export const me = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    const resolved = await resolveAppUser(ctx);
    return resolved?.user ?? null;
  },
});

export const ensure = mutation({
  args: {},
  handler: async (ctx) => {
    const { user } = await ensureUser(ctx);
    return user._id;
  },
});
