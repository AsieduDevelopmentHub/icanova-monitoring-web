/**
 * Operator-facing catalog of transition-driven notification events.
 * Titles describe when a message is created — never per telemetry sample.
 */
export const NOTIFY_EVENT_CATALOG = [
  {
    event: "alarm.raised",
    label: "Alarm raised",
    when: "Generator enters an alarm condition (or escalation).",
    sampleSubject: "Critical Generator Alarm — {generator}",
  },
  {
    event: "alarm.acknowledged",
    label: "Alarm acknowledged",
    when: "An open alarm is acknowledged by an operator.",
    sampleSubject: "Acknowledged Generator Alarm — {generator}",
  },
  {
    event: "alarm.cleared",
    label: "Alarm cleared",
    when: "An alarm returns to a cleared/resolved state.",
    sampleSubject: "Cleared Generator Alarm — {generator}",
  },
  {
    event: "device.registered",
    label: "Device registered",
    when: "A gateway is registered into the organization.",
    sampleSubject: "Device registered — {device}",
  },
  {
    event: "health.gateway.offline",
    label: "Gateway offline",
    when: "Gateway health transitions to disconnected/offline.",
    sampleSubject: "Gateway offline — {device}",
  },
  {
    event: "health.gateway.recovered",
    label: "Gateway recovered",
    when: "Gateway connectivity is restored after an offline state.",
    sampleSubject: "Gateway recovered — {device}",
  },
  {
    event: "health.telemetry.stale",
    label: "Telemetry stale",
    when: "Telemetry freshness transitions to stale.",
    sampleSubject: "Telemetry stale — {generator}",
  },
  {
    event: "health.telemetry.recovered",
    label: "Telemetry recovered",
    when: "Telemetry freshness is restored after stale.",
    sampleSubject: "Telemetry recovered — {generator}",
  },
] as const;

export type NotifyEventId = (typeof NOTIFY_EVENT_CATALOG)[number]["event"];

export function labelForNotifyEvent(event: string): string {
  const row = NOTIFY_EVENT_CATALOG.find((item) => item.event === event);
  return row?.label ?? event;
}
