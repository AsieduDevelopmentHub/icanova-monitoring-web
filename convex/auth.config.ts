import type { AuthConfig } from "convex/server";

const issuer = process.env.AUTH_JWT_ISSUER;
const jwks = process.env.AUTH_JWKS_URL;
const applicationID = process.env.AUTH_JWT_AUDIENCE ?? "dse-gateway";

const providers: AuthConfig["providers"] = [];

if (issuer && jwks) {
  providers.push({
    type: "customJwt",
    applicationID,
    issuer,
    jwks,
    algorithm: "RS256",
  });
}

export default { providers } satisfies AuthConfig;
