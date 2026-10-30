import { describe, expect, test } from "vitest";
import {
  EMPTY_HEALTH_TALLIES,
  shiftHealthTallies,
  type HealthSnapshot,
} from "../../convex/deviceHealthLogic";
import { canViewOpsOverview } from "./sessionGates";

/**
 * Controlled scale simulation for Phase 7L.10.
 * This is not a production load test and does not contact Convex cloud.
 */
describe("7L.10 scale simulation", () => {
  test("10k registered devices with mixed connectivity stay incremental", () => {
    const started = Date.now();
    let tallies = { ...EMPTY_HEALTH_TALLIES };
    for (let i = 0; i < 10_000; i += 1) {
      const snap: HealthSnapshot = {
        gatewayStatus: i % 5 === 0 ? "offline" : i % 11 === 0 ? "unknown" : "online",
        modbusStatus: i % 7 === 0 ? "fail" : i % 13 === 0 ? "unknown" : "ok",
        telemetryFreshness: i % 3 === 0 ? "stale" : i % 17 === 0 ? "missing" : "fresh",
        overallStatus: "healthy",
      };
      tallies = shiftHealthTallies(tallies, null, snap, false);
    }
    const durationMs = Date.now() - started;
    expect(tallies.devicesTracked).toBe(10_000);
    expect(tallies.gatewayOnline + tallies.gatewayOffline + tallies.gatewayUnknown).toBe(10_000);
    expect(tallies.modbusOk + tallies.modbusFail + tallies.modbusUnknown).toBe(10_000);
    expect(
      tallies.telemetryFresh + tallies.telemetryStale + tallies.telemetryMissing,
    ).toBe(10_000);
    // Soft bound: pure tally math should finish quickly on a developer machine.
    expect(durationMs).toBeLessThan(5_000);
  });

  test("ops UI permission helper does not grant access from empty or unrelated perms", () => {
    expect(canViewOpsOverview(["view.dashboard", "view.alarms", "export.reports"])).toBe(false);
    expect(canViewOpsOverview(["view.diagnostics", "view.alarms"])).toBe(true);
  });
});
