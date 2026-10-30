/**
 * Provider-neutral OIDC authorization-code + PKCE helpers for the SPA.
 * No client secret. Configuration is fail-closed when VITE_OIDC_* is incomplete.
 * Claim checks here are a client guard; Convex customJwt remains authoritative.
 */

import { getBearerToken, setBearerToken } from "../platform/bearer";

const PKCE_VERIFIER = "dse.oidc.pkce";
const OIDC_STATE = "dse.oidc.state";
const OIDC_NONCE = "dse.oidc.nonce";

export type OidcPublicConfig = {
  issuer: string;
  clientId: string;
  audience: string;
  redirectUri: string;
  logoutRedirectUri: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  endSessionEndpoint: string | null;
};

export type IdTokenClaims = {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  nonce?: string;
  sub?: string;
};

export function readOidcConfig(env: ImportMetaEnv = import.meta.env): OidcPublicConfig | null {
  const issuer = env.VITE_OIDC_ISSUER?.trim() ?? "";
  const clientId = env.VITE_OIDC_CLIENT_ID?.trim() ?? "";
  const audience = env.VITE_OIDC_AUDIENCE?.trim() || "dse-gateway";
  const redirectUri = env.VITE_OIDC_REDIRECT_URI?.trim() ?? "";
  const logoutRedirectUri = env.VITE_OIDC_LOGOUT_REDIRECT_URI?.trim() || redirectUri;
  if (!issuer || !clientId || !redirectUri) {
    return null;
  }
  if (!issuer.startsWith("https://")) {
    return null;
  }
  const localRedirect =
    redirectUri.startsWith("http://127.0.0.1") || redirectUri.startsWith("http://localhost");
  if (!redirectUri.startsWith("https://") && !localRedirect) {
    return null;
  }
  const base = issuer.replace(/\/$/, "");
  return {
    issuer: base,
    clientId,
    audience,
    redirectUri,
    logoutRedirectUri,
    authorizationEndpoint: env.VITE_OIDC_AUTHORIZATION_ENDPOINT?.trim() || `${base}/authorize`,
    tokenEndpoint: env.VITE_OIDC_TOKEN_ENDPOINT?.trim() || `${base}/oauth/token`,
    endSessionEndpoint: env.VITE_OIDC_END_SESSION_ENDPOINT?.trim() || null,
  };
}

export function oidcConfigured(env: ImportMetaEnv = import.meta.env): boolean {
  return readOidcConfig(env) !== null;
}

function randomUrlSafe(bytes = 32): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return base64Url(buffer);
}

function base64Url(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function createPkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(digest);
}

export async function beginLogin(config: OidcPublicConfig): Promise<string> {
  const verifier = randomUrlSafe(64);
  const state = randomUrlSafe(16);
  const nonce = randomUrlSafe(16);
  sessionStorage.setItem(PKCE_VERIFIER, verifier);
  sessionStorage.setItem(OIDC_STATE, state);
  sessionStorage.setItem(OIDC_NONCE, nonce);
  const challenge = await createPkceChallenge(verifier);
  const url = new URL(config.authorizationEndpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (config.audience) {
    url.searchParams.set("audience", config.audience);
  }
  return url.toString();
}

export function decodeJwtPayload(token: string): IdTokenClaims {
  const parts = token.split(".");
  if (parts.length < 2) {
    throw new Error("Malformed JWT");
  }
  const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
  return JSON.parse(atob(padded)) as IdTokenClaims;
}

export function validateIdTokenClaims(
  claims: IdTokenClaims,
  expected: { issuer: string; audience: string; nonce: string; nowSec?: number },
): string | null {
  const now = expected.nowSec ?? Math.floor(Date.now() / 1000);
  if (!claims.iss || claims.iss.replace(/\/$/, "") !== expected.issuer.replace(/\/$/, "")) {
    return "invalid_issuer";
  }
  const aud = Array.isArray(claims.aud) ? claims.aud : claims.aud ? [claims.aud] : [];
  if (!aud.includes(expected.audience)) {
    return "invalid_audience";
  }
  if (typeof claims.exp !== "number" || claims.exp <= now) {
    return "expired";
  }
  if (typeof claims.nbf === "number" && claims.nbf > now + 60) {
    return "not_before";
  }
  if (!claims.nonce || claims.nonce !== expected.nonce) {
    return "invalid_nonce";
  }
  return null;
}

export function consumeOidcState(presented: string | null): boolean {
  const expected = sessionStorage.getItem(OIDC_STATE);
  sessionStorage.removeItem(OIDC_STATE);
  return Boolean(expected && presented && expected === presented);
}

export function takePkceVerifier(): string | null {
  const value = sessionStorage.getItem(PKCE_VERIFIER);
  sessionStorage.removeItem(PKCE_VERIFIER);
  return value;
}

export function takeNonce(): string | null {
  const value = sessionStorage.getItem(OIDC_NONCE);
  sessionStorage.removeItem(OIDC_NONCE);
  return value;
}

export type TokenExchangeResult =
  | { ok: true; accessToken: string; idToken: string }
  | { ok: false; reason: string };

/** Public-client token exchange. Does not log tokens. */
export async function exchangeAuthorizationCode(
  config: OidcPublicConfig,
  code: string,
  verifier: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TokenExchangeResult> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.clientId,
    code,
    redirect_uri: config.redirectUri,
    code_verifier: verifier,
  });
  const response = await fetchImpl(config.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    return { ok: false, reason: "token_endpoint_rejected" };
  }
  const json = (await response.json()) as {
    access_token?: string;
    id_token?: string;
  };
  if (!json.access_token || !json.id_token) {
    return { ok: false, reason: "missing_tokens" };
  }
  return { ok: true, accessToken: json.access_token, idToken: json.id_token };
}

export async function completeLoginFromCallback(
  config: OidcPublicConfig,
  params: URLSearchParams,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!consumeOidcState(params.get("state"))) {
    return { ok: false, reason: "invalid_state" };
  }
  const code = params.get("code");
  const verifier = takePkceVerifier();
  const nonce = takeNonce();
  if (!code || !verifier || !nonce) {
    return { ok: false, reason: "missing_pkce" };
  }
  const exchanged = await exchangeAuthorizationCode(config, code, verifier, fetchImpl);
  if (!exchanged.ok) {
    return exchanged;
  }
  let claims: IdTokenClaims;
  try {
    claims = decodeJwtPayload(exchanged.idToken);
  } catch {
    return { ok: false, reason: "malformed_id_token" };
  }
  const claimError = validateIdTokenClaims(claims, {
    issuer: config.issuer,
    audience: config.audience,
    nonce,
  });
  if (claimError) {
    return { ok: false, reason: claimError };
  }
  // Convex customJwt expects the access token (or IdP-configured JWT) as bearer.
  setBearerToken(exchanged.accessToken);
  return { ok: true };
}

export function logout(config: OidcPublicConfig | null) {
  setBearerToken(null);
  sessionStorage.removeItem(PKCE_VERIFIER);
  sessionStorage.removeItem(OIDC_STATE);
  sessionStorage.removeItem(OIDC_NONCE);
  if (config?.endSessionEndpoint) {
    const url = new URL(config.endSessionEndpoint);
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("post_logout_redirect_uri", config.logoutRedirectUri);
    window.location.assign(url.toString());
    return;
  }
  window.location.assign("/");
}

export function sessionBearerPresent(): boolean {
  return Boolean(getBearerToken());
}
