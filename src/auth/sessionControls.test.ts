import { describe, expect, test } from "vitest";
import { sessionChrome } from "./sessionControls";

describe("sessionChrome", () => {
  test("unauthenticated always exposes Sign In (Convex Auth does not require Auth0 env)", () => {
    expect(sessionChrome({ isAuthenticated: false, authReady: true })).toEqual({
      label: "Not signed in",
      showSignIn: true,
      showSignOut: false,
      signOutLabel: "Sign out",
      authReady: true,
    });
    expect(sessionChrome({ isAuthenticated: false, authReady: false }).showSignIn).toBe(true);
  });

  test("authenticated exposes Sign Out and hides Sign In", () => {
    expect(sessionChrome({ isAuthenticated: true, authReady: true })).toMatchObject({
      label: "Signed in",
      showSignIn: false,
      showSignOut: true,
      signOutLabel: "Sign out",
    });
  });
});
