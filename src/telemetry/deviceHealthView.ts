import type { StatusTone } from "../ui/StatusMark";

export type GatewayView = { label: "Online" | "Offline" | "Unknown"; tone: StatusTone };
export type ModbusView = {
  label: "Modbus ok" | "Modbus fail" | "Modbus degraded" | "Unknown";
  tone: StatusTone;
};
export type FreshnessView = {
  label: "Fresh" | "Stale" | "Missing";
  tone: StatusTone;
};
export type OverallView = {
  label: "Healthy" | "Degraded" | "Unhealthy" | "Unknown";
  tone: StatusTone;
};

/** Gateway-to-cloud contact. Not Modbus and not engine state. */
export function gatewayView(status: string | null | undefined): GatewayView {
  if (status === "online") {
    return { label: "Online", tone: "ok" };
  }
  if (status === "offline") {
    return { label: "Offline", tone: "alarm" };
  }
  return { label: "Unknown", tone: "offline" };
}

/** Controller Modbus link from the latest accepted sample. */
export function modbusView(status: string | null | undefined): ModbusView {
  if (status === "ok") {
    return { label: "Modbus ok", tone: "ok" };
  }
  if (status === "fail") {
    return { label: "Modbus fail", tone: "alarm" };
  }
  if (status === "degraded") {
    return { label: "Modbus degraded", tone: "warn" };
  }
  return { label: "Unknown", tone: "offline" };
}

export function freshnessView(status: string | null | undefined): FreshnessView {
  if (status === "fresh") {
    return { label: "Fresh", tone: "ok" };
  }
  if (status === "stale") {
    return { label: "Stale", tone: "warn" };
  }
  return { label: "Missing", tone: "offline" };
}

export function overallView(status: string | null | undefined): OverallView {
  if (status === "healthy") {
    return { label: "Healthy", tone: "ok" };
  }
  if (status === "degraded") {
    return { label: "Degraded", tone: "warn" };
  }
  if (status === "unhealthy") {
    return { label: "Unhealthy", tone: "alarm" };
  }
  return { label: "Unknown", tone: "offline" };
}

export function contactAgeLabel(at: number | null | undefined, now: number): string {
  if (at == null || !Number.isFinite(at)) {
    return "Never";
  }
  const age = now - at;
  if (age < 0) {
    return "Clock skew";
  }
  if (age < 1000) {
    return `${Math.floor(age)} ms ago`;
  }
  const seconds = Math.floor(age / 1000);
  if (seconds < 60) {
    return `${seconds} s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  return `${Math.floor(minutes / 60)} h ago`;
}
