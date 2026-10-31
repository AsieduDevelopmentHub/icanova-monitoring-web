import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { isPermission, type Permission } from "./permissions";

type DbCtx = QueryCtx | MutationCtx;

export async function requireIdentity(ctx: DbCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthorized");
  }
  return identity;
}

export async function userByToken(ctx: DbCtx, tokenIdentifier: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", tokenIdentifier))
    .unique();
}

export async function ensureUser(ctx: MutationCtx) {
  const identity = await requireIdentity(ctx);
  const existing = await userByToken(ctx, identity.tokenIdentifier);
  if (existing) {
    return { identity, user: existing };
  }
  const userId = await ctx.db.insert("users", {
    tokenIdentifier: identity.tokenIdentifier,
    email: identity.email,
    phone: identity.phoneNumber,
    name: identity.name,
  });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new Error("Unauthorized");
  }
  return { identity, user };
}

/**
 * Membership and the role permission are checked here.
 * A hidden button is not a substitute for this function.
 */
export async function requirePermission(
  ctx: DbCtx,
  organizationId: Id<"organizations">,
  permission: Permission,
) {
  const identity = await requireIdentity(ctx);
  const user = await userByToken(ctx, identity.tokenIdentifier);
  if (!user) {
    throw new Error("Forbidden");
  }
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_org_user", (q) =>
      q.eq("organizationId", organizationId).eq("userId", user._id),
    )
    .unique();
  if (!membership) {
    throw new Error("Forbidden");
  }
  const role = await ctx.db.get(membership.roleId);
  if (!role || role.organizationId !== organizationId) {
    throw new Error("Forbidden");
  }
  if (!role.permissions.every(isPermission) || !role.permissions.includes(permission)) {
    throw new Error("Forbidden");
  }
  return { identity, user, membership, role };
}

/** The caller needs one of these permissions. A miss is Forbidden. */
export async function requireAnyPermission(
  ctx: DbCtx,
  organizationId: Id<"organizations">,
  permissions: Permission[],
) {
  for (const permission of permissions) {
    try {
      return await requirePermission(ctx, organizationId, permission);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "Forbidden") {
        throw error;
      }
    }
  }
  throw new Error("Forbidden");
}

/** Role permission strings for the signed-in member, or null if no membership. */
export async function memberPermissions(
  ctx: DbCtx,
  organizationId: Id<"organizations">,
): Promise<Permission[] | null> {
  const identity = await requireIdentity(ctx);
  const user = await userByToken(ctx, identity.tokenIdentifier);
  if (!user) {
    return null;
  }
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_org_user", (q) =>
      q.eq("organizationId", organizationId).eq("userId", user._id),
    )
    .unique();
  if (!membership) {
    return null;
  }
  const role = await ctx.db.get(membership.roleId);
  if (!role || role.organizationId !== organizationId) {
    return null;
  }
  if (!role.permissions.every(isPermission)) {
    return null;
  }
  return role.permissions as Permission[];
}

export function roleHasPermission(
  permissions: readonly Permission[] | null | undefined,
  need: Permission,
): boolean {
  return Boolean(permissions?.includes(need));
}

export function assertSameOrg<T extends string>(actual: T, expected: T) {
  if (actual !== expected) {
    throw new Error("Forbidden");
  }
}

export function requireName(value: string, label: string) {
  const name = value.trim();
  if (name.length < 1 || name.length > 80) {
    throw new Error(`${label} must be 1 to 80 characters`);
  }
  return name;
}
