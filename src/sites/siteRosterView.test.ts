import { describe, expect, it } from "vitest";
import {
  compareSitesByLastUpdated,
  powerSourceLabel,
  siteAttentionIssues,
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
  it("names generator when reporting", () => {
    expect(powerSourceLabel({ ...base, reporting: 1, generators: 1 })).toBe("Generator");
    expect(powerSourceLabel({ ...base, reporting: 2, generators: 3 })).toBe("Generator ×3");
  });

  it("does not invent grid or solar", () => {
    expect(powerSourceLabel({ ...base, gatewayOnline: 1 })).toBe("Gateway (no telemetry)");
    expect(powerSourceLabel(base)).toBe("—");
  });

  it("treats lastTelemetryAt as generator telemetry even when reporting is 0", () => {
    expect(
      powerSourceLabel({ ...base, reporting: 0, lastTelemetryAt: Date.now(), generators: 1 }),
    ).toBe("Generator");
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
