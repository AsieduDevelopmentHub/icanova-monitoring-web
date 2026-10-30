/** Age of a Convex current document. This is not the ESP32 Modbus poll interval. */
export const STORED_STALE_MS = 3 * 60 * 1000;

export function storedFreshness(
  updatedAt: number | null,
  now: number,
): { label: string; stale: boolean } {
  if (updatedAt === null || !Number.isFinite(updatedAt) || !Number.isFinite(now)) {
    return { label: "No stored reading", stale: false };
  }
  const age = now - updatedAt;
  if (age < 0) {
    return { label: "Stored time is ahead of this browser", stale: false };
  }
  return {
    label: `Stored ${formatAge(age)} ago`,
    stale: age > STORED_STALE_MS,
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
