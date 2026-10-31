import { describe, expect, test } from "vitest";
import { detectBrowserPushSupport } from "./webPush";
import { safeNotificationPath } from "../../convex/delivery";

describe("browser push helpers", () => {
  test("detects missing Push APIs in vitest environment", () => {
    const result = detectBrowserPushSupport();
    expect(result.supported).toBe(false);
    expect(result.reason).toBeTruthy();
  });
});

describe("safeNotificationPath", () => {
  test("allows internal alarm and gateway paths", () => {
    expect(safeNotificationPath("/alarms/abc123")).toBe("/alarms/abc123");
    expect(safeNotificationPath("/gateways/dev1")).toBe("/gateways/dev1");
    expect(safeNotificationPath("/notifications")).toBe("/notifications");
  });

  test("rejects external and protocol-relative URLs", () => {
    expect(safeNotificationPath("https://evil.example")).toBe("/notifications");
    expect(safeNotificationPath("//evil.example")).toBe("/notifications");
    expect(safeNotificationPath("/\\evil")).toBe("/notifications");
    expect(safeNotificationPath("/admin/../outside")).toBe("/notifications");
  });
});
