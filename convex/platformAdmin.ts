import { createAccount } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { action, mutation, query, type ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import {
  assertPlatformAdminSecret,
  isPlatformAdminEmail,
  normalizeEmail,
  normalizeUsername,
} from "./authIdentity";
import { requireName, resolveAppUser } from "./identity";
import { assertPasswordRequirements } from "./passwordPolicy";
import { MAX_PAGE } from "./limits";

/** Signed-in user is on the PLATFORM_ADMIN_EMAILS allowlist. */
export const isCapable = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { capable: false as const };
    }
    // Prefer identity email — token-only user rows may omit profile email.
    const identityEmail = normalizeEmail(identity.email);
    if (isPlatformAdminEmail(identityEmail)) {
      return { capable: true as const };
    }
    const resolved = await resolveAppUser(ctx);
    const userEmail = normalizeEmail(resolved?.user.email);
    return { capable: isPlatformAdminEmail(userEmail) };
  },
});

async function assertPlatformCaller(ctx: ActionCtx, secret: string | undefined) {
  const identity = await ctx.auth.getUserIdentity();
  const email = normalizeEmail(identity?.email ?? null);
  if (isPlatformAdminEmail(email)) {
    return;
  }
  // JWT often omits email; isCapable resolves the canonical users row.
  if (identity) {
    const capable = await ctx.runQuery(api.platformAdmin.isCapable, {});
    if (capable.capable) {
      return;
    }
  }
  assertPlatformAdminSecret(secret);
}

export const listAccessRequests = query({
  args: { secret: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const resolved = await resolveAppUser(ctx);
    const emailOk = resolved && isPlatformAdminEmail(normalizeEmail(resolved.user.email));
    if (!emailOk) {
      assertPlatformAdminSecret(args.secret);
    }
    const rows = await ctx.db
      .query("accessRequests")
      .withIndex("by_status_created", (q) => q.eq("status", "pending"))
      .order("desc")
      .take(MAX_PAGE);
    return rows.map((row) => ({
      name: row.name,
      email: row.email,
      organizationHint: row.organizationHint ?? null,
      note: row.note ?? null,
      createdAt: row.createdAt,
      requestKey: row._id,
    }));
  },
});

export const createOrganization = action({
  args: {
    secret: v.optional(v.string()),
    name: v.string(),
    siteCodeFormat: v.optional(v.union(v.literal("numeric"), v.literal("text"))),
    adminEmail: v.optional(v.string()),
    adminUsername: v.optional(v.string()),
    adminPassword: v.optional(v.string()),
    adminName: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    organizationId: Id<"organizations">;
    adminRoleId: Id<"roles">;
    adminUserId: Id<"users"> | null;
  }> => {
    await assertPlatformCaller(ctx, args.secret);
    const name = requireName(args.name, "Organization name");
    let adminUserId: Id<"users"> | undefined;
    if (args.adminEmail && args.adminUsername && args.adminPassword) {
      const email = normalizeEmail(args.adminEmail);
      if (!email) {
        throw new ConvexError("Admin email is required");
      }
      const username = normalizeUsername(args.adminUsername);
      if (!username) {
        throw new ConvexError("Admin username is required");
      }
      assertPasswordRequirements(args.adminPassword);
      const displayName =
        typeof args.adminName === "string" && args.adminName.trim().length > 0
          ? args.adminName.trim()
          : username;
      const created = await createAccount(ctx, {
        provider: "password",
        account: { id: email, secret: args.adminPassword },
        profile: { email, username, name: displayName },
        shouldLinkViaEmail: true,
      });
      adminUserId = created.user._id as Id<"users">;
    }
    const result = (await ctx.runMutation(internal.organizations.insertBootstrappedOrg, {
      name,
      siteCodeFormat: args.siteCodeFormat,
      adminUserId,
    })) as { organizationId: Id<"organizations">; adminRoleId: Id<"roles"> };
    return {
      organizationId: result.organizationId,
      adminRoleId: result.adminRoleId,
      adminUserId: adminUserId ?? null,
    };
  },
});

export const createUserWithMembership = action({
  args: {
    secret: v.optional(v.string()),
    organizationId: v.id("organizations"),
    email: v.string(),
    username: v.string(),
    password: v.string(),
    name: v.optional(v.string()),
    roleId: v.id("roles"),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ userId: Id<"users">; email: string; username: string; name: string }> => {
    await assertPlatformCaller(ctx, args.secret);
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
      profile: { email, username, name: displayName },
      shouldLinkViaEmail: true,
    });
    const userId = created.user._id as Id<"users">;
    await ctx.runMutation(internal.organizations.attachMembership, {
      organizationId: args.organizationId,
      userId,
      roleId: args.roleId,
    });
    return {
      userId,
      email,
      username,
      name: displayName,
    };
  },
});

export const closeAccessRequest = mutation({
  args: {
    secret: v.optional(v.string()),
    requestKey: v.id("accessRequests"),
  },
  handler: async (ctx, args) => {
    const resolved = await resolveAppUser(ctx);
    const emailOk = resolved && isPlatformAdminEmail(normalizeEmail(resolved.user.email));
    if (!emailOk) {
      assertPlatformAdminSecret(args.secret);
    }
    const row = await ctx.db.get(args.requestKey);
    if (!row) {
      throw new ConvexError("Not found");
    }
    await ctx.db.patch(row._id, { status: "closed" });
    return { closed: true as const };
  },
});

/** Convenience: list roles for an org when platform-capable (for bootstrap UI). */
export const listOrgRoles = query({
  args: {
    secret: v.optional(v.string()),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const resolved = await resolveAppUser(ctx);
    const emailOk = resolved && isPlatformAdminEmail(normalizeEmail(resolved.user.email));
    if (!emailOk) {
      assertPlatformAdminSecret(args.secret);
    }
    const roles = await ctx.db
      .query("roles")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .take(MAX_PAGE);
    return roles.map((role) => ({
      roleId: role._id,
      name: role.name,
      permissions: role.permissions,
    }));
  },
});

/** Platform UI helper — org picker. */
export const listOrganizations = query({
  args: { secret: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const resolved = await resolveAppUser(ctx);
    const emailOk = resolved && isPlatformAdminEmail(normalizeEmail(resolved.user.email));
    if (!emailOk) {
      assertPlatformAdminSecret(args.secret);
    }
    const orgs = await ctx.db.query("organizations").take(MAX_PAGE);
    return orgs.map((org) => ({
      organizationId: org._id,
      name: org.name,
    }));
  },
});

/**
 * Attach the signed-in platform admin (or a secret-authorized userId) to an org.
 * Platform admin email alone does not create memberships — this does.
 */
export const attachSelfToOrganization = mutation({
  args: {
    secret: v.optional(v.string()),
    organizationId: v.id("organizations"),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    // Do not call resolveAppUser first — it requires a session and blocks secret bootstrap.
    const identity = await ctx.auth.getUserIdentity();
    let resolvedUserId: Id<"users"> | undefined;
    let emailOk = false;
    if (identity) {
      emailOk = isPlatformAdminEmail(normalizeEmail(identity.email));
      const resolved = await resolveAppUser(ctx);
      if (resolved) {
        resolvedUserId = resolved.user._id;
        emailOk =
          emailOk || isPlatformAdminEmail(normalizeEmail(resolved.user.email));
      }
    }
    if (!emailOk) {
      assertPlatformAdminSecret(args.secret);
    }
    const userId = args.userId ?? resolvedUserId;
    if (!userId) {
      throw new ConvexError("Sign in as a platform admin, or pass userId with the platform secret.");
    }
    const org = await ctx.db.get(args.organizationId);
    if (!org) {
      throw new ConvexError("Organization not found");
    }
    const roles = await ctx.db
      .query("roles")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .take(MAX_PAGE);
    const role =
      roles.find((row) => row.name === "Admin") ??
      roles.find((row) => row.name === "Owner") ??
      roles[0];
    if (!role) {
      throw new ConvexError("Organization has no roles");
    }
    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", userId),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { roleId: role._id });
      return { membershipId: existing._id, roleName: role.name, created: false as const };
    }
    const membershipId = await ctx.db.insert("memberships", {
      organizationId: args.organizationId,
      userId,
      roleId: role._id,
    });
    return { membershipId, roleName: role.name, created: true as const };
  },
});
