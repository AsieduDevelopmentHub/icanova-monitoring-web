import { describe, expect, it } from "vitest";
import {
  applyRosterOrder,
  compareSitesByLastUpdated,
  formatActivityAge,
  powerSourceLabel,
  siteAttentionIssues,
  sortSitesByCode,
  sortSitesByLastUpdated,
} from "./siteRosterView";

const base = {
  siteId: "s1",
  name: "Site",
  code: "01",
  region: null,
  latitude: null,
  longitude: null,
  gatewayId: null,
  gatewayName: null,
  generators: 1,
  reporting: 0,
  gatewayOnline: 0,
  gatewayOffline: 0,
  linkOk: 0,
  linkFail: 0,
  activeCommProblems: 0,
  overallUnhealthy: 0,
  lastTelemetryAt: null,
  lastGatewayContactAt: null,
};

describe("powerSourceLabel", () => {
  it("names generator when reporting without rpm/mains hints", () => {
    expect(powerSourceLabel({ ...base, reporting: 1, generators: 1 })).toBe("Generator");
    expect(powerSourceLabel({ ...base, reporting: 2, generators: 3 })).toBe("Generator ×3");
  });

  it("does not invent grid without mains readings", () => {
    expect(powerSourceLabel({ ...base, gatewayOnline: 1 })).toBe("Gateway (no telemetry)");
    expect(powerSourceLabel(base)).toBe("—");
  });

  it("labels running rpm as Generator and present mains as Mains", () => {
    expect(powerSourceLabel({ ...base, primaryRpm: 1500, mainsL1: 230 })).toBe("Generator");
    expect(powerSourceLabel({ ...base, primaryRpm: 0, mainsL1: 230 })).toBe("Mains");
    expect(powerSourceLabel({ ...base, primaryRpm: 0, mainsL1: 230, alarmCount: 2 })).toBe(
      "Mains (alarm)",
    );
    expect(powerSourceLabel({ ...base, primaryRpm: 0, lastTelemetryAt: Date.now() })).toBe("Stopped");
  });
});

describe("formatActivityAge", () => {
  const now = 1_700_000_060_000;
  it("shows relative age for live tables", () => {
    expect(formatActivityAge(null, now)).toBe("—");
    expect(formatActivityAge(now - 400, now)).toBe("just now");
    expect(formatActivityAge(now - 12_000, now)).toBe("12s ago");
    expect(formatActivityAge(now - 125_000, now)).toBe("2m ago");
  });
});

describe("siteAttentionIssues", () => {
  it("lists honest issues only", () => {
    expect(
      siteAttentionIssues({
        ...base,
        overallUnhealthy: 1,
        linkFail: 1,
        gatewayOffline: 1,
        activeCommProblems: 2,
      }),
    ).toEqual([
      "Device unhealthy",
      "Modbus link fail",
      "Gateway offline",
      "2 active comm problems",
    ]);
  });
});

describe("sortSitesByLastUpdated", () => {
  it("puts newest activity first and nulls last", () => {
    const rows = [
      { ...base, siteId: "a", name: "Alpha", lastTelemetryAt: 100, lastGatewayContactAt: null },
      { ...base, siteId: "b", name: "Bravo", lastTelemetryAt: null, lastGatewayContactAt: null },
      { ...base, siteId: "c", name: "Charlie", lastTelemetryAt: null, lastGatewayContactAt: 300 },
      { ...base, siteId: "d", name: "Delta", lastTelemetryAt: 200, lastGatewayContactAt: 150 },
    ];
    expect(sortSitesByLastUpdated(rows).map((row) => row.siteId)).toEqual(["c", "d", "a", "b"]);
    expect(compareSitesByLastUpdated(rows[0], rows[3])).toBeGreaterThan(0);
  });
});

describe("sortSitesByCode", () => {
  it("keeps a stable site-id order independent of telemetry age", () => {
    const rows = [
      { ...base, siteId: "b", code: "S002", name: "Bravo", lastTelemetryAt: 9_000 },
      { ...base, siteId: "a", code: "S001", name: "Alpha", lastTelemetryAt: 100 },
      { ...base, siteId: "c", code: "S010", name: "Charlie", lastTelemetryAt: 50 },
    ];
    expect(sortSitesByCode(rows).map((row) => row.siteId)).toEqual(["a", "b", "c"]);
  });
});

describe("applyRosterOrder", () => {
  it("preserves frozen order while merging newer field values", () => {
    const order = ["a", "b"];
    const latest = [
      { ...base, siteId: "b", code: "S002", name: "Bravo", lastTelemetryAt: 200 },
      { ...base, siteId: "a", code: "S001", name: "Alpha", lastTelemetryAt: 100 },
      { ...base, siteId: "c", code: "S003", name: "Charlie", lastTelemetryAt: 300 },
    ];
    expect(applyRosterOrder(order, latest).map((row) => row.siteId)).toEqual(["a", "b", "c"]);
    expect(applyRosterOrder(order, latest)[0]?.lastTelemetryAt).toBe(100);
  });
});
