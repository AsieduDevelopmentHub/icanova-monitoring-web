import { describe, expect, test } from "vitest";
import { sessionChrome } from "./sessionControls";

describe("sessionChrome", () => {
  test("unauthenticated always exposes Sign In (even when OIDC env is incomplete)", () => {
    expect(sessionChrome({ hasBearer: false, oidcReady: false })).toEqual({
      label: "Not signed in",
      showSignIn: true,
      showSignOut: false,
      signOutLabel: "Sign out",
      oidcReady: false,
    });
    expect(sessionChrome({ hasBearer: false, oidcReady: true }).showSignIn).toBe(true);
  });

  test("authenticated exposes Sign Out / Clear session and hides Sign In", () => {
    expect(sessionChrome({ hasBearer: true, oidcReady: true })).toMatchObject({
      label: "Signed in",
      showSignIn: false,
      showSignOut: true,
      signOutLabel: "Sign out",
    });
    expect(sessionChrome({ hasBearer: true, oidcReady: false }).signOutLabel).toBe("Clear session");
  });
});
