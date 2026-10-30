import type { ReactNode } from "react";

export type StatusTone = "ok" | "warn" | "alarm" | "offline" | "info" | "neutral";

const LINK_TONE: Record<string, StatusTone> = {
  ok: "ok",
  degraded: "warn",
  fail: "alarm",
  unknown: "offline",
};

const ENGINE_TONE: Record<string, StatusTone> = {
  Running: "ok",
  Warning: "warn",
  Fault: "alarm",
  Stopped: "offline",
};

export function statusToneForLink(link: string): StatusTone {
  return LINK_TONE[link] ?? "neutral";
}

export function statusToneForEngine(engine: string): StatusTone {
  return ENGINE_TONE[engine] ?? "neutral";
}

export function StatusMark({
  tone,
  children,
}: {
  tone: StatusTone;
  children: ReactNode;
}) {
  return <span className={`status tone-${tone}`}>{children}</span>;
}
