/** Operator thresholds for tank level. Not DSE trip points. */
export const FUEL_WARN_PCT = 20;
export const FUEL_CRITICAL_PCT = 10;

export type FuelTone = "default" | "ok" | "warn" | "alarm";

export function fuelTone(pct: number | null): FuelTone {
  if (pct == null || !Number.isFinite(pct)) {
    return "default";
  }
  if (pct <= FUEL_CRITICAL_PCT) {
    return "alarm";
  }
  if (pct <= FUEL_WARN_PCT) {
    return "warn";
  }
  return "ok";
}

export function fuelHint(pct: number | null): string | undefined {
  if (pct == null || !Number.isFinite(pct)) {
    return undefined;
  }
  if (pct <= FUEL_CRITICAL_PCT) {
    return "Critical low";
  }
  if (pct <= FUEL_WARN_PCT) {
    return "Low";
  }
  return undefined;
}
