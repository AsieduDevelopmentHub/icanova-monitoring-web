import { describe, expect, it } from "vitest";
import { engineView, linkView } from "./fleetView";
import {
  alarmCardFields,
  alarmListCopy,
  filterAlarmCenter,
  pageBanner,
  siteAlarmSummary,
  type AlarmRecord,
} from "./alarmCenter";

function row(overrides: Partial<AlarmRecord> = {}): AlarmRecord {
  return {
    id: "a1",
    title: "Controller communication failed",
    severity: "warning",
    category: "communication",
    source: "telemetry.link",
    generatorName: "Set 1",
    siteName: "Station",
    generatorId: "gen-1",
    siteId: "site-1",
    status: "active",
    firstOccurredAt: Date.parse("2026-10-30T11:00:00.000Z"),
    lastOccurredAt: Date.parse("2026-10-30T11:05:00.000Z"),
    acknowledged: false,
    acknowledgedBy: null,
    ...overrides,
  };
}

describe("alarm center", () => {
  it("lists an active communication alarm and an empty page", () => {
    const active = [row()];
    expect(filterAlarmCenter(active, {
      status: "active",
      severity: "all",
      category: "all",
      siteId: "",
      generatorId: "",
      search: "",
    })).toHaveLength(1);
    expect(alarmListCopy({ status: "all", capped: false, filtered: false }).empty).toContain(
      "no active alarms",
    );
    expect(alarmListCopy({ status: "active", capped: false, filtered: true }).empty).toBe(
      "No active alarms in this page.",
    );
    expect(siteAlarmSummary([], false).banner).toBe("No alarm records are stored for this site.");
    expect(siteAlarmSummary([], false).critical).toBe(0);
  });

  it("filters severity and category without treating a communication fault as critical", () => {
    const rows = [
      row(),
      row({
        id: "note",
        title: "Operator saw a smell",
        severity: "informational",
        category: "generator",
        source: "operator",
        status: "active",
      }),
    ];
    const base = { status: "all" as const, siteId: "", generatorId: "", search: "" };
    expect(filterAlarmCenter(rows, { ...base, severity: "critical", category: "all" })).toEqual([]);
    expect(filterAlarmCenter(rows, { ...base, severity: "warning", category: "all" }).map((item) => item.id)).toEqual([
      "a1",
    ]);
    expect(
      filterAlarmCenter(rows, { ...base, severity: "all", category: "communication" }).map((item) => item.id),
    ).toEqual(["a1"]);
    expect(filterAlarmCenter(rows, { ...base, severity: "all", category: "generator" })[0]?.source).toBe(
      "operator",
    );
    expect(siteAlarmSummary(rows, false).warning).toBe(1);
    expect(siteAlarmSummary(rows, false).critical).toBe(0);
    expect(siteAlarmSummary(rows, false).communication).toBe(1);
  });

  it("keeps cleared history and acknowledgement state", () => {
    const cleared = row({
      id: "old",
      status: "cleared",
      acknowledged: true,
      acknowledgedBy: "Operator",
    });
    const open = row({ id: "new" });
    const rows = [open, cleared];
    expect(
      filterAlarmCenter(rows, {
        status: "cleared",
        severity: "all",
        category: "all",
        siteId: "",
        generatorId: "",
        search: "",
      }).map((item) => item.id),
    ).toEqual(["old"]);
    expect(pageBanner(rows, "all")).toBe("");
    expect(pageBanner([cleared], "all")).toBe("No active alarms in this page.");
    expect(alarmCardFields(cleared).find((field) => field.label === "Acknowledgement")?.value).toBe(
      "Acknowledged by Operator",
    );
    expect(alarmCardFields(open).find((field) => field.label === "Acknowledgement")?.value).toBe(
      "Not acknowledged",
    );
  });

  it("builds the narrow card from the same fields as the table", () => {
    const fields = alarmCardFields(row());
    expect(fields.map((field) => field.label)).toEqual([
      "Severity",
      "Category",
      "Generator",
      "Site",
      "Status",
      "First occurrence",
      "Last occurrence",
      "Acknowledgement",
    ]);
    expect(fields.find((field) => field.label === "Category")?.value).toBe("Communication");
    expect(fields.find((field) => field.label === "Severity")?.value).toBe("warning");
  });

  it("does not treat a failed link or a missing RPM as an engine stop", () => {
    expect(linkView("fail").label).toBe("Offline");
    expect(engineView(null, "unavailable").label).toBe("Unreported");
    expect(engineView(0, "measured").label).toBe("Stopped");
  });
});
