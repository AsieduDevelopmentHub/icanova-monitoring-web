import { describe, expect, it } from "vitest";
import { demoSamples } from "./demoLog";
import { demoAlarms, filterAlarms } from "./alarms";

describe("demo alarms", () => {
  const rows = demoAlarms(demoSamples);

  it("keeps read failures and link failures in transport", () => {
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.kind === "transport")).toBe(true);
    expect(rows.some((row) => row.summary.startsWith("Link DEGRADED"))).toBe(true);
    expect(rows.some((row) => row.summary.includes("Alarm page read"))).toBe(true);
    expect(rows.some((row) => row.summary.includes("@1408"))).toBe(true);
    expect(filterAlarms(rows, "", "controller")).toEqual([]);
  });

  it("filters by search without turning transport into a controller alarm", () => {
    const found = filterAlarms(rows, "1408", "all");
    expect(found).toHaveLength(1);
    expect(found[0]?.kind).toBe("transport");
    expect(filterAlarms(rows, "1408", "controller")).toEqual([]);
    expect(filterAlarms(rows, "not-in-the-log", "all")).toEqual([]);
  });
});
