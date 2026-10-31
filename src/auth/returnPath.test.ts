import { describe, expect, it } from "vitest";
import { safeReturnPath } from "./returnPath";

describe("safeReturnPath", () => {
  it("keeps relative app paths", () => {
    expect(safeReturnPath("/alarms")).toBe("/alarms");
    expect(safeReturnPath("/gateways?site=1")).toBe("/gateways?site=1");
  });

  it("rejects open redirects", () => {
    expect(safeReturnPath("//evil.example")).toBe("/app");
    expect(safeReturnPath("https://evil.example")).toBe("/app");
    expect(safeReturnPath("http://evil.example/x")).toBe("/app");
  });

  it("reads location-like objects", () => {
    expect(safeReturnPath({ pathname: "/reports", search: "?k=1" })).toBe("/reports?k=1");
  });

  it("falls back for empty values", () => {
    expect(safeReturnPath(undefined)).toBe("/app");
    expect(safeReturnPath(null)).toBe("/app");
  });
});
