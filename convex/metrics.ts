/** JSON names for measurements the firmware already decoded from its existing polls. */

export const WIRE_METRICS = {
  vbn10: { key: "voltageL2", divisor: 10 },
  vcn10: { key: "voltageL3", divisor: 10 },
  vab10: { key: "voltageL12", divisor: 10 },
  vbc10: { key: "voltageL23", divisor: 10 },
  vca10: { key: "voltageL31", divisor: 10 },
  ia10: { key: "currentL1", divisor: 10 },
  ib10: { key: "currentL2", divisor: 10 },
  ic10: { key: "currentL3", divisor: 10 },
  pct100: { key: "loadPct", divisor: 100 },
  eng: { key: "engineStatus", divisor: 1 },
  oil: { key: "oilPressureKpa", divisor: 1 },
  oilc: { key: "oilTempC", divisor: 1 },
  cool: { key: "coolantC", divisor: 1 },
  fuel: { key: "fuelPct", divisor: 1 },
  mhz10: { key: "mainsHz", divisor: 10 },
  mvan10: { key: "mainsL1", divisor: 10 },
  mvbn10: { key: "mainsL2", divisor: 10 },
  mvcn10: { key: "mainsL3", divisor: 10 },
  mvab10: { key: "mainsL12", divisor: 10 },
  mvbc10: { key: "mainsL23", divisor: 10 },
  mvca10: { key: "mainsL31", divisor: 10 },
  chg10: { key: "chargeAltV", divisor: 10 },
  pa: { key: "powerL1W", divisor: 1 },
  pb: { key: "powerL2W", divisor: 1 },
  pc: { key: "powerL3W", divisor: 1 },
  sa: { key: "apparentL1Va", divisor: 1 },
  sb: { key: "apparentL2Va", divisor: 1 },
  sc: { key: "apparentL3Va", divisor: 1 },
  stot: { key: "apparentTotVa", divisor: 1 },
  qa: { key: "reactiveL1Var", divisor: 1 },
  qb: { key: "reactiveL2Var", divisor: 1 },
  qc: { key: "reactiveL3Var", divisor: 1 },
  qtot: { key: "reactiveTotVar", divisor: 1 },
  pfa: { key: "pfL1", divisor: 100 },
  pfb: { key: "pfL2", divisor: 100 },
  pfc: { key: "pfL3", divisor: 100 },
  pf: { key: "pfTot", divisor: 100 },
  eng2: { key: "engineStatusAlt", divisor: 1 },
  ctrl: { key: "controlStatus", divisor: 1 },
} as const;

export type WireName = keyof typeof WIRE_METRICS;
export type MetricKey = (typeof WIRE_METRICS)[WireName]["key"];

export const METRIC_KEYS = Object.values(WIRE_METRICS).map((item) => item.key);

const CORE_WIRE = new Set([
  "t",
  "age",
  "link",
  "alm",
  "mode",
  "rpm",
  "batt10",
  "hz10",
  "kw100",
  "van10",
]);

export function isWireMetric(name: string): name is WireName {
  return Object.prototype.hasOwnProperty.call(WIRE_METRICS, name);
}

export function isReservedWire(name: string): boolean {
  return CORE_WIRE.has(name) || isWireMetric(name);
}
