import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { writeAudit } from "./audits";
import { ensureUser, requireName, requirePermission, userByToken } from "./auth";
import { PERMISSIONS, isPermission } from "./permissions";
import { MAX_PAGE } from "./limits";

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }
    const user = await userByToken(ctx, identity.tokenIdentifier);
    if (!user) {
      return [];
    }
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(MAX_PAGE);
    const rows = [];
    for (const membership of memberships) {
      const organization = await ctx.db.get(membership.organizationId);
      const role = await ctx.db.get(membership.roleId);
      if (!organization || !role || role.organizationId !== organization._id) {
        continue;
      }
      rows.push({
        organizationId: organization._id,
        name: organization.name,
        permissions: role.permissions.filter(isPermission),
      });
    }
    return rows;
  },
});

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const { user } = await ensureUser(ctx);
    const name = requireName(args.name, "Organization name");
    const organizationId = await ctx.db.insert("organizations", {
      name,
      createdAt: Date.now(),
    });
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Owner",
      permissions: [...PERMISSIONS],
    });
    await ctx.db.insert("memberships", {
      organizationId,
      userId: user._id,
      roleId,
    });
    await writeAudit(ctx, organizationId, "organization.create", organizationId);
    return organizationId;
  },
});

export const createRole = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    permissions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "manage.roles");
    const name = requireName(args.name, "Role name");
    if (args.permissions.length < 1 || args.permissions.some((item) => !isPermission(item))) {
      throw new Error("Unknown permission");
    }
    const roleId = await ctx.db.insert("roles", {
      organizationId: args.organizationId,
      name,
      permissions: args.permissions,
    });
    await writeAudit(ctx, args.organizationId, "role.create", roleId);
    return roleId;
  },
});

export const grant = mutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    roleId: v.id("roles"),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "manage.users");
    const role = await ctx.db.get(args.roleId);
    if (!role || role.organizationId !== args.organizationId) {
      throw new Error("Forbidden");
    }
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("Not found");
    }
    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.userId),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { roleId: args.roleId });
      await writeAudit(ctx, args.organizationId, "membership.update", existing._id);
      return existing._id;
    }
    const membershipId = await ctx.db.insert("memberships", {
      organizationId: args.organizationId,
      userId: args.userId,
      roleId: args.roleId,
    });
    await writeAudit(ctx, args.organizationId, "membership.grant", membershipId);
    return membershipId;
  },
});
