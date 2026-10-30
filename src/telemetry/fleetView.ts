import type { StatusTone } from "../ui/StatusMark";
import { modbusView } from "./deviceHealthView";

export type LiveRow = {
  updatedAt: number | null;
  link: string | null;
  rpm: number | null;
  rpmQuality: string;
  alarmCount: number | null;
};

export type LinkView = {
  label: "Modbus ok" | "Modbus fail" | "Modbus degraded" | "Unknown";
  tone: StatusTone;
};
export type EngineView = { label: "Running" | "Stopped" | "Unreported"; tone: StatusTone };

/**
 * Modbus link from stored telemetry. Not gateway Online/Offline.
 * Use gatewayView for cloud contact.
 */
export function linkView(link: string | null): LinkView {
  return modbusView(link);
}

/** Operating state comes from a measured RPM. A missing RPM is not stopped. */
export function engineView(rpm: number | null, quality: string): EngineView {
  if (quality !== "measured" || rpm === null || !Number.isFinite(rpm)) {
    return { label: "Unreported", tone: "neutral" };
  }
  return rpm > 0 ? { label: "Running", tone: "ok" } : { label: "Stopped", tone: "offline" };
}

export function snapshotScope(rows: LiveRow[], capped: boolean) {
  let reporting = 0;
  let modbusOk = 0;
  let modbusFail = 0;
  let modbusDegraded = 0;
  for (const row of rows) {
    if (row.updatedAt !== null) {
      reporting += 1;
    }
    const link = linkView(row.link).label;
    if (link === "Modbus ok") {
      modbusOk += 1;
    } else if (link === "Modbus fail") {
      modbusFail += 1;
    } else if (link === "Modbus degraded") {
      modbusDegraded += 1;
    }
  }
  return {
    generators: rows.length,
    reporting,
    modbusOk,
    modbusFail,
    modbusDegraded,
    /** @deprecated Use modbusOk. Kept for older call sites during migration. */
    online: modbusOk,
    /** @deprecated Use modbusFail. */
    offline: modbusFail,
    /** @deprecated Use modbusDegraded. */
    degraded: modbusDegraded,
    unknown: rows.length - modbusOk - modbusFail - modbusDegraded,
    capped,
    note: capped
      ? "First 50 generators on this site. Not an organization total."
      : "Generators loaded for this site. Not an organization total.",
  };
}

export function registrationLabel(loaded: number, done: boolean): string {
  if (done) {
    return `${loaded} registered on this site.`;
  }
  return `${loaded} loaded. More are registered beyond this page, so this is not a complete count.`;
}

/** The audit row stores a token identifier. Show the subject, not the identifier. */
export function auditActor(actorToken: string): string {
  if (!actorToken || actorToken === "unknown") {
    return "Not recorded";
  }
  if (actorToken === "ingest") {
    return "Ingest";
  }
  const pipe = actorToken.lastIndexOf("|");
  if (pipe >= 0 && pipe < actorToken.length - 1) {
    return actorToken.slice(pipe + 1);
  }
  return "Recorded";
}

export function auditTime(at: number): string {
  if (!Number.isFinite(at)) {
    return "Unknown time";
  }
  return new Date(at).toISOString();
}
