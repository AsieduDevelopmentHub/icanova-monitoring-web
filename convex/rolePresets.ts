import type { Permission } from "./permissions";
import { PERMISSIONS } from "./permissions";

/** Seeded role templates for each new organization. */
export const ROLE_PRESETS: ReadonlyArray<{
  name: string;
  permissions: readonly Permission[];
}> = [
  {
    name: "Admin",
    permissions: [...PERMISSIONS],
  },
  {
    name: "Sub-admin",
    permissions: [
      "view.dashboard",
      "view.telemetry",
      "view.diagnostics",
      "view.alarms",
      "acknowledge.alarms",
      "manage.alarms",
      "manage.devices",
      "manage.sites",
      "manage.users",
      "configure.notifications",
      "view.maintenance",
      "manage.maintenance",
      "export.reports",
      "view.audit",
    ],
  },
  {
    name: "Operator",
    permissions: [
      "view.dashboard",
      "view.telemetry",
      "view.diagnostics",
      "view.alarms",
      "acknowledge.alarms",
      "view.maintenance",
      "export.reports",
    ],
  },
  {
    name: "Viewer",
    permissions: [
      "view.dashboard",
      "view.telemetry",
      "view.alarms",
      "view.maintenance",
    ],
  },
];
