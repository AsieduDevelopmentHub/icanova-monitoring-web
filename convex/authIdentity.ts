import { ConvexError } from "convex/values";
import type { QueryCtx } from "./_generated/server";

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;

/** `AUTH_SIGNUP_ENABLED=0|false` disables public self-signup. Unset/other → enabled. */
export function isSignupEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.AUTH_SIGNUP_ENABLED?.trim().toLowerCase();
  if (raw === undefined || raw === "") {
    return true;
  }
  return raw !== "0" && raw !== "false" && raw !== "off" && raw !== "no";
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
