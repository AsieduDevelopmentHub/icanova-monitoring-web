import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { PasswordResetEmail } from "./passwordResetEmail";
import { assertPasswordRequirements } from "./passwordPolicy";

function normalizeEmail(email: string | undefined): string | null {
  const trimmed = email?.trim().toLowerCase() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Reuse an existing application users row when the email matches so Auth0-era
 * memberships are preserved. Never delete or recreate org memberships here.
 */
async function createOrUpdateUser(
  ctx: MutationCtx,
  args: {
    existingUserId: Id<"users"> | null;
    profile: Record<string, unknown> & {
      email?: string;
      phone?: string;
      emailVerified?: boolean;
      phoneVerified?: boolean;
    };
  },
): Promise<Id<"users">> {
  const email = normalizeEmail(
    typeof args.profile.email === "string" ? args.profile.email : undefined,
  );
  const name = typeof args.profile.name === "string" ? args.profile.name : undefined;
  const phone =
    typeof args.profile.phone === "string" ? args.profile.phone.trim() : undefined;
  const patch: {
    email?: string;
    name?: string;
    phone?: string;
    emailVerificationTime?: number;
    phoneVerificationTime?: number;
    image?: string;
  } = {};
  if (email) {
    patch.email = email;
  }
  if (name) {
    patch.name = name;
  }
  if (phone) {
    patch.phone = phone;
  }
  if (args.profile.emailVerified) {
    patch.emailVerificationTime = Date.now();
  }
  if (args.profile.phoneVerified) {
    patch.phoneVerificationTime = Date.now();
  }
  if (typeof args.profile.image === "string") {
    patch.image = args.profile.image;
  }

  if (args.existingUserId) {
    await ctx.db.patch(args.existingUserId, patch);
    return args.existingUserId;
  }

  if (email) {
    const existing = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
  }

  return await ctx.db.insert("users", patch);
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      reset: PasswordResetEmail,
      profile(params) {
        const email = normalizeEmail(
          typeof params.email === "string" ? params.email : undefined,
        );
        if (!email) {
          throw new ConvexError("Email is required");
        }
        const name =
          typeof params.name === "string" && params.name.trim().length > 0
            ? params.name.trim()
            : undefined;
        return { email, ...(name ? { name } : {}) };
      },
      validatePasswordRequirements: assertPasswordRequirements,
    }),
  ],
  callbacks: {
    createOrUpdateUser,
  },
});
