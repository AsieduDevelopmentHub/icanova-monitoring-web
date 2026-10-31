import { describe, expect, it } from "vitest";
import { gatewayIdentityError, normalizeGatewayIdentity } from "./gatewayIdentity";

describe("gatewayIdentity", () => {
  it("normalizes separators and case", () => {
    expect(normalizeGatewayIdentity("A1:B2:C3:D4:E5:F6")).toBe("a1b2c3d4e5f6");
  });

  it("rejects incomplete identities", () => {
    expect(gatewayIdentityError("abc")).toMatch(/12-character/);
    expect(gatewayIdentityError("")).toMatch(/Enter the gateway identity/);
  });

  it("accepts a valid MAC identity", () => {
    expect(gatewayIdentityError("a1b2c3d4e5f6")).toBeNull();
  });
});
