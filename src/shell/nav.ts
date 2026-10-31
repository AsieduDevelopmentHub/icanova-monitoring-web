import { DEMO_GENERATOR_ID } from "../telemetry/logModel";
import { sectionById } from "../telemetry/sections";
import type { IconName } from "../ui/icons";

export type NavGroup =
  | "Overview"
  | "Monitoring"
  | "Infrastructure"
  | "Operations"
  | "Insights"
  | "Administration";

export type NavItem = {
  to: string;
  label: string;
  icon: IconName;
  group: NavGroup;
  end?: boolean;
  /** Shown when this route has no backend yet. */
  unavailable?: string;
};

export const NAV: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: "dashboard", group: "Overview", end: true },
  { to: "/local", label: "Live readings", icon: "local", group: "Monitoring", end: true },
  { to: "/generators", label: "Generators", icon: "generator", group: "Monitoring" },
  { to: "/local/configure", label: "Configure", icon: "configure", group: "Monitoring" },
  { to: "/gateways", label: "Gateways", icon: "gateway", group: "Infrastructure" },
  { to: "/sites", label: "Sites", icon: "sites", group: "Infrastructure" },
  { to: "/alarms", label: "Alarms", icon: "alarm", group: "Operations" },
  { to: "/events", label: "Events", icon: "events", group: "Operations" },
  { to: "/notifications", label: "Notifications", icon: "bell", group: "Operations" },
  { to: "/maintenance", label: "Maintenance", icon: "maintenance", group: "Operations" },
  { to: "/reports", label: "Reports", icon: "reports", group: "Insights" },
  { to: "/admin/ops", label: "Operations desk", icon: "configure", group: "Administration" },
  { to: "/admin/users", label: "Users", icon: "users", group: "Administration" },
  { to: "/admin/roles", label: "Roles", icon: "roles", group: "Administration" },
  { to: "/admin/settings", label: "Settings", icon: "settings", group: "Administration" },
];

export const NAV_GROUPS: NavGroup[] = [
  "Overview",
  "Monitoring",
  "Infrastructure",
  "Operations",
  "Insights",
  "Administration",
];

/** Groups that start collapsed on narrow screens / first paint preference. */
export const NAV_COLLAPSE_DEFAULT: Partial<Record<NavGroup, boolean>> = {
  Administration: true,
};

export function itemForPath(pathname: string): NavItem | undefined {
  const exact = NAV.find((item) => item.to === pathname);
  if (exact) {
    return exact;
  }
  if (pathname.startsWith("/alarms")) {
    return NAV.find((item) => item.to === "/alarms");
  }
  if (pathname.startsWith("/gateways")) {
    return NAV.find((item) => item.to === "/gateways");
  }
  if (pathname.startsWith("/generators")) {
    return NAV.find((item) => item.to === "/generators");
  }
  if (pathname.startsWith("/local")) {
    return NAV.find((item) => item.to === "/local");
  }
  if (pathname.startsWith("/admin")) {
    return NAV.find((item) => item.to === pathname) ?? NAV.find((item) => item.to === "/admin/settings");
  }
  return undefined;
}

export function pageTitleFor(pathname: string): string {
  const crumbs = crumbsFor(pathname);
  return crumbs[crumbs.length - 1]?.label ?? "iCanOva Monitoring";
}

export function crumbsFor(pathname: string): { to: string; label: string }[] {
  const alarm = pathname.match(/^\/alarms\/([^/]+)$/);
  if (pathname === "/alarms" || alarm) {
    const crumbs = [
      { to: "/app", label: "Dashboard" },
      { to: "/alarms", label: "Alarms" },
    ];
    if (alarm) {
      crumbs.push({
        to: pathname,
        label: alarm[1].startsWith("demo-") ? "Demo alarm" : alarm[1],
      });
    }
    return crumbs;
  }
  const gateway = pathname.match(/^\/gateways\/([^/]+)$/);
  if (pathname === "/gateways" || gateway) {
    const crumbs = [
      { to: "/app", label: "Dashboard" },
      { to: "/gateways", label: "Gateways" },
    ];
    if (gateway) {
      crumbs.push({
        to: pathname,
        label: gateway[1] === DEMO_GENERATOR_ID ? "DSE 7320" : gateway[1],
      });
    }
    return crumbs;
  }
  const detail = pathname.match(/^\/generators\/([^/]+)(?:\/([^/]+))?$/);
  if (pathname === "/generators" || detail) {
    const crumbs = [
      { to: "/app", label: "Dashboard" },
      { to: "/generators", label: "Generators" },
    ];
    if (detail) {
      const id = detail[1];
      crumbs.push({
        to: `/generators/${id}`,
        label: id === DEMO_GENERATOR_ID ? "Model 32841" : id,
      });
      if (detail[2]) {
        crumbs.push({
          to: pathname,
          label: sectionById(detail[2])?.label ?? "Unknown",
        });
      }
    }
    return crumbs;
  }
  if (pathname === "/app") {
    return [{ to: "/app", label: "Dashboard" }];
  }
  if (pathname.startsWith("/auth")) {
    return [
      { to: "/app", label: "Dashboard" },
      { to: pathname, label: pathname.includes("callback") ? "Signing in" : "Sign in" },
    ];
  }
  const item = itemForPath(pathname);
  if (!item) {
    return [{ to: pathname, label: "Unavailable" }];
  }
  if (item.to === "/app") {
    return [{ to: "/app", label: "Dashboard" }];
  }
  return [
    { to: "/app", label: "Dashboard" },
    { to: item.to, label: item.label },
  ];
}
