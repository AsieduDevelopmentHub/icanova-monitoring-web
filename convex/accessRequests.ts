import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { normalizeEmail } from "./authIdentity";
import { requireName } from "./identity";
import { MAX_PAGE } from "./limits";

/**
 * Public: organization name list for access-request forms.
 * Returns names only when the platform has more than two organizations;
 * otherwise the org hint field should be omitted.
 */
export const organizationHints = query({
  args: {},
  handler: async (ctx) => {
    const orgs = await ctx.db.query("organizations").take(MAX_PAGE);
    if (orgs.length <= 2) {
      return { show: false as const, names: [] as string[] };
    }
    return {
      show: true as const,
      names: orgs.map((org) => org.name).sort((a, b) => a.localeCompare(b)),
    };
  },
});

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
    const orgs = await ctx.db.query("organizations").take(MAX_PAGE);
    let organizationHint = args.organizationHint?.trim() || undefined;
    if (orgs.length <= 2) {
      organizationHint = undefined;
    } else if (organizationHint) {
      const allowed = new Set(orgs.map((org) => org.name));
      if (!allowed.has(organizationHint)) {
        throw new ConvexError("Unknown organization");
      }
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
      organizationHint,
      note: args.note?.trim() || undefined,
      status: "pending",
      createdAt: Date.now(),
    });
    return { requestKey, duplicate: false as const };
  },
});
