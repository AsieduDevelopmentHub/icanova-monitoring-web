import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";
import { normalizeEmail } from "./authIdentity";
import { requireName } from "./identity";

/** Public: request access when signup is disabled. Does not create an account. */
export const submit = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    organizationHint: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const name = requireName(args.name, "Name");
    const email = normalizeEmail(args.email);
    if (!email) {
      throw new ConvexError("Email is required");
    }
    const existing = await ctx.db
      .query("accessRequests")
      .withIndex("by_email", (q) => q.eq("email", email))
      .take(5);
    const pending = existing.find((row) => row.status === "pending");
    if (pending) {
      return { requestKey: pending._id, duplicate: true as const };
    }
    const requestKey = await ctx.db.insert("accessRequests", {
      name,
      email,
      organizationHint: args.organizationHint?.trim() || undefined,
      note: args.note?.trim() || undefined,
      status: "pending",
      createdAt: Date.now(),
    });
    return { requestKey, duplicate: false as const };
  },
});
