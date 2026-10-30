import { HEALTH_STALE_MS } from "./limits";

export type GatewayStatus = "online" | "offline" | "unknown";
export type ModbusStatus = "ok" | "degraded" | "fail" | "unknown";
export type TelemetryFreshness = "fresh" | "stale" | "missing";
export type OverallStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

export type HealthSnapshot = {
  gatewayStatus: GatewayStatus;
  modbusStatus: ModbusStatus;
  telemetryFreshness: TelemetryFreshness;
  overallStatus: OverallStatus;
};

export type HealthTallies = {
  devicesTracked: number;
  gatewayOnline: number;
  gatewayOffline: number;
  gatewayUnknown: number;
  modbusOk: number;
  modbusDegraded: number;
  modbusFail: number;
  modbusUnknown: number;
  telemetryFresh: number;
  telemetryStale: number;
  telemetryMissing: number;
  overallHealthy: number;
  overallDegraded: number;
  overallUnhealthy: number;
  overallUnknown: number;
  activeCommProblems: number;
};

export const EMPTY_HEALTH_TALLIES: HealthTallies = {
  devicesTracked: 0,
  gatewayOnline: 0,
  gatewayOffline: 0,
  gatewayUnknown: 0,
  modbusOk: 0,
  modbusDegraded: 0,
  modbusFail: 0,
  modbusUnknown: 0,
  telemetryFresh: 0,
  telemetryStale: 0,
  telemetryMissing: 0,
  overallHealthy: 0,
  overallDegraded: 0,
  overallUnhealthy: 0,
  overallUnknown: 0,
  activeCommProblems: 0,
};

/** Modbus status from an accepted sample link. Never invents a measured value. */
export function modbusFromLink(link: string | null | undefined): ModbusStatus {
  if (link === "ok") {
    return "ok";
  }
  if (link === "degraded") {
    return "degraded";
  }
  if (link === "fail") {
    return "fail";
  }
  return "unknown";
}

export function gatewayFromContact(
  lastGatewayContactAt: number | null | undefined,
  now: number,
  staleMs: number = HEALTH_STALE_MS,
): GatewayStatus {
  if (lastGatewayContactAt == null || !Number.isFinite(lastGatewayContactAt)) {
    return "unknown";
  }
  return now - lastGatewayContactAt <= staleMs ? "online" : "offline";
}

export function freshnessFromTelemetry(
  lastTelemetryAt: number | null | undefined,
  now: number,
  staleMs: number = HEALTH_STALE_MS,
): TelemetryFreshness {
  if (lastTelemetryAt == null || !Number.isFinite(lastTelemetryAt)) {
    return "missing";
  }
  return now - lastTelemetryAt <= staleMs ? "fresh" : "stale";
}

/**
 * Overall excludes engine. Unhealthy if gateway offline, modbus fail, or telemetry
 * stale/missing while we expected data (stale). Degraded for modbus degraded or
 * gateway unknown with other issues mild. Unknown only when every dimension is unknown/missing.
 */
export function deriveOverall(
  gateway: GatewayStatus,
  modbus: ModbusStatus,
  freshness: TelemetryFreshness,
): OverallStatus {
  if (gateway === "offline" || modbus === "fail" || freshness === "stale") {
    return "unhealthy";
  }
  if (modbus === "degraded") {
    return "degraded";
  }
  if (gateway === "online" && modbus === "ok" && freshness === "fresh") {
    return "healthy";
  }
  if (gateway === "unknown" && modbus === "unknown" && freshness === "missing") {
    return "unknown";
  }
  if (gateway === "online" && freshness === "missing" && modbus === "unknown") {
    return "degraded";
  }
  if (gateway === "online" && (modbus === "ok" || modbus === "unknown") && freshness === "fresh") {
    return modbus === "ok" ? "healthy" : "degraded";
  }
  if (gateway === "online") {
    return "degraded";
  }
  return "degraded";
}

export function isCommProblem(snapshot: HealthSnapshot): boolean {
  return (
    snapshot.gatewayStatus === "offline" ||
    snapshot.modbusStatus === "fail" ||
    snapshot.modbusStatus === "degraded" ||
    snapshot.telemetryFreshness === "stale"
  );
}

export function applySnapshotToTallies(
  tallies: HealthTallies,
  snapshot: HealthSnapshot,
  delta: 1 | -1,
): HealthTallies {
  const next = { ...tallies };
  next.devicesTracked = Math.max(0, next.devicesTracked + delta);
  bump(next, gatewayKey(snapshot.gatewayStatus), delta);
  bump(next, modbusKey(snapshot.modbusStatus), delta);
  bump(next, freshnessKey(snapshot.telemetryFreshness), delta);
  bump(next, overallKey(snapshot.overallStatus), delta);
  if (isCommProblem(snapshot)) {
    next.activeCommProblems = Math.max(0, next.activeCommProblems + delta);
  }
  return next;
}

export function shiftHealthTallies(
  tallies: HealthTallies,
  previous: HealthSnapshot | null,
  next: HealthSnapshot,
  wasTracked: boolean,
): HealthTallies {
  let out = tallies;
  if (wasTracked && previous) {
    out = applySnapshotToTallies(out, previous, -1);
  }
  out = applySnapshotToTallies(out, next, 1);
  return out;
}

function bump(tallies: HealthTallies, key: keyof HealthTallies, delta: 1 | -1) {
  tallies[key] = Math.max(0, tallies[key] + delta);
}

function gatewayKey(status: GatewayStatus): keyof HealthTallies {
  if (status === "online") {
    return "gatewayOnline";
  }
  if (status === "offline") {
    return "gatewayOffline";
  }
  return "gatewayUnknown";
}

function modbusKey(status: ModbusStatus): keyof HealthTallies {
  if (status === "ok") {
    return "modbusOk";
  }
  if (status === "degraded") {
    return "modbusDegraded";
  }
  if (status === "fail") {
    return "modbusFail";
  }
  return "modbusUnknown";
}

function freshnessKey(status: TelemetryFreshness): keyof HealthTallies {
  if (status === "fresh") {
    return "telemetryFresh";
  }
  if (status === "stale") {
    return "telemetryStale";
  }
  return "telemetryMissing";
}

function overallKey(status: OverallStatus): keyof HealthTallies {
  if (status === "healthy") {
    return "overallHealthy";
  }
  if (status === "degraded") {
    return "overallDegraded";
  }
  if (status === "unhealthy") {
    return "overallUnhealthy";
  }
  return "overallUnknown";
}

export function healthChanged(a: HealthSnapshot, b: HealthSnapshot): boolean {
  return (
    a.gatewayStatus !== b.gatewayStatus ||
    a.modbusStatus !== b.modbusStatus ||
    a.telemetryFreshness !== b.telemetryFreshness ||
    a.overallStatus !== b.overallStatus
  );
}
