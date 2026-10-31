import { describe, expect, test } from "vitest";
import { sessionView } from "./session";
import {
  OPS_OVERVIEW_PERMISSIONS,
  canViewOpsOverview,
  permissionDeniedNotice,
  rejectedSessionNotice,
  unsignedNotice,
} from "./sessionGates";

describe("sessionView", () => {
  test("signed-out and rejected never look open", () => {
    expect(sessionView(false, { id: "x" })).toBe("signed-out");
    expect(sessionView(true, undefined)).toBe("loading");
    expect(sessionView(true, null)).toBe("rejected");
    expect(sessionView(true, { id: "x" })).toBe("open");
  });
});

describe("ops overview permissions", () => {
  test("matches section allowlist; manage.devices alone is not enough", () => {
    expect([...OPS_OVERVIEW_PERMISSIONS]).toEqual([
      "view.diagnostics",
      "view.audit",
      "view.alarms",
      "configure.notifications",
    ]);
    expect(canViewOpsOverview([])).toBe(false);
    expect(canViewOpsOverview(undefined)).toBe(false);
    expect(canViewOpsOverview(["manage.devices", "view.dashboard"])).toBe(false);
    expect(canViewOpsOverview(["view.alarms"])).toBe(true);
    expect(canViewOpsOverview(["view.diagnostics"])).toBe(true);
    expect(canViewOpsOverview(["view.audit"])).toBe(true);
    expect(canViewOpsOverview(["configure.notifications"])).toBe(true);
  });

  test("denial copy refuses treating nav as authorization", () => {
    expect(permissionDeniedNotice("Operational overview").detail).toMatch(/not authorization/i);
    expect(unsignedNotice("x").title).toBe("Not signed in.");
    expect(rejectedSessionNotice().title).toBe("Session was not accepted.");
  });
});
