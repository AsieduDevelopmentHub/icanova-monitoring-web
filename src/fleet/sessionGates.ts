/** Shared session/permission UX helpers. Server `requirePermission` remains authoritative. */

export const OPS_OVERVIEW_PERMISSIONS = [
  "view.diagnostics",
  "view.audit",
  "manage.devices",
] as const;

export type OpsOverviewPermission = (typeof OPS_OVERVIEW_PERMISSIONS)[number];

export function canViewOpsOverview(permissions: readonly string[] | undefined | null): boolean {
  if (!permissions || permissions.length === 0) {
    return false;
  }
  return OPS_OVERVIEW_PERMISSIONS.some((need) => permissions.includes(need));
}

export function convexConfigured(): boolean {
  return Boolean(import.meta.env.VITE_CONVEX_URL);
}

export function unsignedNotice(detail: string): { title: string; detail: string } {
  return { title: "Not signed in.", detail };
}

export function rejectedSessionNotice(): { title: string; detail: string } {
  return {
    title: "Session was not accepted.",
    detail:
      "Protected organization data is not loaded. The token is missing a user record, or the deployment did not accept it.",
  };
}

export function permissionDeniedNotice(action: string): { title: string; detail: string } {
  return {
    title: "Permission denied.",
    detail: `${action} requires a role that includes the matching permission. Hiding a menu item is not authorization.`,
  };
}
