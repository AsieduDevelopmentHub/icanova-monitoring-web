/** Quality words match the DSE terminal log and GenComm sentinels. */

export type Quality =
  | "measured"
  | "unavailable"
  | "unsupported"
  | "under-range"
  | "over-range"
  | "stale"
  | "invalid";

export type Reading = {
  label: string;
  unit: string;
  quality: Quality;
  /** Set only for a measured reading. Never a stand-in for a bad quality. */
  value: number | null;
  /** Number text as printed in the log, so 0.0 stays 0.0. */
  valueText: string | null;
};

export type MachinePose = "running" | "stopped" | "offline";
export type MachineFlag = "none" | "warning" | "fault";

const QUALITY_PHRASES: { phrase: string; quality: Quality }[] = [
  { phrase: "under range", quality: "under-range" },
  { phrase: "over range", quality: "over-range" },
  { phrase: "transducer fault", quality: "invalid" },
  { phrase: "low input", quality: "invalid" },
  { phrase: "high input", quality: "invalid" },
  { phrase: "bad data", quality: "invalid" },
  { phrase: "unimplemented", quality: "unsupported" },
  { phrase: "unavailable", quality: "unavailable" },
  { phrase: "reserved", quality: "invalid" },
  { phrase: "stale", quality: "stale" },
  { phrase: "invalid", quality: "invalid" },
];

const QUALITY_LABEL: Record<Quality, string> = {
  measured: "measured",
  unavailable: "unavailable",
  unsupported: "unimplemented",
  "under-range": "under range",
  "over-range": "over range",
  stale: "stale",
  invalid: "invalid",
};

export function qualityLabel(quality: Quality): string {
  return QUALITY_LABEL[quality];
}

export function parseMeasurement(label: string, rest: string): Reading {
  const text = rest.trim();
  const phrase = QUALITY_PHRASES.find((item) => text.toLowerCase() === item.phrase);
  if (phrase) {
    return {
      label,
      unit: "",
      quality: phrase.quality,
      value: null,
      valueText: null,
    };
  }
  const match = text.match(/^(-?\d+(?:\.\d+)?)(?:\s+(\S+))?$/);
  if (!match) {
    return { label, unit: "", quality: "invalid", value: null, valueText: null };
  }
  return {
    label,
    unit: match[2] ?? "",
    quality: "measured",
    value: Number(match[1]),
    valueText: match[1],
  };
}

/** A number only when the reading was actually measured. */
export function measuredNumber(reading: Reading): number | null {
  if (reading.quality !== "measured" || reading.value === null || reading.valueText === null) {
    return null;
  }
  return reading.value;
}

export function formatReading(reading: Reading): string {
  const value = measuredNumber(reading);
  if (value === null || reading.valueText === null) {
    return qualityLabel(reading.quality === "measured" ? "invalid" : reading.quality);
  }
  return reading.unit ? `${reading.valueText} ${reading.unit}` : reading.valueText;
}

export function readingOf(
  readings: Reading[],
  label: string,
): Reading {
  return (
    readings.find((reading) => reading.label === label) ?? {
      label,
      unit: "",
      quality: "unavailable",
      value: null,
      valueText: null,
    }
  );
}

/** Operating pose comes from measured RPM. A missing RPM is not a stopped zero. */
export function machinePose(rpm: Reading | null): MachinePose {
  const value = rpm ? measuredNumber(rpm) : null;
  if (value === null) {
    return "offline";
  }
  return value > 0 ? "running" : "stopped";
}

/** Link state is separate from RPM. Alarm-page read failures are not a plant fault. */
export function machineFlag(link: string | null): MachineFlag {
  const name = link?.toLowerCase();
  if (name === "fail") {
    return "fault";
  }
  if (name === "degraded") {
    return "warning";
  }
  return "none";
}
