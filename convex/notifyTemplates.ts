export type NotifySeverity = "critical" | "warning" | "informational";

export type AlarmNotifyContext = {
  organizationName: string;
  siteName: string;
  generatorName: string | null;
  alarmId: string;
  summary: string;
  severity: NotifySeverity;
  category: string | null;
  state: string;
  firstOccurredAt: number;
  lastOccurredAt: number;
  acknowledged: boolean;
};

const SEVERITY_RANK: Record<NotifySeverity, number> = {
  informational: 0,
  warning: 1,
  critical: 2,
};

export function severityAtLeast(actual: NotifySeverity, minimum: NotifySeverity): boolean {
  return SEVERITY_RANK[actual] >= SEVERITY_RANK[minimum];
}

export function utcStamp(at: number): string {
  return new Date(at).toISOString();
}

export function alarmEmailSubject(ctx: AlarmNotifyContext, event: string): string {
  const label =
    event === "alarm.acknowledged"
      ? "Acknowledged"
      : event === "alarm.cleared"
        ? "Cleared"
        : ctx.severity === "critical"
          ? "Critical"
          : "Generator";
  const name = ctx.generatorName ?? "Generator";
  return `${label} Generator Alarm — ${name}`;
}

export function alarmEmailHtml(ctx: AlarmNotifyContext, event: string): string {
  const headline =
    event === "alarm.acknowledged"
      ? "An alarm was acknowledged."
      : event === "alarm.cleared"
        ? "An alarm was cleared."
        : "A new alarm has been recorded.";
  return [
    `<p>${headline}</p>`,
    `<p>Organization: ${escapeHtml(ctx.organizationName)}</p>`,
    `<p>Site: ${escapeHtml(ctx.siteName)}</p>`,
    `<p>Generator: ${escapeHtml(ctx.generatorName ?? "—")}</p>`,
    `<p>Alarm: ${escapeHtml(ctx.summary)}</p>`,
    `<p>Severity: ${escapeHtml(ctx.severity)}</p>`,
    `<p>Category: ${escapeHtml(ctx.category ?? "—")}</p>`,
    `<p>Status: ${escapeHtml(ctx.state)}</p>`,
    `<p>Acknowledged: ${ctx.acknowledged ? "yes" : "no"}</p>`,
    `<p>First occurrence: ${utcStamp(ctx.firstOccurredAt)}</p>`,
    `<p>Last occurrence: ${utcStamp(ctx.lastOccurredAt)}</p>`,
    `<p>Open the monitoring dashboard to review the alarm: /alarms/${ctx.alarmId}</p>`,
  ].join("\n");
}

export function alarmSms(ctx: AlarmNotifyContext, event: string): string {
  const verb =
    event === "alarm.acknowledged" ? "acked" : event === "alarm.cleared" ? "cleared" : "raised";
  const name = ctx.generatorName ?? "generator";
  return `iCanOva ${verb} ${ctx.severity}: ${ctx.summary} @ ${name}. /alarms/${ctx.alarmId}`;
}

export function deviceRegisteredEmail(org: string, site: string, device: string, deviceId: string) {
  return {
    subject: `Device registered — ${device}`,
    html: [
      `<p>A gateway was registered.</p>`,
      `<p>Organization: ${escapeHtml(org)}</p>`,
      `<p>Site: ${escapeHtml(site)}</p>`,
      `<p>Device: ${escapeHtml(device)}</p>`,
      `<p>Open gateways: /gateways/${deviceId}</p>`,
    ].join("\n"),
    sms: `iCanOva device registered: ${device} @ ${site}`,
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
