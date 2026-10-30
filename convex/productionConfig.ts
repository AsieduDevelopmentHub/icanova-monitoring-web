/**
 * Production configuration checks. Values are supplied by the operator.
 * This module never invents issuers, JWKS URLs, audiences, or secrets.
 *
 * A successful productionReady / productionProfileReady result is not proof of:
 * backup restore, live IdP login, or physical gateway/DSE communication.
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

function isTruthyFlag(value: string | undefined | null): boolean {
  const v = trimmed(value).toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on" || v === "enabled";
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

const PLACEHOLDER_SECRET_FRAGMENTS = [
  "changeme",
  "placeholder",
  "example",
  "your-",
  "todo",
  "replace",
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

function looksLikePlaceholderSecret(value: string): boolean {
  const lower = value.toLowerCase();
  return PLACEHOLDER_SECRET_FRAGMENTS.some((fragment) => lower.includes(fragment));
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
  if (looksLikePlaceholderSecret(secret)) {
    return [
      {
        code: "ingest.secret_placeholder",
        message: "INGEST_SECRET looks like a placeholder. Use a strong operator-supplied secret.",
      },
    ];
  }
  return [];
}

/**
 * When email or SMS alerting is enabled, fail closed if provider credentials are missing
 * or placeholder. Disabled channels do not require keys.
 */
export function validateNotifyEnv(env: {
  EMAIL_ALERTS_ENABLED?: string;
  SMS_ALERTS_ENABLED?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  ARKESEL_API_KEY?: string;
  ARKESEL_SENDER?: string;
}): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  if (isTruthyFlag(env.EMAIL_ALERTS_ENABLED)) {
    const key = trimmed(env.RESEND_API_KEY);
    const from = trimmed(env.RESEND_FROM);
    if (!key || looksLikePlaceholderSecret(key)) {
      issues.push({
        code: "notify.email_key",
        message: "EMAIL_ALERTS_ENABLED requires a real RESEND_API_KEY.",
      });
    }
    if (!from || from.includes("example.com") || from.includes("changeme")) {
      issues.push({
        code: "notify.email_from",
        message: "EMAIL_ALERTS_ENABLED requires a real RESEND_FROM address.",
      });
    }
  }
  if (isTruthyFlag(env.SMS_ALERTS_ENABLED)) {
    const key = trimmed(env.ARKESEL_API_KEY);
    const sender = trimmed(env.ARKESEL_SENDER);
    if (!key || looksLikePlaceholderSecret(key)) {
      issues.push({
        code: "notify.sms_key",
        message: "SMS_ALERTS_ENABLED requires a real ARKESEL_API_KEY.",
      });
    }
    if (!sender || looksLikePlaceholderSecret(sender)) {
      issues.push({
        code: "notify.sms_sender",
        message: "SMS_ALERTS_ENABLED requires a real ARKESEL_SENDER.",
      });
    }
  }
  return issues;
}

/** Frontend / Convex cloud URL for a production profile must be https and non-placeholder. */
export function validateAppUrlEnv(env: {
  VITE_CONVEX_URL?: string;
  CONVEX_CLOUD_URL?: string;
}): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  const url = trimmed(env.VITE_CONVEX_URL) || trimmed(env.CONVEX_CLOUD_URL);
  if (!url) {
    issues.push({
      code: "app.url_missing",
      message: "Production profile requires VITE_CONVEX_URL (or CONVEX_CLOUD_URL) as https.",
    });
    return issues;
  }
  if (!isHttpsUrl(url)) {
    issues.push({
      code: "app.url_not_https",
      message: "Application Convex URL must be https.",
    });
  } else if (looksLikePlaceholderAuthUrl(url)) {
    issues.push({
      code: "app.url_placeholder",
      message: "Application Convex URL looks like a placeholder host.",
    });
  }
  return issues;
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
  EMAIL_ALERTS_ENABLED?: string;
  SMS_ALERTS_ENABLED?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  ARKESEL_API_KEY?: string;
  ARKESEL_SENDER?: string;
}): { ok: boolean; issues: ConfigIssue[] } {
  const issues = [
    ...validateAuthEnv(env),
    ...validateIngestEnv(env),
    ...validateNotifyEnv(env),
  ];
  return { ok: issues.length === 0, issues };
}

/**
 * Broader profile check including app URL. Still not equivalent to production approval.
 */
export function productionProfileReady(env: {
  AUTH_JWT_ISSUER?: string;
  AUTH_JWKS_URL?: string;
  AUTH_JWT_AUDIENCE?: string;
  INGEST_SECRET?: string;
  EMAIL_ALERTS_ENABLED?: string;
  SMS_ALERTS_ENABLED?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  ARKESEL_API_KEY?: string;
  ARKESEL_SENDER?: string;
  VITE_CONVEX_URL?: string;
  CONVEX_CLOUD_URL?: string;
}): { ok: boolean; issues: ConfigIssue[] } {
  const issues = [...productionReady(env).issues, ...validateAppUrlEnv(env)];
  return { ok: issues.length === 0, issues };
}
