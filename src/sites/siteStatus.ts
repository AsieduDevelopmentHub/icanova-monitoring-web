import { STORED_STALE_MS } from "../telemetry/freshness";
import type { StatusTone } from "../ui/StatusMark";

/** Roster fields needed to derive map / table status. */
export type SiteHealthFields = {
  overallUnhealthy: number;
  linkFail: number;
  gatewayOffline: number;
  reporting: number;
  gatewayOnline: number;
};

export type SiteLiveFields = SiteHealthFields & {
  lastTelemetryAt?: number | null;
  lastGatewayContactAt?: number | null;
};

export type SiteStatusLabel = "Attention" | "Degraded" | "Operational" | "Idle";

export type SiteLiveLabel = "Updating" | "Stop";

export function siteLastActivityAt(row: {
  lastTelemetryAt?: number | null;
  lastGatewayContactAt?: number | null;
}): number | null {
  const telemetry = row.lastTelemetryAt ?? null;
  const contact = row.lastGatewayContactAt ?? null;
  if (telemetry == null && contact == null) {
    return null;
  }
  if (telemetry == null) {
    return contact;
  }
  if (contact == null) {
    return telemetry;
  }
  return Math.max(telemetry, contact);
}

export function siteStatus(row: SiteHealthFields): { tone: StatusTone; label: SiteStatusLabel } {
  if (row.overallUnhealthy > 0 || row.linkFail > 0) {
    return { tone: "alarm", label: "Attention" };
  }
  if (row.gatewayOffline > 0) {
    return { tone: "warn", label: "Degraded" };
  }
  if (row.reporting > 0 || row.gatewayOnline > 0) {
    return { tone: "ok", label: "Operational" };
  }
  return { tone: "offline", label: "Idle" };
}

/**
 * Live indicator for dense tables: Updating vs Stop.
 * Prefers activity age when timestamps exist so the dot can flip on a client tick
 * without a page reload; falls back to summary counters.
 */
export function siteLiveState(
  row: SiteLiveFields,
  now = Date.now(),
): { tone: StatusTone; label: SiteLiveLabel } {
  const activityAt = siteLastActivityAt(row);
  if (activityAt != null && Number.isFinite(now)) {
    if (now - activityAt <= STORED_STALE_MS) {
      return { tone: "ok", label: "Updating" };
    }
    if (row.gatewayOffline > 0 || row.linkFail > 0 || row.overallUnhealthy > 0) {
      return { tone: "warn", label: "Stop" };
    }
    return { tone: "offline", label: "Stop" };
  }
  if (row.reporting > 0 || row.gatewayOnline > 0) {
    return { tone: "ok", label: "Updating" };
  }
  if (row.gatewayOffline > 0 || row.linkFail > 0 || row.overallUnhealthy > 0) {
    return { tone: "warn", label: "Stop" };
  }
  return { tone: "offline", label: "Stop" };
}

export function hasCoordinates<T extends { latitude: number | null; longitude: number | null }>(
  row: T,
): row is T & { latitude: number; longitude: number } {
  return (
    row.latitude != null &&
    row.longitude != null &&
    Number.isFinite(row.latitude) &&
    Number.isFinite(row.longitude)
  );
}
