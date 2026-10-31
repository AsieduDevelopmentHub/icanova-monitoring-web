import { describe, expect, test } from "vitest";
import {
  createPkceChallenge,
  decodeJwtPayload,
  selectConvexBearer,
  validateIdTokenClaims,
} from "./oidc";

/** Mocked OIDC claim/PKCE tests — not a real IdP integration proof. */

function fakeJwt(payload: object): string {
  const head = btoa(JSON.stringify({ alg: "none", typ: "JWT" }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${head}.${body}.sig`;
}

describe("OIDC helpers (mocked)", () => {
  test("PKCE challenge is stable for a verifier", async () => {
    const a = await createPkceChallenge("verifier-one");
    const b = await createPkceChallenge("verifier-one");
    const c = await createPkceChallenge("verifier-two");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  test("rejects invalid issuer audience expiration and nonce", () => {
    const now = 1_700_000_000;
    const base = {
      iss: "https://idp.example",
      aud: "dse-gateway",
      exp: now + 60,
      nonce: "n1",
    };
    expect(
      validateIdTokenClaims(base, {
        issuer: "https://other",
        audience: "dse-gateway",
        nonce: "n1",
        nowSec: now,
      }),
    ).toBe("invalid_issuer");
    expect(
      validateIdTokenClaims(base, {
        issuer: "https://idp.example",
        audience: "wrong",
        nonce: "n1",
        nowSec: now,
      }),
    ).toBe("invalid_audience");
    expect(
      validateIdTokenClaims(
        { ...base, exp: now - 1 },
        { issuer: "https://idp.example", audience: "dse-gateway", nonce: "n1", nowSec: now },
      ),
    ).toBe("expired");
    expect(
      validateIdTokenClaims(base, {
        issuer: "https://idp.example",
        audience: "dse-gateway",
        nonce: "other",
        nowSec: now,
      }),
    ).toBe("invalid_nonce");
    expect(
      validateIdTokenClaims(base, {
        issuer: "https://idp.example",
        audience: "dse-gateway",
        nonce: "n1",
        nowSec: now,
      }),
    ).toBeNull();
  });

  test("decodeJwtPayload reads claims without verifying signature (client guard only)", () => {
    const token = fakeJwt({
      iss: "https://idp.example",
      aud: "dse-gateway",
      exp: 9_999_999_999,
      nonce: "abc",
    });
    expect(decodeJwtPayload(token).nonce).toBe("abc");
  });

  test("selectConvexBearer requires API audience on access token (mocked)", () => {
    const now = 1_700_000_000;
    const idToken = fakeJwt({
      iss: "https://idp.example",
      aud: "spa-client",
      exp: now + 60,
      nonce: "n1",
    });
    const badAccess = fakeJwt({
      iss: "https://idp.example",
      aud: "spa-client",
      exp: now + 60,
    });
    const goodAccess = fakeJwt({
      iss: "https://idp.example",
      aud: "dse-gateway",
      exp: now + 60,
    });
    expect(
      selectConvexBearer({
        accessToken: badAccess,
        idToken,
        issuer: "https://idp.example",
        audience: "dse-gateway",
        clientId: "spa-client",
        nonce: "n1",
        nowSec: now,
      }).ok,
    ).toBe(false);
    expect(
      selectConvexBearer({
        accessToken: goodAccess,
        idToken,
        issuer: "https://idp.example",
        audience: "dse-gateway",
        clientId: "spa-client",
        nonce: "n1",
        nowSec: now,
      }),
    ).toEqual({ ok: true, token: goodAccess });
  });
});
