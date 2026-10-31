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

/** Resolve the app users row for the current identity without creating one. */
export async function resolveAppUser(ctx: DbCtx) {
  const identity = await requireIdentity(ctx);
  const byToken = await userByToken(ctx, identity.tokenIdentifier);
  if (byToken) {
    return { identity, user: byToken };
  }
  const email = normalizeEmail(identity.email);
  if (email) {
    const byEmail = await userByEmail(ctx, email);
    if (byEmail) {
      return { identity, user: byEmail };
    }
  }
  const subject = identity.subject?.trim() ?? "";
  if (subject.length > 0) {
    try {
      const byId = await ctx.db.get(subject as Id<"users">);
      if (byId) {
        return { identity, user: byId };
      }
    } catch {
      // not a users id
    }
  }
  return null;
}

function normalizeEmail(email: string | undefined | null): string | null {
  const trimmed = email?.trim().toLowerCase() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export async function userByEmail(ctx: DbCtx, email: string) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return null;
  }
  return await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", normalized))
    .unique();
}

/**
 * Resolve or create the application users row for the signed-in identity.
 * Email-rebind: if tokenIdentifier is new but email matches a legacy Auth0 row,
 * patch that row (preserve memberships) instead of inserting a duplicate.
 */
export async function ensureUser(ctx: MutationCtx) {
  const identity = await requireIdentity(ctx);
  const existing = await userByToken(ctx, identity.tokenIdentifier);
  if (existing) {
    const patch: {
      email?: string;
      phone?: string;
      name?: string;
    } = {};
    const email = normalizeEmail(identity.email);
    if (email && existing.email !== email) {
      patch.email = email;
    }
    if (identity.phoneNumber && existing.phone !== identity.phoneNumber) {
      patch.phone = identity.phoneNumber;
    }
    if (identity.name && existing.name !== identity.name) {
      patch.name = identity.name;
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(existing._id, patch);
      const updated = await ctx.db.get(existing._id);
      if (!updated) {
        throw new Error("Unauthorized");
      }
      return { identity, user: updated };
    }
    return { identity, user: existing };
  }

  const email = normalizeEmail(identity.email);
  if (email) {
    const byEmail = await userByEmail(ctx, email);
    if (byEmail) {
      await ctx.db.patch(byEmail._id, {
        tokenIdentifier: identity.tokenIdentifier,
        email,
        phone: identity.phoneNumber ?? byEmail.phone,
        name: identity.name ?? byEmail.name,
      });
      const rebound = await ctx.db.get(byEmail._id);
      if (!rebound) {
        throw new Error("Unauthorized");
      }
      return { identity, user: rebound };
    }
  }

  // Convex Auth may have already inserted the users row (same subject as user id).
  const subject = identity.subject?.trim() ?? "";
  if (subject.length > 0) {
    try {
      const byId = await ctx.db.get(subject as Id<"users">);
      if (byId) {
        await ctx.db.patch(byId._id, {
          tokenIdentifier: identity.tokenIdentifier,
          email: email ?? byId.email,
          phone: identity.phoneNumber ?? byId.phone,
          name: identity.name ?? byId.name,
        });
        const patched = await ctx.db.get(byId._id);
        if (!patched) {
          throw new Error("Unauthorized");
        }
        return { identity, user: patched };
      }
    } catch {
      // subject is not a users id — fall through to insert
    }
  }

  const userId = await ctx.db.insert("users", {
    tokenIdentifier: identity.tokenIdentifier,
    email: email ?? undefined,
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
  const resolved = await resolveAppUser(ctx);
  if (!resolved) {
    throw new Error("Forbidden");
  }
  const { identity, user } = resolved;
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
  const resolved = await resolveAppUser(ctx);
  if (!resolved) {
    return null;
  }
  const { user } = resolved;
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
