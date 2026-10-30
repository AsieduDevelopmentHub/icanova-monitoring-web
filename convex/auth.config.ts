import type { AuthConfig } from "convex/server";

function configured(value: string | undefined) {
  const text = value?.trim() ?? "";
  if (!text || text === "disabled") {
    return undefined;
  }
  return text;
}

/** Both values must be real. The sentinel "disabled" leaves providers empty. */
export function authProviderReady(issuer: string | undefined, jwks: string | undefined) {
  return Boolean(configured(issuer) && configured(jwks));
}

const issuer = configured(process.env.AUTH_JWT_ISSUER);
const jwks = configured(process.env.AUTH_JWKS_URL);
const applicationID = configured(process.env.AUTH_JWT_AUDIENCE) ?? "dse-gateway";

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
