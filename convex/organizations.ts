import { createAccount } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { writeAudit } from "./audits";
import {
  normalizeEmail,
  normalizeUsername,
} from "./authIdentity";
import {
  ensureUser,
  requireAnyPermission,
  requireName,
  requirePermission,
  resolveAppUser,
} from "./identity";
import { insertOrganizationWithRoles } from "./orgBootstrap";
import { isPermission } from "./permissions";
import { assertPasswordRequirements } from "./passwordPolicy";
import { normalizeSiteCodeFormat } from "./siteCodes";
import { MAX_PAGE } from "./limits";

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }
    const resolved = await resolveAppUser(ctx);
    if (!resolved) {
      return [];
    }
    const { user } = resolved;
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
        roleName: role.name,
        siteCodeFormat: normalizeSiteCodeFormat(organization.siteCodeFormat),
        permissions: role.permissions.filter(isPermission),
      });
    }
    return rows;
  },
});

/**
 * Public self-serve org create is disabled in production.
 * Escape hatch: ALLOW_SELF_SERVE_ORGS=1 (used by convex-test).
 * Production path: platformAdmin.createOrganization.
 */
export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    if (process.env.ALLOW_SELF_SERVE_ORGS !== "1") {
      throw new ConvexError(
        "Organization creation is restricted to platform administrators.",
      );
    }
    const { user } = await ensureUser(ctx);
    const name = requireName(args.name, "Organization name");
    const { organizationId, adminRoleId } = await insertOrganizationWithRoles(ctx, {
      name,
    });
    await ctx.db.insert("memberships", {
      organizationId,
      userId: user._id,
      roleId: adminRoleId,
    });
    await writeAudit(ctx, organizationId, "organization.create", organizationId);
    return organizationId;
  },
});

export const setSiteCodeFormat = mutation({
  args: {
    organizationId: v.id("organizations"),
    format: v.union(v.literal("numeric"), v.literal("text")),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "manage.sites");
    const org = await ctx.db.get(args.organizationId);
    if (!org) {
      throw new Error("Forbidden");
    }
    await ctx.db.patch(org._id, { siteCodeFormat: args.format });
    await writeAudit(ctx, args.organizationId, "organization.siteCodeFormat", org._id);
    return { format: args.format };
  },
});

export const settings = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "view.dashboard");
    const org = await ctx.db.get(args.organizationId);
    if (!org) {
      throw new Error("Forbidden");
    }
    return {
      name: org.name,
      siteCodeFormat: normalizeSiteCodeFormat(org.siteCodeFormat),
    };
  },
});

/** Internal: create org + roles (platform bootstrap). */
export const insertBootstrappedOrg = internalMutation({
  args: {
    name: v.string(),
    siteCodeFormat: v.optional(v.union(v.literal("numeric"), v.literal("text"))),
    adminUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const name = requireName(args.name, "Organization name");
    const { organizationId, adminRoleId } = await insertOrganizationWithRoles(ctx, {
      name,
      siteCodeFormat: args.siteCodeFormat,
    });
    if (args.adminUserId) {
      await ctx.db.insert("memberships", {
        organizationId,
        userId: args.adminUserId,
        roleId: adminRoleId,
      });
    }
    await writeAudit(ctx, organizationId, "organization.create", organizationId);
    return { organizationId, adminRoleId };
  },
});

/** Internal: attach membership after account creation. */
export const attachMembership = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    roleId: v.id("roles"),
  },
  handler: async (ctx, args) => {
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

/**
 * Org admin creates a member account + membership in one step.
 * Requires manage.users. Uses Convex Auth createAccount (bypasses public signup).
 */
export const createMember = action({
  args: {
    organizationId: v.id("organizations"),
    email: v.string(),
    username: v.string(),
    name: v.optional(v.string()),
    password: v.string(),
    roleId: v.id("roles"),
  },
  handler: async (ctx, args) => {
    const me = (await ctx.runQuery(api.organizations.mine, {})) as Array<{
      organizationId: string;
      permissions: string[];
    }>;
    const membership = me.find((row) => row.organizationId === args.organizationId);
    if (!membership?.permissions.includes("manage.users")) {
      throw new ConvexError("Forbidden");
    }
    const email = normalizeEmail(args.email);
    if (!email) {
      throw new ConvexError("Email is required");
    }
    const username = normalizeUsername(args.username);
    if (!username) {
      throw new ConvexError("Username is required");
    }
    assertPasswordRequirements(args.password);
    const displayName =
      typeof args.name === "string" && args.name.trim().length > 0
        ? args.name.trim()
        : username;
    const created = await createAccount(ctx, {
      provider: "password",
      account: { id: email, secret: args.password },
      profile: {
        email,
        username,
        name: displayName,
      },
      shouldLinkViaEmail: true,
    });
    await ctx.runMutation(internal.organizations.attachMembership, {
      organizationId: args.organizationId,
      userId: created.user._id,
      roleId: args.roleId,
    });
    return {
      userId: created.user._id,
      email,
      username,
      name: displayName,
    };
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

export const updateRole = mutation({
  args: {
    organizationId: v.id("organizations"),
    roleId: v.id("roles"),
    name: v.string(),
    permissions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "manage.roles");
    const role = await ctx.db.get(args.roleId);
    if (!role || role.organizationId !== args.organizationId) {
      throw new Error("Forbidden");
    }
    const name = requireName(args.name, "Role name");
    if (args.permissions.length < 1 || args.permissions.some((item) => !isPermission(item))) {
      throw new Error("Unknown permission");
    }
    await ctx.db.patch(role._id, { name, permissions: args.permissions });
    await writeAudit(ctx, args.organizationId, "role.update", role._id);
    return role._id;
  },
});

export const listRoles = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireAnyPermission(ctx, args.organizationId, ["manage.roles", "manage.users"]);
    const roles = await ctx.db
      .query("roles")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .take(MAX_PAGE);
    return roles
      .filter((role) => role.organizationId === args.organizationId)
      .map((role) => ({
        roleId: role._id,
        name: role.name,
        permissions: role.permissions.filter(isPermission),
      }));
  },
});

export const roster = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "manage.users");
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) => q.eq("organizationId", args.organizationId))
      .take(MAX_PAGE);
    const rows = [];
    for (const membership of memberships) {
      const user = await ctx.db.get(membership.userId);
      const role = await ctx.db.get(membership.roleId);
      if (!user || !role || role.organizationId !== args.organizationId) {
        continue;
      }
      rows.push({
        userId: user._id,
        name: user.name ?? user.email ?? user._id,
        roleId: role._id,
        roleName: role.name,
      });
    }
    return rows;
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
