import { describe, expect, it } from "vitest";
import {
  authProviderReady,
  isHttpsUrl,
  productionReady,
  testNotifyDestinations,
  validateAuthEnv,
  validateIngestEnv,
} from "../convex/productionConfig";

describe("productionConfig", () => {
  it("rejects disabled or missing auth endpoints", () => {
    expect(authProviderReady("disabled", "disabled")).toBe(false);
    expect(authProviderReady(undefined, "https://login.auth0.com/.well-known/jwks.json")).toBe(false);
    expect(authProviderReady("https://login.auth0.com/", undefined)).toBe(false);
    expect(authProviderReady("http://login.auth0.com/", "https://login.auth0.com/.well-known/jwks.json")).toBe(
      false,
    );
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

  it("requires a sufficiently long ingest secret", () => {
    expect(validateIngestEnv({}).map((i) => i.code)).toEqual(["ingest.secret_missing"]);
    expect(validateIngestEnv({ INGEST_SECRET: "short" }).map((i) => i.code)).toEqual([
      "ingest.secret_short",
    ]);
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
});
