import { v } from "convex/values";
import { query } from "./_generated/server";
import { isSignupEnabled, resolveLoginEmail } from "./authIdentity";

/** Public: whether the SPA should show self-signup (driven by AUTH_SIGNUP_ENABLED). */
export const signupEnabled = query({
  args: {},
  handler: async () => {
    return isSignupEnabled();
  },
});

/**
 * Public: map username-or-email → account email for Password sign-in.
 * Returns the identifier as email when it looks like an email, or the user's
 * email when a username matches. Unknown usernames return null (client still
 * attempts sign-in with the raw value so failures look the same).
 */
export const resolveSignInEmail = query({
  args: { identifier: v.string() },
  handler: async (ctx, args) => {
    const email = await resolveLoginEmail(ctx, args.identifier);
    return { email };
  },
});
