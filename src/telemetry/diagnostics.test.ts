import { describe, expect, it } from "vitest";
import { demoFrames, demoSamples } from "./demoLog";
import {
  demoDiagnostics,
  filterDiagnostics,
  lastSuccessfulRow,
  retriesLabel,
} from "./diagnosticsView";
import { frameFacts, lastSuccessfulFrame } from "./logModel";

describe("modbus diagnostics", () => {
  it("reads function code and address from the frame and leaves retries empty", () => {
    const read = demoFrames.find((frame) => frame.txn === 42);
    const contradicted = demoFrames.find((frame) => frame.txn === 43);
    const failed = demoFrames.find((frame) => frame.txn === 45);
    expect(read && frameFacts(read)).toMatchObject({
      functionCode: "0x3",
      address: 4096,
      quantity: 8,
      latencyMs: 0,
      retries: null,
      successful: true,
    });
    expect(contradicted && frameFacts(contradicted)).toMatchObject({
      functionCode: "0x10",
      address: 4104,
      latencyMs: 305,
      retries: null,
      successful: false,
    });
    expect(failed && frameFacts(failed)).toMatchObject({
      functionCode: "0x10",
      address: 4104,
      latencyMs: 501,
      retries: null,
      successful: false,
    });
    expect(retriesLabel(null)).toBe("not recorded");
  });

  it("does not treat TXN 43 as the last successful poll", () => {
    expect(lastSuccessfulFrame(demoFrames)?.txn).toBe(44);
    const rows = demoDiagnostics(demoFrames, demoSamples);
    expect(lastSuccessfulRow(rows)?.txn).toBe(44);
    const batches = filterDiagnostics(rows, "1408", "batch");
    expect(batches.map((row) => row.address)).toEqual([1408]);
    expect(filterDiagnostics(rows, "0x10", "frame").map((row) => row.txn)).toEqual([43, 45]);
  });
});
