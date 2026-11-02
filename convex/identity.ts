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

/** Convex Auth tokenIdentifier is often `{issuer}|{usersId}|{sessionId}`. */
async function userFromAuthToken(ctx: DbCtx, tokenIdentifier: string, subject?: string) {
  const candidates = new Set<string>();
  const sub = subject?.trim() ?? "";
  if (sub.length > 0) {
    candidates.add(sub);
  }
  for (const part of tokenIdentifier.split("|")) {
    const trimmed = part.trim();
    if (trimmed.startsWith("mn") && trimmed.length > 20) {
      candidates.add(trimmed);
    }
  }
  for (const candidate of candidates) {
    try {
      const row = await ctx.db.get(candidate as Id<"users">);
      if (row) {
        return row;
      }
    } catch {
      // not a users id
    }
  }
  return null;
}

/** Resolve the app users row for the current identity without creating one. */
export async function resolveAppUser(ctx: DbCtx) {
  const identity = await requireIdentity(ctx);
  const email = normalizeEmail(identity.email);
  const byToken = await userByToken(ctx, identity.tokenIdentifier);
  const byEmail = email ? await userByEmail(ctx, email) : null;
  const byAuthId = await userFromAuthToken(
    ctx,
    identity.tokenIdentifier,
    identity.subject,
  );

  // Prefer the email/canonical row when a token-only duplicate also exists.
  // Memberships are usually on the email user; Convex Auth may create a separate
  // tokenIdentifier row without email, which previously made the account look unactivated.
  if (byEmail && byToken && byEmail._id !== byToken._id) {
    return { identity, user: byEmail };
  }
  if (byAuthId && byToken && byAuthId._id !== byToken._id) {
    return { identity, user: byAuthId };
  }
  if (byToken) {
    return { identity, user: byToken };
  }
  if (byEmail) {
    return { identity, user: byEmail };
  }
  if (byAuthId) {
    return { identity, user: byAuthId };
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
  const email = normalizeEmail(identity.email);
  const existing = await userByToken(ctx, identity.tokenIdentifier);
  const canonical =
    (email ? await userByEmail(ctx, email) : null) ??
    (await userFromAuthToken(ctx, identity.tokenIdentifier, identity.subject));

  if (existing && canonical && existing._id !== canonical._id) {
    // Drop the duplicate token pointer so memberships on the canonical row win.
    await ctx.db.patch(existing._id, { tokenIdentifier: undefined });
    await ctx.db.patch(canonical._id, {
      tokenIdentifier: identity.tokenIdentifier,
      email: email ?? canonical.email,
      phone: identity.phoneNumber ?? canonical.phone,
      name: identity.name ?? canonical.name,
    });
    return { identity, user: (await ctx.db.get(canonical._id))! };
  }

  if (existing) {
    const patch: {
      email?: string;
      phone?: string;
      name?: string;
    } = {};
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

  if (canonical) {
    await ctx.db.patch(canonical._id, {
      tokenIdentifier: identity.tokenIdentifier,
      email: email ?? canonical.email,
      phone: identity.phoneNumber ?? canonical.phone,
      name: identity.name ?? canonical.name,
    });
    const rebound = await ctx.db.get(canonical._id);
    if (!rebound) {
      throw new Error("Unauthorized");
    }
    return { identity, user: rebound };
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
