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

export function formatLastUpdated(at: number | null): string {
  if (at == null || !Number.isFinite(at)) {
    return "—";
  }
  // Include seconds so live ingest is visible within the same minute.
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
