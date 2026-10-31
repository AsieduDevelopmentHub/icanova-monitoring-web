import type { Id, TableNames } from "../../convex/_generated/dataModel";
import type { Quality, Reading } from "../telemetry/readings";

export function id<Table extends TableNames>(value: string): Id<Table> {
  return value as Id<Table>;
}

const QUALITIES: readonly Quality[] = [
  "measured",
  "unavailable",
  "unsupported",
  "under-range",
  "over-range",
  "stale",
  "invalid",
];

export function isQuality(value: string): value is Quality {
  return (QUALITIES as readonly string[]).includes(value);
}

/** A stored number is shown only when its quality is measured. */
export function storedReading(value: number | null, quality: string, unit: string): Reading {
  const known = isQuality(quality) ? quality : "invalid";
  const measured = known === "measured" && value !== null && Number.isFinite(value);
  return {
    label: unit,
    unit: measured ? unit : "",
    quality: measured ? "measured" : known === "measured" ? "invalid" : known,
    value: measured ? value : null,
    valueText: measured ? String(value) : null,
  };
}

export function accessMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : "";
  if (text.includes("Unauthorized")) {
    return "Sign in is required.";
  }
  if (text.includes("Forbidden")) {
    return "This organization did not grant that permission.";
  }
  if (text.includes("Not found")) {
    return "That record was not found.";
  }
  if (text.includes("Invalid transition")) {
    return "That change is not allowed from the current state.";
  }
  if (text.includes("Already registered")) {
    return "That identity is already registered in this organization.";
  }
  if (text.includes("Invalid identity")) {
    return "Identity must be the 12-character lowercase hex efuse MAC.";
  }
  if (text.includes("Unknown permission")) {
    return "That permission is not on the allowlist.";
  }
  if (text.includes("Attempt limit")) {
    return "That delivery has already been attempted 3 times.";
  }
  if (text.includes("Export is too large")) {
    return "The export exceeded the size limit.";
  }
  return "The request was refused.";
}
