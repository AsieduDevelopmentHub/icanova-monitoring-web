import { describe, expect, it } from "vitest";
import { hasCoordinates, siteLiveState, siteStatus } from "./siteStatus";

describe("siteStatus", () => {
  it("marks unhealthy or link fail as attention", () => {
    expect(
      siteStatus({
        overallUnhealthy: 1,
        linkFail: 0,
        gatewayOffline: 0,
        reporting: 1,
        gatewayOnline: 1,
      }).label,
    ).toBe("Attention");
    expect(
      siteStatus({
        overallUnhealthy: 0,
        linkFail: 1,
        gatewayOffline: 0,
        reporting: 0,
        gatewayOnline: 0,
      }).tone,
    ).toBe("alarm");
  });

  it("marks gateway offline as degraded when otherwise healthy", () => {
    expect(
      siteStatus({
        overallUnhealthy: 0,
        linkFail: 0,
        gatewayOffline: 1,
        reporting: 0,
        gatewayOnline: 0,
      }),
    ).toEqual({ tone: "warn", label: "Degraded" });
  });

  it("marks reporting or online gateway as operational", () => {
    expect(
      siteStatus({
        overallUnhealthy: 0,
        linkFail: 0,
        gatewayOffline: 0,
        reporting: 1,
        gatewayOnline: 0,
      }).label,
    ).toBe("Operational");
  });

  it("marks idle when nothing reports", () => {
    expect(
      siteStatus({
        overallUnhealthy: 0,
        linkFail: 0,
        gatewayOffline: 0,
        reporting: 0,
        gatewayOnline: 0,
      }),
    ).toEqual({ tone: "offline", label: "Idle" });
  });
});

describe("siteLiveState", () => {
  it("labels reporting or online as Updating when timestamps are absent", () => {
    expect(
      siteLiveState({
        overallUnhealthy: 0,
        linkFail: 0,
        gatewayOffline: 0,
        reporting: 1,
        gatewayOnline: 0,
      }),
    ).toEqual({ tone: "ok", label: "Updating" });
  });

  it("uses activity age when timestamps are present", () => {
    const now = 1_700_000_000_000;
    expect(
      siteLiveState(
        {
          overallUnhealthy: 0,
          linkFail: 0,
          gatewayOffline: 0,
          reporting: 0,
          gatewayOnline: 0,
          lastTelemetryAt: now - 60_000,
          lastGatewayContactAt: null,
        },
        now,
      ),
    ).toEqual({ tone: "ok", label: "Updating" });
    expect(
      siteLiveState(
        {
          overallUnhealthy: 0,
          linkFail: 0,
          gatewayOffline: 0,
          reporting: 1,
          gatewayOnline: 1,
          lastTelemetryAt: now - 10 * 60_000,
          lastGatewayContactAt: null,
        },
        now,
      ).label,
    ).toBe("Stop");
  });

  it("labels offline / idle as Stop", () => {
    expect(
      siteLiveState({
        overallUnhealthy: 0,
        linkFail: 0,
        gatewayOffline: 1,
        reporting: 0,
        gatewayOnline: 0,
      }).label,
    ).toBe("Stop");
    expect(
      siteLiveState({
        overallUnhealthy: 0,
        linkFail: 0,
        gatewayOffline: 0,
        reporting: 0,
        gatewayOnline: 0,
      }),
    ).toEqual({ tone: "offline", label: "Stop" });
  });
});

describe("hasCoordinates", () => {
  it("requires finite lat and lng", () => {
    expect(hasCoordinates({ latitude: 5.6, longitude: -0.2 })).toBe(true);
    expect(hasCoordinates({ latitude: null, longitude: -0.2 })).toBe(false);
    expect(hasCoordinates({ latitude: 5.6, longitude: null })).toBe(false);
    expect(hasCoordinates({ latitude: Number.NaN, longitude: -0.2 })).toBe(false);
  });
});
