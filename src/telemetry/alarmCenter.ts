export type AlarmStatus = "active" | "acknowledged" | "cleared" | "resolved";
export type AlarmSeverity = "critical" | "warning" | "informational";
export type AlarmCategory = "generator" | "communication" | "gateway";

export type AlarmRecord = {
  id: string;
  title: string;
  severity: AlarmSeverity;
  category: AlarmCategory;
  source: string;
  generatorName: string;
  siteName: string;
  generatorId: string | null;
  siteId: string;
  status: AlarmStatus;
  firstOccurredAt: number;
  lastOccurredAt: number;
  acknowledged: boolean;
  acknowledgedBy: string | null;
};

export type StoredAlarmRow = {
  _id: string;
  summary: string;
  severity: AlarmSeverity;
  category: AlarmCategory;
  source: string;
  generatorName: string;
  siteName: string;
  generatorId: string | null;
  siteId: string;
  state: AlarmStatus;
  firstOccurredAt: number;
  lastOccurredAt: number;
  acknowledgedAt: number | null;
  acknowledgedByName: string | null;
};

export type AlarmFilter = {
  status: "all" | AlarmStatus;
  severity: "all" | AlarmSeverity;
  category: "all" | AlarmCategory;
  siteId: string;
  generatorId: string;
  search: string;
};

export function toAlarmRecord(row: StoredAlarmRow): AlarmRecord {
  return {
    id: row._id,
    title: row.summary,
    severity: row.severity,
    category: row.category,
    source: row.source,
    generatorName: row.generatorName,
    siteName: row.siteName,
    generatorId: row.generatorId,
    siteId: row.siteId,
    status: row.state,
    firstOccurredAt: row.firstOccurredAt,
    lastOccurredAt: row.lastOccurredAt,
    acknowledged: row.acknowledgedAt !== null,
    acknowledgedBy: row.acknowledgedByName,
  };
}

export function categoryLabel(row: Pick<AlarmRecord, "category" | "source">): string {
  if (row.source === "operator") {
    return "Operator note";
  }
  if (row.category === "communication") {
    return "Communication";
  }
  if (row.category === "gateway") {
    return "Gateway";
  }
  return "Generator";
}

export function severityTone(severity: AlarmSeverity): "alarm" | "warn" | "info" {
  if (severity === "critical") {
    return "alarm";
  }
  if (severity === "informational") {
    return "info";
  }
  return "warn";
}

export function alarmTime(at: number): string {
  if (!Number.isFinite(at)) {
    return "Unknown time";
  }
  return new Date(at).toISOString();
}

export function acknowledgementLabel(row: Pick<AlarmRecord, "acknowledged" | "acknowledgedBy">): string {
  if (!row.acknowledged) {
    return "Not acknowledged";
  }
  if (row.acknowledgedBy) {
    return `Acknowledged by ${row.acknowledgedBy}`;
  }
  return "Acknowledged";
}

export function canAcknowledge(permissions: readonly string[]): boolean {
  return permissions.includes("acknowledge.alarms") || permissions.includes("manage.alarms");
}

export function canManageAlarms(permissions: readonly string[]): boolean {
  return permissions.includes("manage.alarms");
}

export function filterAlarmCenter(rows: AlarmRecord[], filter: AlarmFilter): AlarmRecord[] {
  const needle = filter.search.trim().toLowerCase();
  return rows.filter((row) => {
    if (filter.status !== "all" && row.status !== filter.status) {
      return false;
    }
    if (filter.severity !== "all" && row.severity !== filter.severity) {
      return false;
    }
    if (filter.category !== "all" && row.category !== filter.category) {
      return false;
    }
    if (filter.siteId && row.siteId !== filter.siteId) {
      return false;
    }
    if (filter.generatorId && row.generatorId !== filter.generatorId) {
      return false;
    }
    if (!needle) {
      return true;
    }
    return `${row.title} ${row.generatorName} ${row.siteName} ${categoryLabel(row)} ${row.status}`
      .toLowerCase()
      .includes(needle);
  });
}

export function alarmListCopy(args: {
  status: "all" | AlarmStatus;
  capped: boolean;
  filtered: boolean;
}): { empty: string; note: string } {
  const empty = !args.filtered
    ? "No alarm records are stored for this organization. There are no active alarms in this page."
    : args.status === "active"
      ? "No active alarms in this page."
      : args.status === "cleared"
        ? "No cleared alarms in this page."
        : "No alarm records match this filter.";
  return {
    empty,
    note: args.capped
      ? "This filter stopped at 200 stored alarms. The rows shown are not an organization total."
      : "The rows shown are not an organization total.",
  };
}

export function pageBanner(rows: AlarmRecord[], status: "all" | AlarmStatus): string {
  if (rows.length === 0 || status === "active") {
    return "";
  }
  if (rows.some((row) => row.status === "active")) {
    return "";
  }
  return "No active alarms in this page.";
}

export function siteAlarmSummary(rows: AlarmRecord[], capped: boolean) {
  const critical = rows.filter((row) => row.status === "active" && row.severity === "critical").length;
  const warning = rows.filter((row) => row.status === "active" && row.severity === "warning").length;
  const communication = rows.filter(
    (row) =>
      row.category === "communication" &&
      row.source === "telemetry.link" &&
      (row.status === "active" || row.status === "acknowledged"),
  ).length;
  return {
    critical,
    warning,
    communication,
    recent: rows.slice(0, 5),
    empty: rows.length === 0,
    noActive: rows.every((row) => row.status !== "active"),
    note: capped
      ? "Latest 50 alarm records for this site. Not an organization total."
      : "Alarm records loaded for this site. Not an organization total.",
    banner: rows.length === 0
      ? "No alarm records are stored for this site."
      : rows.every((row) => row.status !== "active")
        ? "No active alarms in this site page."
        : "",
  };
}

/** Fields shown on the narrow alarm card. The table is hidden at the same width. */
export function alarmCardFields(row: AlarmRecord): { label: string; value: string }[] {
  return [
    { label: "Severity", value: row.severity },
    { label: "Category", value: categoryLabel(row) },
    { label: "Generator", value: row.generatorName },
    { label: "Site", value: row.siteName },
    { label: "Status", value: row.status },
    { label: "First occurrence", value: alarmTime(row.firstOccurredAt) },
    { label: "Last occurrence", value: alarmTime(row.lastOccurredAt) },
    { label: "Acknowledgement", value: acknowledgementLabel(row) },
  ];
}
