import { describe, expect, it } from "vitest";
import {
  gatewayIdentityError,
  isGatewayIdentity,
  normalizeGatewayIdentity,
} from "./gatewayIdentity";

describe("gatewayIdentity", () => {
  it("normalizes MAC separators and case", () => {
    expect(normalizeGatewayIdentity("A1:B2:C3:D4:E5:F6")).toBe("a1b2c3d4e5f6");
  });

  it("normalizes assigned serial case and punctuation", () => {
    expect(normalizeGatewayIdentity("ICN-Edge-00042")).toBe("icn-edge-00042");
    expect(normalizeGatewayIdentity(" icn.edge_00042 ")).toBe("icnedge00042");
  });

  it("rejects incomplete identities", () => {
    expect(gatewayIdentityError("abc")).toMatch(/4–32/);
    expect(gatewayIdentityError("")).toMatch(/Enter the gateway device ID/);
  });

  it("accepts a valid MAC identity", () => {
    expect(gatewayIdentityError("a1b2c3d4e5f6")).toBeNull();
    expect(isGatewayIdentity("a1b2c3d4e5f6")).toBe(true);
  });

  it("accepts an assigned serial", () => {
    expect(gatewayIdentityError("icn-edge-00042")).toBeNull();
    expect(isGatewayIdentity("icn-edge-00042")).toBe(true);
  });
});
