/**
 * Production configuration checks. Values are supplied by the operator.
 * This module never invents issuers, JWKS URLs, audiences, or secrets.
 */

export type ConfigIssue = {
  code: string;
  message: string;
};

function trimmed(value: string | undefined | null): string {
  return value?.trim() ?? "";
}

function isDisabled(value: string): boolean {
  return !value || value === "disabled";
}

/** Accept only absolute https URLs for production auth endpoints. */
export function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

const PLACEHOLDER_HOST_FRAGMENTS = [
  "example.com",
  "example.org",
  "localhost",
  "127.0.0.1",
  "placeholder",
  "changeme",
  "your-domain",
  "issuer.example",
];

/** Reject obviously non-production placeholder hosts. Operator must supply a real IdP. */
export function looksLikePlaceholderAuthUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return PLACEHOLDER_HOST_FRAGMENTS.some(
      (fragment) => host === fragment || host.endsWith(`.${fragment}`) || host.includes(fragment),
    );
  } catch {
    return true;
  }
}

export function authProviderReady(issuer: string | undefined, jwks: string | undefined): boolean {
  const iss = trimmed(issuer);
  const keys = trimmed(jwks);
  if (isDisabled(iss) || isDisabled(keys)) {
    return false;
  }
  if (!isHttpsUrl(iss) || !isHttpsUrl(keys)) {
    return false;
  }
  if (looksLikePlaceholderAuthUrl(iss) || looksLikePlaceholderAuthUrl(keys)) {
    return false;
  }
  return true;
}

export function validateAuthEnv(env: {
  AUTH_JWT_ISSUER?: string;
  AUTH_JWKS_URL?: string;
  AUTH_JWT_AUDIENCE?: string;
}): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  const issuer = trimmed(env.AUTH_JWT_ISSUER);
  const jwks = trimmed(env.AUTH_JWKS_URL);
  const audience = trimmed(env.AUTH_JWT_AUDIENCE);

  if (isDisabled(issuer)) {
    issues.push({
      code: "auth.issuer_missing",
      message: "AUTH_JWT_ISSUER must be a real https issuer (not empty or disabled).",
    });
  } else if (!isHttpsUrl(issuer)) {
    issues.push({
      code: "auth.issuer_not_https",
      message: "AUTH_JWT_ISSUER must be an https URL.",
    });
  } else if (looksLikePlaceholderAuthUrl(issuer)) {
    issues.push({
      code: "auth.issuer_placeholder",
      message:
        "AUTH_JWT_ISSUER looks like a placeholder. Set the real identity-provider issuer URL.",
    });
  }

  if (isDisabled(jwks)) {
    issues.push({
      code: "auth.jwks_missing",
      message: "AUTH_JWKS_URL must be a real https JWKS URL (not empty or disabled).",
    });
  } else if (!isHttpsUrl(jwks)) {
    issues.push({
      code: "auth.jwks_not_https",
      message: "AUTH_JWKS_URL must be an https URL.",
    });
  } else if (looksLikePlaceholderAuthUrl(jwks)) {
    issues.push({
      code: "auth.jwks_placeholder",
      message: "AUTH_JWKS_URL looks like a placeholder. Set the real JWKS URL from the IdP.",
    });
  }

  if (!audience || audience === "disabled") {
    issues.push({
      code: "auth.audience_missing",
      message: "AUTH_JWT_AUDIENCE must be set to the JWT audience the IdP issues.",
    });
  }

  return issues;
}

export function validateIngestEnv(env: { INGEST_SECRET?: string }): ConfigIssue[] {
  const secret = trimmed(env.INGEST_SECRET);
  if (!secret) {
    return [
      {
        code: "ingest.secret_missing",
        message: "INGEST_SECRET must be set for production ingestion.",
      },
    ];
  }
  if (secret.length < 32) {
    return [
      {
        code: "ingest.secret_short",
        message: "INGEST_SECRET should be at least 32 characters.",
      },
    ];
  }
  return [];
}

/**
 * Test destinations may be set for lab verification.
 * They must never be treated as proof that production alerting is configured.
 */
export function testNotifyDestinations(env: {
  TEST_NOTIFY_EMAIL?: string;
  TEST_NOTIFY_PHONE?: string;
}): { email: string | null; phone: string | null } {
  const email = trimmed(env.TEST_NOTIFY_EMAIL);
  const phone = trimmed(env.TEST_NOTIFY_PHONE);
  return {
    email: email || null,
    phone: phone || null,
  };
}

export function productionReady(env: {
  AUTH_JWT_ISSUER?: string;
  AUTH_JWKS_URL?: string;
  AUTH_JWT_AUDIENCE?: string;
  INGEST_SECRET?: string;
}): { ok: boolean; issues: ConfigIssue[] } {
  const issues = [...validateAuthEnv(env), ...validateIngestEnv(env)];
  return { ok: issues.length === 0, issues };
}
