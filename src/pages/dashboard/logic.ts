import { engineView, linkView } from "../../telemetry/fleetView";
import { storedFreshness } from "../../telemetry/freshness";
import type { TwinStatus } from "../../viz/CommandTwin";
import type { BoardRow } from "./types";

export function twinFromRows(rows: BoardRow[]): TwinStatus {
  if (rows.length === 0) return "unknown";
  const engines = rows.map((row) => engineView(row.rpm, row.rpmQuality));
  if (engines.some((e) => e.tone === "alarm")) return "fault";
  if (engines.some((e) => e.label.toLowerCase().includes("run"))) return "running";
  const links = rows.map((row) => linkView(row.link));
  if (links.some((l) => l.tone === "alarm" || l.tone === "warn")) return "warning";
  const now = Date.now();
  const fresh = rows.map((row) => storedFreshness(row.updatedAt, now));
  if (fresh.every((f) => f.state !== "fresh" && !f.stale)) return "offline";
  if (fresh.some((f) => f.stale)) return "warning";
  return "stopped";
}

/** Attention score — higher = needs operator focus first. */
export function attentionScore(row: BoardRow, now = Date.now()): number {
  let score = 0;
  const engine = engineView(row.rpm, row.rpmQuality);
  const link = linkView(row.link);
  const fresh = storedFreshness(row.updatedAt, now);
  if (engine.tone === "alarm") score += 100;
  if ((row.alarmCount ?? 0) > 0) score += 40 + Math.min(40, row.alarmCount ?? 0);
  if (link.tone === "alarm") score += 35;
  if (link.tone === "warn") score += 20;
  if (fresh.stale) score += 25;
  if (fresh.state === "unknown") score += 15;
  if (engine.label.toLowerCase().includes("run")) score += 5;
  return score;
}

export function pickPrimary(rows: BoardRow[], selectedId: string | null): BoardRow | null {
  if (rows.length === 0) return null;
  if (selectedId) {
    const found = rows.find((row) => row.generatorId === selectedId);
    if (found) return found;
  }
  const ranked = [...rows].sort((a, b) => attentionScore(b) - attentionScore(a));
  const running = ranked.find((row) =>
    engineView(row.rpm, row.rpmQuality).label.toLowerCase().includes("run"),
  );
  return running ?? ranked[0] ?? null;
}

export function isRunning(row: BoardRow): boolean {
  return engineView(row.rpm, row.rpmQuality).label.toLowerCase().includes("run");
}

export function isStopped(row: BoardRow): boolean {
  const label = engineView(row.rpm, row.rpmQuality).label.toLowerCase();
  return label.includes("stop") || label.includes("idle") || label === "off";
}

export { engineView, linkView, storedFreshness };
