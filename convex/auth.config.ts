/**
 * Active authentication: Convex Auth (Password).
 * Auth0 customJwt is retained only as a future integration example —
 * see convex/integrations/auth0AuthConfig.example.ts (not loaded).
 *
 * Do not register Auth0 and Convex Auth providers together in the active flow
 * (competing identities).
 */
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
