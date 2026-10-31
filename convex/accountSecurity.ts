import {
  getAuthSessionId,
  getAuthUserId,
  invalidateSessions,
  modifyAccountCredentials,
  retrieveAccount,
} from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalQuery } from "./_generated/server";
import { assertPasswordRequirements } from "./passwordPolicy";

export const emailForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    const email = user?.email?.trim().toLowerCase() ?? "";
    return email.length > 0 ? email : null;
  },
});

/**
 * Authenticated password rotation for Convex Auth Password accounts.
 * Verifies the current password, applies shared policy, updates credentials,
 * and invalidates other sessions (keeps the current session).
 */
export const changePassword = action({
  args: {
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Unauthorized");
    }
    if (args.currentPassword === args.newPassword) {
      throw new ConvexError("New password must be different from the current password.");
    }
    assertPasswordRequirements(args.newPassword);

    const email = await ctx.runQuery(internal.accountSecurity.emailForUser, { userId });
    if (!email) {
      throw new ConvexError("Account email is required to change password.");
    }

    try {
      await retrieveAccount(ctx, {
        provider: "password",
        account: { id: email, secret: args.currentPassword },
      });
    } catch {
      throw new ConvexError("Current password is incorrect.");
    }

    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: email, secret: args.newPassword },
    });

    const sessionId = await getAuthSessionId(ctx);
    await invalidateSessions(ctx, {
      userId,
      except: sessionId ? [sessionId] : undefined,
    });

    return { ok: true as const };
  },
});
