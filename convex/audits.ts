import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { requirePermission } from "./identity";
import { boundedPage } from "./limits";

export async function writeAudit(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  action: string,
  target: string,
  actorToken?: string,
) {
  const identity = await ctx.auth.getUserIdentity();
  await ctx.db.insert("audits", {
    organizationId,
    actorToken: actorToken ?? identity?.tokenIdentifier ?? "unknown",
    action,
    target,
    at: Date.now(),
  });
}

export const list = query({
  args: {
    organizationId: v.id("organizations"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "view.audit");
    return await ctx.db
      .query("audits")
      .withIndex("by_org_time", (q) => q.eq("organizationId", args.organizationId))
      .order("desc")
      .paginate(boundedPage(args.paginationOpts));
  },
});
