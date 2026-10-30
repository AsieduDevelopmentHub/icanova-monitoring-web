/**
 * Age of a Convex current document. This is not the ESP32 Modbus poll interval
 * and it is not the link state. The uplink period is 30 seconds, so 3 minutes
 * is about six missed batches before a stored reading is called stale.
 */
export const STORED_STALE_MS = 3 * 60 * 1000;

export type FreshnessState = "fresh" | "stale" | "unknown";

export function storedFreshness(
  updatedAt: number | null,
  now: number,
): { label: string; stale: boolean; state: FreshnessState } {
  if (updatedAt === null || !Number.isFinite(updatedAt) || !Number.isFinite(now)) {
    return { label: "No stored reading", stale: false, state: "unknown" };
  }
  const age = now - updatedAt;
  if (age < 0) {
    return { label: "Stored time is ahead of this browser", stale: false, state: "unknown" };
  }
  const stale = age > STORED_STALE_MS;
  return {
    label: `Last telemetry ${formatAge(age)} ago`,
    stale,
    state: stale ? "stale" : "fresh",
  };
}

export function pageFreshness(rows: { updatedAt: number | null }[], now: number) {
  let fresh = 0;
  let stale = 0;
  let unknown = 0;
  for (const row of rows) {
    const state = storedFreshness(row.updatedAt, now).state;
    if (state === "fresh") {
      fresh += 1;
    } else if (state === "stale") {
      stale += 1;
    } else {
      unknown += 1;
    }
  }
  return {
    fresh,
    stale,
    unknown,
    note: "In this page. Not a site total. Stale is age, not a failed link.",
  };
}

function formatAge(age: number): string {
  if (age < 1000) {
    return `${Math.floor(age)} ms`;
  }
  const seconds = Math.floor(age / 1000);
  if (seconds < 60) {
    return `${seconds} s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  return `${Math.floor(minutes / 60)} h`;
}
