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
  /** Primary generator RPM when known (from telemetryCurrent). */
  primaryRpm?: number | null;
  /** Mains L1 volts when known (extra.mainsL1). */
  mainsL1?: number | null;
  alarmCount?: number | null;
  link?: string | null;
};

export { siteLastActivityAt };

/**
 * Honest power-source label from stored telemetry.
 * Generator when RPM is measured running; Mains when engine is stopped but
 * mains L1 is present; otherwise fall back to reporting / gateway contact.
 */
export function powerSourceLabel(row: SiteRosterRow): string {
  const rpm = row.primaryRpm;
  const mains = row.mainsL1;
  const alarms = row.alarmCount ?? 0;
  if (typeof rpm === "number" && Number.isFinite(rpm) && rpm > 0) {
    return alarms > 0 ? "Generator (alarm)" : "Generator";
  }
  if (typeof mains === "number" && Number.isFinite(mains) && mains >= 100) {
    return alarms > 0 ? "Mains (alarm)" : "Mains";
  }
  const hasTelemetry =
    row.reporting > 0 ||
    (row.lastTelemetryAt != null && Number.isFinite(row.lastTelemetryAt));
  if (hasTelemetry) {
    if (typeof rpm === "number" && rpm === 0) {
      return alarms > 0 ? "Stopped (alarm)" : "Stopped";
    }
    const gens = row.generators;
    if (gens == null) {
      return "Telemetry";
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
  if (row.linkFail > 0 || row.link === "fail") {
    issues.push("Modbus link fail");
  }
  if (row.gatewayOffline > 0) {
    issues.push("Gateway offline");
  }
  if ((row.alarmCount ?? 0) > 0) {
    issues.push(
      row.alarmCount === 1 ? "1 generator alarm" : `${row.alarmCount} generator alarms`,
    );
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

/** Stable fleet roster order — does not reshuffle when telemetry ages change. */
export function compareSitesByCode(
  a: { code: string | null; name: string },
  b: { code: string | null; name: string },
): number {
  const aCode = a.code?.trim() || "";
  const bCode = b.code?.trim() || "";
  if (aCode && bCode) {
    const byCode = aCode.localeCompare(bCode, undefined, { numeric: true, sensitivity: "base" });
    if (byCode !== 0) {
      return byCode;
    }
  } else if (aCode || bCode) {
    return aCode ? -1 : 1;
  }
  return a.name.localeCompare(b.name);
}

export function sortSitesByCode<T extends { code: string | null; name: string }>(
  rows: readonly T[],
): T[] {
  return [...rows].sort(compareSitesByCode);
}

/**
 * Merge latest Convex rows onto a frozen siteId order so pagination / row
 * positions stay put while Last Updated and health fields refresh.
 */
export function applyRosterOrder<T extends { siteId: string }>(
  order: readonly string[],
  latest: readonly T[],
): T[] {
  const byId = new Map(latest.map((row) => [row.siteId, row]));
  const ordered: T[] = [];
  for (const siteId of order) {
    const row = byId.get(siteId);
    if (row) {
      ordered.push(row);
      byId.delete(siteId);
    }
  }
  // New sites (provisioned after order freeze) append in stable code/name order.
  const extras = sortSitesByCode(
    [...byId.values()] as Array<T & { code: string | null; name: string }>,
  );
  return [...ordered, ...extras];
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
