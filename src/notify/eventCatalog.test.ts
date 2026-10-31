import { describe, expect, test } from "vitest";
import { labelForNotifyEvent, NOTIFY_EVENT_CATALOG } from "./eventCatalog";

describe("notification event catalog", () => {
  test("covers the policy matrix events", () => {
    const ids = NOTIFY_EVENT_CATALOG.map((row) => row.event);
    expect(ids).toContain("alarm.raised");
    expect(ids).toContain("health.telemetry.recovered");
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("labels remain human-readable", () => {
    expect(labelForNotifyEvent("alarm.raised")).toBe("Alarm raised");
    expect(labelForNotifyEvent("unknown.event")).toBe("unknown.event");
  });
});
