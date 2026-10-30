import type { LogSample } from "./logModel";

export type AlarmKind = "controller" | "transport";

export type ListedAlarm = {
  id: string;
  kind: AlarmKind;
  summary: string;
  detail: string;
};

/**
 * The terminal log has link, batch, and alarm-page read failures.
 * Those are transport. It does not name a controller alarm.
 */
export function demoAlarms(samples: LogSample[]): ListedAlarm[] {
  const rows: ListedAlarm[] = [];
  for (const sample of samples) {
    const label = `Sample ${sample.index + 1}`;
    if (sample.link && sample.link.toLowerCase() !== "ok") {
      rows.push({
        id: `demo-${sample.index}-link`,
        kind: "transport",
        summary: `Link ${sample.link}`,
        detail: `${label}. Link state is transport. It is not an engine or controller alarm.`,
      });
    }
    if (sample.alarmPage) {
      rows.push({
        id: `demo-${sample.index}-page`,
        kind: "transport",
        summary: `Alarm page read ${sample.alarmPage}`,
        detail: `${label}. A failed alarm-page read is not a controller alarm.`,
      });
    }
    for (const fail of sample.batchFails) {
      rows.push({
        id: `demo-${sample.index}-batch-${fail.address}`,
        kind: "transport",
        summary: `Batch fail @${fail.address} ${fail.resultName}`,
        detail: `${label}. Quantity ${fail.qty}. Result code ${fail.result}.`,
      });
    }
  }
  return rows;
}

export function filterAlarms(
  rows: ListedAlarm[],
  search: string,
  kind: "all" | AlarmKind,
): ListedAlarm[] {
  const needle = search.trim().toLowerCase();
  return rows.filter((row) => {
    if (kind !== "all" && row.kind !== kind) {
      return false;
    }
    if (!needle) {
      return true;
    }
    return `${row.summary} ${row.detail} ${row.kind}`.toLowerCase().includes(needle);
  });
}
