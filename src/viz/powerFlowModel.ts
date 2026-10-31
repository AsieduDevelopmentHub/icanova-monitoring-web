import type { TwinStatus } from "./CommandTwin";

/** Honesty-driven power path — never invents flow when link/sample missing. */
export type FlowMode = "flowing" | "static" | "stale" | "blocked" | "fault";

export type PowerFlowInput = {
  label: string;
  twinStatus: TwinStatus;
  /** Cloud contact for the gateway, when known. */
  gatewayOnline?: boolean | null;
  /** Modbus / controller link ok when known. */
  linkOk?: boolean | null;
  hasSample: boolean;
  stale: boolean;
  engineRunning: boolean;
  /** Measured power only — null means unavailable, not zero. */
  powerKw: number | null;
  voltageL1: number | null;
  batteryV: number | null;
  frequencyHz: number | null;
};

export type PowerFlowState = PowerFlowInput & {
  flowMode: FlowMode;
  caption: string;
  /** True only when particles / animated path are allowed. */
  animateFlow: boolean;
};

export function derivePowerFlow(input: PowerFlowInput): PowerFlowState {
  const linkFail = input.linkOk === false;
  const noSample = !input.hasSample;

  let flowMode: FlowMode;
  let caption: string;
  let animateFlow = false;

  if (input.twinStatus === "fault" || linkFail) {
    flowMode = linkFail && input.twinStatus !== "fault" ? "blocked" : "fault";
    caption =
      flowMode === "blocked"
        ? "No path — Modbus link fail"
        : "Fault — path held";
    animateFlow = false;
  } else if (noSample) {
    flowMode = "blocked";
    caption = "No path — link/sample missing";
    animateFlow = false;
  } else if (input.stale) {
    flowMode = "stale";
    caption = "Stale sample — flow frozen";
    animateFlow = false;
  } else if (
    input.engineRunning &&
    input.powerKw != null &&
    Number.isFinite(input.powerKw) &&
    input.powerKw > 0
  ) {
    flowMode = "flowing";
    caption = `Power path · ${formatKw(input.powerKw)}`;
    animateFlow = true;
  } else {
    flowMode = "static";
    caption =
      input.engineRunning
        ? "Running · power not measured"
        : "Stopped · path idle";
    animateFlow = false;
  }

  return { ...input, flowMode, caption, animateFlow };
}

function formatKw(value: number): string {
  return `${value.toFixed(value >= 100 ? 0 : 1)} kW`;
}

export function flowPathColor(mode: FlowMode): string {
  switch (mode) {
    case "flowing":
      return "#24845b";
    case "stale":
      return "#d18a26";
    case "fault":
      return "#c64747";
    case "blocked":
      return "#707780";
    default:
      return "#637b83";
  }
}
