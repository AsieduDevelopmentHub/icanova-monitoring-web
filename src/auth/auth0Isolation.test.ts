import { describe, expect, test } from "vitest";
import { oidcConfigured, readOidcConfig } from "./integrations/auth0/oidc";

/**
 * Auth0 remains in-tree under integrations/auth0 but is inactive by default.
 * Application startup / login must not require VITE_OIDC_*.
 */

describe("Auth0 isolation (inactive by default)", () => {
  test("empty env does not configure Auth0 OIDC", () => {
    const env = {} as ImportMetaEnv;
    expect(readOidcConfig(env)).toBeNull();
    expect(oidcConfigured(env)).toBe(false);
  });

  test("partial OIDC env still fails closed", () => {
    const env = {
      VITE_OIDC_ISSUER: "https://dev-notfczud6xx8hhxf.us.auth0.com",
      VITE_OIDC_CLIENT_ID: "spa",
    } as ImportMetaEnv;
    expect(readOidcConfig(env)).toBeNull();
  });
});
