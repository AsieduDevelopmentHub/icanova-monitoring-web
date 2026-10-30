import { describe, expect, it } from "vitest";
import { DSE_LOG_EXCERPT } from "../fixtures/dseLogExcerpt";
import { parseCommFrames, parseLogSamples, seriesFor } from "./logModel";
import {
  formatReading,
  machineFlag,
  machinePose,
  measuredNumber,
  parseMeasurement,
  readingOf,
} from "./readings";

describe("parseMeasurement", () => {
  it("keeps a measured zero and a negative power", () => {
    const zero = parseMeasurement("Engine RPM", "0 rpm");
    const power = parseMeasurement("Line 1 power", "-283 W");
    expect(zero.quality).toBe("measured");
    expect(zero.value).toBe(0);
    expect(zero.valueText).toBe("0");
    expect(formatReading(zero)).toBe("0 rpm");
    expect(power.value).toBe(-283);
    expect(formatReading(power)).toBe("-283 W");
  });

  it("does not turn quality words into zero", () => {
    const cases = [
      ["unavailable", "unavailable"],
      ["unimplemented", "unimplemented"],
      ["under range", "under range"],
      ["over range", "over range"],
      ["stale", "stale"],
      ["invalid", "invalid"],
      ["bad data", "invalid"],
    ] as const;
    for (const [text, shown] of cases) {
      const reading = parseMeasurement("Coolant temperature", text);
      expect(reading.value).toBeNull();
      expect(reading.valueText).toBeNull();
      expect(measuredNumber(reading)).toBeNull();
      expect(formatReading(reading)).toBe(shown);
      expect(formatReading(reading)).not.toBe("0");
    }
  });

  it("ignores a numeric leftover when the quality is not measured", () => {
    const stale = {
      label: "Battery voltage",
      unit: "V",
      quality: "stale" as const,
      value: 0,
      valueText: "0.0",
    };
    expect(measuredNumber(stale)).toBeNull();
    expect(formatReading(stale)).toBe("stale");
  });
});

describe("machine state", () => {
  it("treats a missing RPM as offline, not stopped", () => {
    expect(machinePose(null)).toBe("offline");
    expect(machinePose(parseMeasurement("Engine RPM", "unimplemented"))).toBe("offline");
    expect(machinePose(parseMeasurement("Engine RPM", "0 rpm"))).toBe("stopped");
    expect(machinePose(parseMeasurement("Engine RPM", "1587 rpm"))).toBe("running");
  });

  it("keeps link state off the RPM pose", () => {
    expect(machineFlag("DEGRADED")).toBe("warning");
    expect(machineFlag("fail")).toBe("fault");
    expect(machineFlag("ok")).toBe("none");
    expect(machineFlag(null)).toBe("none");
  });
});

describe("dse log excerpt", () => {
  const samples = parseLogSamples(DSE_LOG_EXCERPT);
  const frames = parseCommFrames(DSE_LOG_EXCERPT);

  it("parses five samples and does not invent a clock", () => {
    expect(samples).toHaveLength(5);
    expect(samples.every((sample) => sample.sourceTime === null)).toBe(true);
  });

  it("preserves under-range, unimplemented, measured zero, and negative power", () => {
    const stopped = samples[1];
    expect(readingOf(stopped.readings, "Coolant temperature").quality).toBe("under-range");
    expect(measuredNumber(readingOf(stopped.readings, "Coolant temperature"))).toBeNull();
    expect(readingOf(stopped.readings, "Line 3 voltage").quality).toBe("unsupported");
    expect(formatReading(readingOf(stopped.readings, "Engine RPM"))).toBe("0 rpm");
    expect(formatReading(readingOf(stopped.readings, "Charge alternator voltage"))).toBe("0.0 V");

    const running = samples[2];
    expect(running.mode).toBe("Manual");
    expect(formatReading(readingOf(running.readings, "Line 1 power"))).toBe("-283 W");
    expect(formatReading(readingOf(running.readings, "Load percent"))).toBe("-2.8 %");
    expect(readingOf(running.readings, "Serial Number").quality).toBe("unsupported");
  });

  it("omits non-measured points from a history series", () => {
    const points = seriesFor(samples, "Line 3 voltage");
    expect(points).toEqual([]);
    const power = seriesFor(samples, "Line 1 power");
    expect(power.map((point) => point.text)).toContain("-283");
    expect(power.some((point) => point.value === 0)).toBe(true);
  });

  it("keeps both CRC lines when the log disagrees with itself", () => {
    const bad = frames.find((frame) => frame.txn === 43);
    const fail = frames.find((frame) => frame.txn === 45);
    const ok = frames.find((frame) => frame.txn === 42);
    expect(ok?.crcResult).toBe("PASS");
    expect(ok?.result).toBe("VALID MODBUS RESPONSE");
    expect(bad?.crcResult).toBe("PASS");
    expect(bad?.result).toBe("INVALID MODBUS FRAME (CRC)");
    expect(fail?.crcResult).toBe("FAIL");
    expect(fail?.receivedCrc).toBe("0x1CB");
    expect(fail?.calculatedCrc).toBe("0xCB");
    expect(fail?.firstRxMs).toBe(501);
  });

  it("names batch result codes from the firmware enum", () => {
    expect(samples[0].batchFails[0]).toMatchObject({
      address: 1408,
      result: 2,
      resultName: "crc",
    });
    expect(samples[1].batchFails[0].resultName).toBe("timeout");
  });
});
