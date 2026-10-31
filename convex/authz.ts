import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { requirePermission } from "./identity";
import { isPermission } from "./permissions";

/** Actions call this before any provider request. */
export const gate = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    permission: v.string(),
  },
  handler: async (ctx, args) => {
    if (!isPermission(args.permission)) {
      throw new Error("Forbidden");
    }
    await requirePermission(ctx, args.organizationId, args.permission);
    return null;
  },
});
