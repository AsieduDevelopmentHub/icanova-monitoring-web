import { siteLastActivityAt, type SiteHealthFields } from "./siteStatus";

export type SiteRosterRow = SiteHealthFields & {
  siteId: string;
  name: string;
  code: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  gatewayId: string | null;
  gatewayName: string | null;
  generators: number | null;
  activeCommProblems: number;
  lastTelemetryAt: number | null;
  lastGatewayContactAt: number | null;
};

export { siteLastActivityAt };

/** Honest power-source label from what we actually store (no grid/solar invention). */
export function powerSourceLabel(row: SiteRosterRow): string {
  const gens = row.generators;
  const hasTelemetry =
    row.reporting > 0 ||
    (row.lastTelemetryAt != null && Number.isFinite(row.lastTelemetryAt));
  if (hasTelemetry) {
    if (gens == null) {
      return "Generator";
    }
    if (gens <= 0) {
      return "Telemetry";
    }
    return gens === 1 ? "Generator" : `Generator ×${gens}`;
  }
  if (row.gatewayOnline > 0) {
    return "Gateway (no telemetry)";
  }
  return "—";
}

export function siteAttentionIssues(row: SiteRosterRow): string[] {
  const issues: string[] = [];
  if (row.overallUnhealthy > 0) {
    issues.push("Device unhealthy");
  }
  if (row.linkFail > 0) {
    issues.push("Modbus link fail");
  }
  if (row.gatewayOffline > 0) {
    issues.push("Gateway offline");
  }
  if (row.activeCommProblems > 0) {
    issues.push(
      row.activeCommProblems === 1
        ? "1 active comm problem"
        : `${row.activeCommProblems} active comm problems`,
    );
  }
  return issues;
}

/** Newest activity first; never-heard sites last. Stable by name. */
export function compareSitesByLastUpdated(
  a: { name: string; lastTelemetryAt: number | null; lastGatewayContactAt: number | null },
  b: { name: string; lastTelemetryAt: number | null; lastGatewayContactAt: number | null },
): number {
  const aAt = siteLastActivityAt(a) ?? Number.NEGATIVE_INFINITY;
  const bAt = siteLastActivityAt(b) ?? Number.NEGATIVE_INFINITY;
  if (bAt !== aAt) {
    return bAt - aAt;
  }
  return a.name.localeCompare(b.name);
}

export function sortSitesByLastUpdated<T extends {
  name: string;
  lastTelemetryAt: number | null;
  lastGatewayContactAt: number | null;
}>(rows: readonly T[]): T[] {
  return [...rows].sort(compareSitesByLastUpdated);
}

/** Absolute wall clock for tooltips / copy. */
export function formatLastUpdated(at: number | null): string {
  if (at == null || !Number.isFinite(at)) {
    return "—";
  }
  return new Date(at).toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/**
 * Relative age for dense live tables. Tick the parent with useLiveNow so this
 * string moves even when Convex has not pushed a newer timestamp yet.
 */
export function formatActivityAge(at: number | null, now: number): string {
  if (at == null || !Number.isFinite(at) || !Number.isFinite(now)) {
    return "—";
  }
  const age = Math.max(0, now - at);
  if (age < 1000) {
    return "just now";
  }
  const seconds = Math.floor(age / 1000);
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    return `${hours}h ago`;
  }
  return formatLastUpdated(at);
}
