/**
 * Pure helpers for header/session auth entry-point UX.
 * Active provider is Convex Auth; Auth0 OIDC is inactive by default.
 */

export type SessionChrome = {
  label: string;
  showSignIn: boolean;
  showSignOut: boolean;
  signOutLabel: "Sign out" | "Clear session";
  authReady: boolean;
};

export function sessionChrome(args: {
  isAuthenticated: boolean;
  authReady: boolean;
}): SessionChrome {
  if (args.isAuthenticated) {
    return {
      label: "Signed in",
      showSignIn: false,
      showSignOut: true,
      signOutLabel: "Sign out",
      authReady: args.authReady,
    };
  }
  return {
    label: "Not signed in",
    showSignIn: true,
    showSignOut: false,
    signOutLabel: "Sign out",
    authReady: args.authReady,
  };
}
