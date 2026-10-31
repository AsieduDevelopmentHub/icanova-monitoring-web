/**
 * Pure helpers for header/session auth entry-point UX.
 * Does not invent Auth0 config; oidcConfigured() remains fail-closed.
 */

export type SessionChrome = {
  label: string;
  showSignIn: boolean;
  showSignOut: boolean;
  signOutLabel: "Sign out" | "Clear session";
  oidcReady: boolean;
};

export function sessionChrome(args: {
  hasBearer: boolean;
  oidcReady: boolean;
}): SessionChrome {
  if (args.hasBearer) {
    return {
      label: "Signed in",
      showSignIn: false,
      showSignOut: true,
      signOutLabel: args.oidcReady ? "Sign out" : "Clear session",
      oidcReady: args.oidcReady,
    };
  }
  return {
    label: "Not signed in",
    showSignIn: true,
    showSignOut: false,
    signOutLabel: "Sign out",
    oidcReady: args.oidcReady,
  };
}
