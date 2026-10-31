import { describe, expect, it } from "vitest";
import { derivePowerFlow } from "./powerFlowModel";

const base = {
  label: "G1",
  twinStatus: "running" as const,
  gatewayOnline: true,
  linkOk: true,
  hasSample: true,
  stale: false,
  engineRunning: true,
  powerKw: 12.5,
  voltageL1: 230,
  batteryV: 13.4,
  frequencyHz: 50,
};

describe("derivePowerFlow", () => {
  it("animates only when running with measured power > 0", () => {
    const flow = derivePowerFlow(base);
    expect(flow.flowMode).toBe("flowing");
    expect(flow.animateFlow).toBe(true);
  });

  it("blocks flow when Modbus link fails", () => {
    const flow = derivePowerFlow({ ...base, linkOk: false, twinStatus: "warning" });
    expect(flow.flowMode).toBe("blocked");
    expect(flow.animateFlow).toBe(false);
    expect(flow.caption).toMatch(/Modbus/i);
  });

  it("blocks when sample missing", () => {
    const flow = derivePowerFlow({
      ...base,
      hasSample: false,
      powerKw: null,
      twinStatus: "unknown",
      engineRunning: false,
    });
    expect(flow.flowMode).toBe("blocked");
    expect(flow.animateFlow).toBe(false);
  });

  it("freezes on stale sample", () => {
    const flow = derivePowerFlow({ ...base, stale: true, twinStatus: "warning" });
    expect(flow.flowMode).toBe("stale");
    expect(flow.animateFlow).toBe(false);
  });

  it("does not treat missing power as zero flow", () => {
    const flow = derivePowerFlow({ ...base, powerKw: null });
    expect(flow.flowMode).toBe("static");
    expect(flow.animateFlow).toBe(false);
  });
});
