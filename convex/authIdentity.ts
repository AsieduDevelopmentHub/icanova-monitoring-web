import { ConvexError } from "convex/values";
import type { QueryCtx } from "./_generated/server";

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;

/**
 * Public self-signup is off by default (controlled industrial platform).
 * Set `AUTH_SIGNUP_ENABLED=1|true|on|yes` to re-enable open registration.
 */
export function isSignupEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.AUTH_SIGNUP_ENABLED?.trim().toLowerCase();
  if (raw === undefined || raw === "") {
    return false;
  }
  return raw === "1" || raw === "true" || raw === "on" || raw === "yes";
}

/** Platform bootstrap: `PLATFORM_ADMIN_SECRET` must match the caller-supplied secret. */
export function assertPlatformAdminSecret(
  secret: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const expected = env.PLATFORM_ADMIN_SECRET?.trim() ?? "";
  if (!expected || !secret || secret !== expected) {
    throw new ConvexError("Platform admin authorization failed.");
  }
}

/** Optional email allowlist (comma-separated) for platform UI after sign-in. */
export function isPlatformAdminEmail(
  email: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = env.PLATFORM_ADMIN_EMAILS?.trim().toLowerCase() ?? "";
  if (!raw || !email) {
    return false;
  }
  const set = new Set(
    raw
      .split(",")
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean),
  );
  return set.has(email.trim().toLowerCase());
}

export function assertSignupAllowed(env: NodeJS.ProcessEnv = process.env): void {
  if (!isSignupEnabled(env)) {
    throw new ConvexError("Public signup is disabled.");
  }
}

export function normalizeEmail(email: string | undefined | null): string | null {
  const trimmed = email?.trim().toLowerCase() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Normalize and validate username. Returns null if empty.
 * Throws ConvexError if non-empty but invalid.
 */
export function normalizeUsername(username: string | undefined | null): string | null {
  const trimmed = username?.trim().toLowerCase() ?? "";
  if (trimmed.length === 0) {
    return null;
  }
  if (!USERNAME_RE.test(trimmed)) {
    throw new ConvexError(
      "Username must be 3–32 characters: letters, numbers, dots, underscores, or hyphens.",
    );
  }
  return trimmed;
}

export function looksLikeEmail(identifier: string): boolean {
  return identifier.includes("@");
}

/** Resolve a login identifier (username or email) to the account email, if known. */
export async function resolveLoginEmail(
  ctx: QueryCtx,
  identifier: string,
): Promise<string | null> {
  const raw = identifier.trim().toLowerCase();
  if (raw.length === 0) {
    return null;
  }
  if (looksLikeEmail(raw)) {
    return normalizeEmail(raw);
  }
  // Invalid usernames do not throw here — sign-in should fail the same as unknown user.
  if (!USERNAME_RE.test(raw)) {
    return null;
  }
  const user = await ctx.db
    .query("users")
    .withIndex("username", (q) => q.eq("username", raw))
    .unique();
  return normalizeEmail(user?.email);
}
