import { describe, expect, test } from "vitest";
import {
  EMPTY_HEALTH_TALLIES,
  deriveOverall,
  freshnessFromTelemetry,
  gatewayFromContact,
  healthChanged,
  modbusFromLink,
  shiftHealthTallies,
} from "../../convex/deviceHealthLogic";

describe("device health derivation", () => {
  test("gateway contact is independent of Modbus and telemetry", () => {
    const now = 1_000_000;
    expect(gatewayFromContact(null, now)).toBe("unknown");
    expect(gatewayFromContact(now - 60_000, now)).toBe("online");
    expect(gatewayFromContact(now - 181_000, now)).toBe("offline");
    expect(modbusFromLink("ok")).toBe("ok");
    expect(modbusFromLink("fail")).toBe("fail");
    expect(modbusFromLink(null)).toBe("unknown");
    expect(freshnessFromTelemetry(null, now)).toBe("missing");
    expect(freshnessFromTelemetry(now - 10_000, now)).toBe("fresh");
    expect(freshnessFromTelemetry(now - 200_000, now)).toBe("stale");
  });

  test("overall excludes engine and ranks the worst dimension", () => {
    expect(deriveOverall("online", "ok", "fresh")).toBe("healthy");
    expect(deriveOverall("offline", "ok", "fresh")).toBe("unhealthy");
    expect(deriveOverall("online", "fail", "fresh")).toBe("unhealthy");
    expect(deriveOverall("online", "ok", "stale")).toBe("unhealthy");
    expect(deriveOverall("online", "degraded", "fresh")).toBe("degraded");
    expect(deriveOverall("online", "unknown", "missing")).toBe("degraded");
    expect(deriveOverall("unknown", "unknown", "missing")).toBe("unknown");
    expect(deriveOverall("online", "ok", "missing")).toBe("degraded");
  });

  test("incremental tallies stay consistent across transitions", () => {
    let tallies = { ...EMPTY_HEALTH_TALLIES };
    const a = {
      gatewayStatus: "online" as const,
      modbusStatus: "ok" as const,
      telemetryFreshness: "fresh" as const,
      overallStatus: "healthy" as const,
    };
    tallies = shiftHealthTallies(tallies, null, a, false);
    expect(tallies).toMatchObject({
      devicesTracked: 1,
      gatewayOnline: 1,
      modbusOk: 1,
      telemetryFresh: 1,
      overallHealthy: 1,
      activeCommProblems: 0,
    });
    const b = {
      gatewayStatus: "offline" as const,
      modbusStatus: "ok" as const,
      telemetryFreshness: "fresh" as const,
      overallStatus: "unhealthy" as const,
    };
    tallies = shiftHealthTallies(tallies, a, b, true);
    expect(tallies).toMatchObject({
      devicesTracked: 1,
      gatewayOnline: 0,
      gatewayOffline: 1,
      overallHealthy: 0,
      overallUnhealthy: 1,
      activeCommProblems: 1,
    });
    expect(healthChanged(a, b)).toBe(true);
    expect(healthChanged(a, a)).toBe(false);
  });

  test("10k-scale tally simulation does not require a device scan", () => {
    let tallies = { ...EMPTY_HEALTH_TALLIES };
    const snap = {
      gatewayStatus: "online" as const,
      modbusStatus: "ok" as const,
      telemetryFreshness: "fresh" as const,
      overallStatus: "healthy" as const,
    };
    for (let i = 0; i < 10_000; i += 1) {
      tallies = shiftHealthTallies(tallies, null, snap, false);
    }
    expect(tallies.devicesTracked).toBe(10_000);
    expect(tallies.gatewayOnline).toBe(10_000);
    expect(tallies.overallHealthy).toBe(10_000);
    const offline = {
      gatewayStatus: "offline" as const,
      modbusStatus: "ok" as const,
      telemetryFreshness: "fresh" as const,
      overallStatus: "unhealthy" as const,
    };
    tallies = shiftHealthTallies(tallies, snap, offline, true);
    expect(tallies.gatewayOnline).toBe(9_999);
    expect(tallies.gatewayOffline).toBe(1);
    expect(tallies.devicesTracked).toBe(10_000);
  });
});
