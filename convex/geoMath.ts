/** Earth-mean radius used for haversine distance (km). */
export const EARTH_RADIUS_KM = 6371;

/** Ignore IP-source jitter under this distance. */
export const IP_JITTER_KM = 5;

/** Commissioned pins only move after a shift at least this far. */
export const MOVE_KM = 40;

/** Pending relocation samples must stay within this cluster. */
export const PENDING_CLUSTER_KM = 15;

/** Confirmed IP observations required before overwriting a commissioned pin. */
export const PENDING_CONFIRMS = 3;

/** Skip re-lookup for the same hashed IP within this window (unless pending). */
export const IP_LOOKUP_DEBOUNCE_MS = 6 * 60 * 60 * 1000;

export type LocationSource = "manual" | "browser" | "ip";

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in kilometers. */
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function effectiveLocationSource(
  source: LocationSource | undefined,
  hasCoords: boolean,
): LocationSource | null {
  if (source === "manual" || source === "browser" || source === "ip") {
    return source;
  }
  return hasCoords ? "manual" : null;
}

export type IpLocationDecision =
  | { action: "ignore"; reason: string }
  | { action: "apply"; clearPending: boolean }
  | {
      action: "pending";
      count: number;
      lat: number;
      lon: number;
      ipKey: string;
    };

/**
 * Move-aware policy for applying an IP-derived fix to a site.
 * Pure; used by sites.considerIpLocation and unit tests.
 */
export function decideIpLocation(input: {
  currentLat: number | null | undefined;
  currentLon: number | null | undefined;
  source: LocationSource | undefined;
  pendingLat: number | null | undefined;
  pendingLon: number | null | undefined;
  pendingCount: number | null | undefined;
  pendingIpKey: string | null | undefined;
  fixLat: number;
  fixLon: number;
  ipKey: string;
}): IpLocationDecision {
  const hasCoords =
    input.currentLat != null &&
    input.currentLon != null &&
    Number.isFinite(input.currentLat) &&
    Number.isFinite(input.currentLon);
  const source = effectiveLocationSource(input.source, hasCoords);

  if (!hasCoords || source === null) {
    return { action: "apply", clearPending: true };
  }

  const distance = haversineKm(
    input.currentLat!,
    input.currentLon!,
    input.fixLat,
    input.fixLon,
  );

  if (source === "ip") {
    if (distance < IP_JITTER_KM) {
      return { action: "ignore", reason: "ip_jitter" };
    }
    return { action: "apply", clearPending: true };
  }

  // manual | browser (including legacy coords)
  if (distance < MOVE_KM) {
    return { action: "ignore", reason: "within_move_threshold" };
  }

  const pendingCount = input.pendingCount ?? 0;
  const hasPending =
    pendingCount > 0 &&
    input.pendingLat != null &&
    input.pendingLon != null &&
    Number.isFinite(input.pendingLat) &&
    Number.isFinite(input.pendingLon);

  if (hasPending) {
    const cluster = haversineKm(
      input.pendingLat!,
      input.pendingLon!,
      input.fixLat,
      input.fixLon,
    );
    if (cluster > PENDING_CLUSTER_KM) {
      return {
        action: "pending",
        count: 1,
        lat: input.fixLat,
        lon: input.fixLon,
        ipKey: input.ipKey,
      };
    }
    const next = pendingCount + 1;
    if (next >= PENDING_CONFIRMS) {
      return { action: "apply", clearPending: true };
    }
    return {
      action: "pending",
      count: next,
      lat: input.fixLat,
      lon: input.fixLon,
      ipKey: input.ipKey,
    };
  }

  return {
    action: "pending",
    count: 1,
    lat: input.fixLat,
    lon: input.fixLon,
    ipKey: input.ipKey,
  };
}

/** IPv4 private / loopback / link-local / CGNAT ranges (and IPv6 local). */
export function isPrivateOrReservedIp(ip: string): boolean {
  const trimmed = ip.trim().toLowerCase();
  if (!trimmed) {
    return true;
  }
  if (trimmed.includes(":")) {
    return (
      trimmed === "::1" ||
      trimmed.startsWith("fc") ||
      trimmed.startsWith("fd") ||
      trimmed.startsWith("fe80") ||
      trimmed === "::"
    );
  }
  const parts = trimmed.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  // CGNAT 100.64.0.0/10
  if (a === 100 && b >= 64 && b <= 127) {
    return true;
  }
  return false;
}
