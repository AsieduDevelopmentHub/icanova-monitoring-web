import { isReservedWire, isWireMetric, METRIC_KEYS, WIRE_METRICS, type MetricKey } from "./metrics";

export type DecodedSample = {
  t: number;
  age: number;
  link: string;
  alm: number;
  mode: number | null;
  rpm: number | null;
  batt10: number | null;
  hz10: number | null;
  kw100: number | null;
  van10: number | null;
  extra: Record<MetricKey, number | null>;
  extraQuality: Record<MetricKey, "measured" | "unavailable">;
  unmapped: Record<string, number | null>;
};

export type DecodedBatch = {
  identity: string;
  boot: number;
  seq: number;
  epoch?: number;
  samples: DecodedSample[];
};

function integer(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`Invalid sample ${name}`);
  }
  return value;
}

function optionalNumber(value: unknown, name: string): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid sample ${name}`);
  }
  return value;
}

function emptyExtra(): { extra: Record<MetricKey, number | null>; extraQuality: Record<MetricKey, "measured" | "unavailable"> } {
  const extra = {} as Record<MetricKey, number | null>;
  const extraQuality = {} as Record<MetricKey, "measured" | "unavailable">;
  for (const key of METRIC_KEYS) {
    extra[key] = null;
    extraQuality[key] = "unavailable";
  }
  return { extra, extraQuality };
}

function readSample(value: unknown): DecodedSample {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid sample");
  }
  const record = value as Record<string, unknown>;
  const { extra, extraQuality } = emptyExtra();
  const unmapped: Record<string, number | null> = {};
  for (const [name, raw] of Object.entries(record)) {
    if (isWireMetric(name)) {
      const wire = optionalNumber(raw, name);
      const spec = WIRE_METRICS[name];
      extra[spec.key] = wire === null ? null : wire / spec.divisor;
      extraQuality[spec.key] = wire === null ? "unavailable" : "measured";
      continue;
    }
    if (isReservedWire(name) || name === "unmapped") {
      continue;
    }
    if (!/^[a-z][a-z0-9]{0,15}$/.test(name)) {
      throw new Error("Invalid sample");
    }
    if (Object.keys(unmapped).length >= 16) {
      throw new Error("Invalid sample");
    }
    unmapped[name] = optionalNumber(raw, name);
  }
  return {
    t: integer(record.t, "t"),
    age: integer(record.age, "age"),
    link: typeof record.link === "string" ? record.link : "",
    alm: integer(record.alm, "alm"),
    mode: optionalNumber(record.mode, "mode"),
    rpm: optionalNumber(record.rpm, "rpm"),
    batt10: optionalNumber(record.batt10, "batt10"),
    hz10: optionalNumber(record.hz10, "hz10"),
    kw100: optionalNumber(record.kw100, "kw100"),
    van10: optionalNumber(record.van10, "van10"),
    extra,
    extraQuality,
    unmapped,
  };
}

/** Old and new cloud JSON. Unknown numeric fields are kept and not applied to known metrics. */
export function decodeBatch(body: unknown): DecodedBatch {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Invalid sample");
  }
  const record = body as Record<string, unknown>;
  if (typeof record.identity !== "string") {
    throw new Error("Invalid sample");
  }
  const samples = record.samples;
  if (!Array.isArray(samples)) {
    throw new Error("Invalid sample");
  }
  let epoch: number | undefined;
  if (record.epoch !== undefined && record.epoch !== null) {
    epoch = integer(record.epoch, "epoch");
    if (epoch < 0) {
      throw new Error("Invalid sample");
    }
  }
  if (record.v !== undefined && record.v !== 1 && record.v !== 2) {
    throw new Error("Invalid sample");
  }
  return {
    identity: record.identity,
    boot: integer(record.boot, "boot"),
    seq: integer(record.seq, "seq"),
    epoch,
    samples: samples.map((sample) => readSample(sample)),
  };
}
