import { describe, expect, it } from "vitest";
import {
  authProviderReady,
  configurationAssessment,
  isHttpsUrl,
  productionProfileReady,
  productionReady,
  testNotifyDestinations,
  validateAppUrlEnv,
  validateAuthEnv,
  validateIngestEnv,
  validateNotifyEnv,
} from "../convex/productionConfig";

describe("productionConfig", () => {
  it("rejects disabled or missing auth endpoints", () => {
    expect(authProviderReady("disabled", "disabled")).toBe(false);
    expect(authProviderReady(undefined, "https://login.auth0.com/.well-known/jwks.json")).toBe(false);
    expect(authProviderReady("https://login.auth0.com/", undefined)).toBe(false);
    expect(
      authProviderReady("http://login.auth0.com/", "https://login.auth0.com/.well-known/jwks.json"),
    ).toBe(false);
    expect(
      authProviderReady("https://login.auth0.com/", "https://login.auth0.com/.well-known/jwks.json"),
    ).toBe(true);
  });

  it("rejects placeholder issuer hosts", () => {
    expect(authProviderReady("https://issuer.example", "https://issuer.example/jwks")).toBe(false);
    expect(authProviderReady("https://example.com", "https://example.com/jwks")).toBe(false);
    expect(
      validateAuthEnv({
        AUTH_JWT_ISSUER: "https://issuer.example",
        AUTH_JWKS_URL: "https://issuer.example/jwks",
        AUTH_JWT_AUDIENCE: "dse-gateway",
      }).map((i) => i.code),
    ).toEqual(["auth.issuer_placeholder", "auth.jwks_placeholder"]);
  });

  it("requires https URLs", () => {
    expect(isHttpsUrl("https://example.com")).toBe(true);
    expect(isHttpsUrl("http://example.com")).toBe(false);
    expect(isHttpsUrl("not-a-url")).toBe(false);
  });

  it("lists concrete auth issues without inventing values", () => {
    const issues = validateAuthEnv({
      AUTH_JWT_ISSUER: "disabled",
      AUTH_JWKS_URL: "",
      AUTH_JWT_AUDIENCE: "",
    });
    expect(issues.map((i) => i.code)).toEqual([
      "auth.issuer_missing",
      "auth.jwks_missing",
      "auth.audience_missing",
    ]);
  });

  it("requires a sufficiently long non-placeholder ingest secret", () => {
    expect(validateIngestEnv({}).map((i) => i.code)).toEqual(["ingest.secret_missing"]);
    expect(validateIngestEnv({ INGEST_SECRET: "short" }).map((i) => i.code)).toEqual([
      "ingest.secret_short",
    ]);
    expect(
      validateIngestEnv({ INGEST_SECRET: "changeme" + "a".repeat(30) }).map((i) => i.code),
    ).toEqual(["ingest.secret_placeholder"]);
    expect(validateIngestEnv({ INGEST_SECRET: "a".repeat(32) })).toEqual([]);
  });

  it("treats test notify destinations as optional lab overrides", () => {
    expect(testNotifyDestinations({})).toEqual({ email: null, phone: null });
    expect(
      testNotifyDestinations({
        TEST_NOTIFY_EMAIL: " lab@example.com ",
        TEST_NOTIFY_PHONE: "+233000000000",
      }),
    ).toEqual({ email: "lab@example.com", phone: "+233000000000" });
  });

  it("fails closed when email or SMS alerts are enabled without real credentials", () => {
    expect(validateNotifyEnv({})).toEqual([]);
    expect(
      validateNotifyEnv({
        EMAIL_ALERTS_ENABLED: "true",
        RESEND_API_KEY: "re_placeholder",
        RESEND_FROM: "alerts@example.com",
      }).map((i) => i.code),
    ).toContain("notify.email_key");
    expect(
      validateNotifyEnv({
        SMS_ALERTS_ENABLED: "1",
        ARKESEL_API_KEY: "real-key-value-here",
        ARKESEL_SENDER: "DSE",
      }),
    ).toEqual([]);
  });

  it("requires https app Convex URL for production profile", () => {
    expect(validateAppUrlEnv({}).map((i) => i.code)).toEqual(["app.url_missing"]);
    expect(validateAppUrlEnv({ VITE_CONVEX_URL: "http://localhost:3000" }).map((i) => i.code)).toEqual([
      "app.url_not_https",
    ]);
    expect(
      validateAppUrlEnv({ VITE_CONVEX_URL: "https://effervescent-kangaroo-10.convex.cloud" }),
    ).toEqual([]);
  });

  it("productionReady needs auth and ingest together", () => {
    expect(productionReady({}).ok).toBe(false);
    expect(
      productionReady({
        AUTH_JWT_ISSUER: "https://login.auth0.com/",
        AUTH_JWKS_URL: "https://login.auth0.com/.well-known/jwks.json",
        AUTH_JWT_AUDIENCE: "dse-gateway",
        INGEST_SECRET: "a".repeat(32),
      }).ok,
    ).toBe(true);
  });

  it("productionProfileReady also requires app URL and still is not full approval", () => {
    expect(
      productionProfileReady({
        AUTH_JWT_ISSUER: "https://login.auth0.com/",
        AUTH_JWKS_URL: "https://login.auth0.com/.well-known/jwks.json",
        AUTH_JWT_AUDIENCE: "dse-gateway",
        INGEST_SECRET: "a".repeat(32),
      }).ok,
    ).toBe(false);
    expect(
      productionProfileReady({
        AUTH_JWT_ISSUER: "https://login.auth0.com/",
        AUTH_JWKS_URL: "https://login.auth0.com/.well-known/jwks.json",
        AUTH_JWT_AUDIENCE: "dse-gateway",
        INGEST_SECRET: "a".repeat(32),
        VITE_CONVEX_URL: "https://my-prod.convex.cloud",
      }).ok,
    ).toBe(true);
  });

  it("configurationAssessment distinguishes missing placeholder invalid and valid_unverified", () => {
    expect(configurationAssessment({}).status).toBe("missing");
    expect(
      configurationAssessment({
        AUTH_JWT_ISSUER: "https://issuer.example",
        AUTH_JWKS_URL: "https://issuer.example/jwks",
        AUTH_JWT_AUDIENCE: "dse-gateway",
        INGEST_SECRET: "a".repeat(32),
        VITE_CONVEX_URL: "https://my-prod.convex.cloud",
      }).status,
    ).toBe("placeholder");
    expect(
      configurationAssessment({
        AUTH_JWT_ISSUER: "https://login.auth0.com/",
        AUTH_JWKS_URL: "https://login.auth0.com/.well-known/jwks.json",
        AUTH_JWT_AUDIENCE: "dse-gateway",
        INGEST_SECRET: "a".repeat(32),
        VITE_CONVEX_URL: "https://my-prod.convex.cloud",
      }).status,
    ).toBe("valid_unverified");
  });
});
