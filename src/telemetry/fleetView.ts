import type { StatusTone } from "../ui/StatusMark";

export type LiveRow = {
  updatedAt: number | null;
  link: string | null;
  rpm: number | null;
  rpmQuality: string;
  alarmCount: number | null;
};

export type LinkView = { label: "Online" | "Offline" | "Degraded" | "Unknown"; tone: StatusTone };
export type EngineView = { label: "Running" | "Stopped" | "Unreported"; tone: StatusTone };

/** Connectivity is the stored link. A missing document is unknown, not offline. */
export function linkView(link: string | null): LinkView {
  if (link === "ok") {
    return { label: "Online", tone: "ok" };
  }
  if (link === "fail") {
    return { label: "Offline", tone: "alarm" };
  }
  if (link === "degraded") {
    return { label: "Degraded", tone: "warn" };
  }
  return { label: "Unknown", tone: "offline" };
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
  let online = 0;
  let offline = 0;
  let degraded = 0;
  for (const row of rows) {
    if (row.updatedAt !== null) {
      reporting += 1;
    }
    const link = linkView(row.link).label;
    if (link === "Online") {
      online += 1;
    } else if (link === "Offline") {
      offline += 1;
    } else if (link === "Degraded") {
      degraded += 1;
    }
  }
  return {
    generators: rows.length,
    reporting,
    online,
    offline,
    degraded,
    unknown: rows.length - online - offline - degraded,
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
