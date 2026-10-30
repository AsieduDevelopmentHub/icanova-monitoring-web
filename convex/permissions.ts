/** Server-side permission names. A role may only store these strings. */

export const PERMISSIONS = [
  "view.dashboard",
  "view.telemetry",
  "view.diagnostics",
  "view.alarms",
  "acknowledge.alarms",
  "manage.alarms",
  "manage.devices",
  "manage.sites",
  "manage.users",
  "manage.roles",
  "configure.notifications",
  "view.maintenance",
  "manage.maintenance",
  "export.reports",
  "view.audit",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}
