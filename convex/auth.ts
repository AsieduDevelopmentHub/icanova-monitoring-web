import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  assertSignupAllowed,
  normalizeEmail,
  normalizeUsername,
} from "./authIdentity";
import { PasswordResetEmail } from "./passwordResetEmail";
import { assertPasswordRequirements } from "./passwordPolicy";

async function assertUsernameAvailable(
  ctx: MutationCtx,
  username: string,
  exceptUserId: Id<"users"> | null,
): Promise<void> {
  const taken = await ctx.db
    .query("users")
    .withIndex("username", (q) => q.eq("username", username))
    .unique();
  if (taken && taken._id !== exceptUserId) {
    throw new ConvexError("That username is already taken.");
  }
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
      username?: string;
    };
  },
): Promise<Id<"users">> {
  const email = normalizeEmail(
    typeof args.profile.email === "string" ? args.profile.email : undefined,
  );
  const name = typeof args.profile.name === "string" ? args.profile.name : undefined;
  const phone =
    typeof args.profile.phone === "string" ? args.profile.phone.trim() : undefined;
  const username =
    typeof args.profile.username === "string"
      ? normalizeUsername(args.profile.username)
      : null;
  const patch: {
    email?: string;
    name?: string;
    phone?: string;
    username?: string;
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
  if (username) {
    patch.username = username;
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
    if (username) {
      await assertUsernameAvailable(ctx, username, args.existingUserId);
    }
    await ctx.db.patch(args.existingUserId, patch);
    return args.existingUserId;
  }

  if (email) {
    const existing = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();
    if (existing) {
      if (username) {
        await assertUsernameAvailable(ctx, username, existing._id);
      }
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
  }

  if (username) {
    await assertUsernameAvailable(ctx, username, null);
  }

  return await ctx.db.insert("users", patch);
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      reset: PasswordResetEmail,
      profile(params) {
        const flow = typeof params.flow === "string" ? params.flow : "";
        if (flow === "signUp") {
          assertSignupAllowed();
          const email = normalizeEmail(
            typeof params.email === "string" ? params.email : undefined,
          );
          if (!email) {
            throw new ConvexError("Email is required");
          }
          const username = normalizeUsername(
            typeof params.username === "string" ? params.username : undefined,
          );
          if (!username) {
            throw new ConvexError("Username is required");
          }
          const name =
            typeof params.name === "string" && params.name.trim().length > 0
              ? params.name.trim()
              : username;
          return { email, username, name };
        }

        // signIn / reset / reset-verification: account id is email.
        // Client resolves username → email before signIn; reset stays email-only.
        const email = normalizeEmail(
          typeof params.email === "string" ? params.email : undefined,
        );
        if (!email) {
          throw new ConvexError("Email is required");
        }
        // Return only defined fields — Password profile type forbids explicit undefined.
        return { email } as { email: string };
      },
      validatePasswordRequirements: assertPasswordRequirements,
    }),
  ],
  callbacks: {
    createOrUpdateUser,
  },
});
