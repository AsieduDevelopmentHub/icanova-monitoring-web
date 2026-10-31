/**
 * FUTURE INTEGRATION ONLY — not imported by the running app.
 *
 * Example Auth0 customJwt provider config previously used as the active IdP.
 * To reactivate Auth0 enterprise login later:
 * 1. Remove competing Convex Auth Password from the default UX (or run a dedicated IdP cutover).
 * 2. Set AUTH_JWT_ISSUER, AUTH_JWKS_URL, AUTH_JWT_AUDIENCE on the target deployment.
 * 3. Replace convex/auth.config.ts providers with the block below (do not dual-register).
 * 4. Re-enable SPA OIDC under src/auth/integrations/auth0/ with matching VITE_OIDC_*.
 *
 * Never accept an ID token as a Convex bearer. Audience must fail closed (no dse-gateway fallback).
 */

function configured(value: string | undefined) {
  const text = value?.trim() ?? "";
  if (!text || text === "disabled") {
    return undefined;
  }
  return text;
}

/** Illustrative shape only — copy into auth.config.ts during a controlled cutover. */
export function auth0CustomJwtProvidersExample() {
  const issuer = configured(process.env.AUTH_JWT_ISSUER);
  const jwks = configured(process.env.AUTH_JWKS_URL);
  const applicationID = configured(process.env.AUTH_JWT_AUDIENCE);
  if (!issuer || !jwks || !applicationID) {
    return [];
  }
  return [
    {
      type: "customJwt" as const,
      applicationID,
      issuer,
      jwks,
      algorithm: "RS256" as const,
    },
  ];
}
