import { DEMO_GENERATOR_ID } from "../telemetry/logModel";
import { sectionById } from "../telemetry/sections";
import type { IconName } from "../ui/icons";

export type NavGroup = "Operate" | "Fleet" | "Records" | "Admin";

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
  { to: "/", label: "Dashboard", icon: "dashboard", group: "Operate", end: true },
  { to: "/local", label: "Live readings", icon: "local", group: "Operate", end: true },
  { to: "/local/configure", label: "Configure", icon: "configure", group: "Operate" },
  { to: "/alarms", label: "Alarms", icon: "alarm", group: "Operate" },
  { to: "/sites", label: "Sites", icon: "sites", group: "Fleet" },
  { to: "/generators", label: "Generators", icon: "generator", group: "Fleet" },
  { to: "/gateways", label: "Gateways", icon: "gateway", group: "Fleet" },
  { to: "/events", label: "Events", icon: "events", group: "Records" },
  { to: "/reports", label: "Reports", icon: "reports", group: "Records" },
  { to: "/maintenance", label: "Maintenance", icon: "maintenance", group: "Records" },
  { to: "/notifications", label: "Notifications", icon: "bell", group: "Records" },
  { to: "/admin/users", label: "Users", icon: "users", group: "Admin" },
  { to: "/admin/roles", label: "Roles", icon: "roles", group: "Admin" },
  { to: "/admin/settings", label: "Settings", icon: "settings", group: "Admin" },
];

export const NAV_GROUPS: NavGroup[] = ["Operate", "Fleet", "Records", "Admin"];

export function itemForPath(pathname: string): NavItem | undefined {
  return NAV.find((item) => item.to === pathname);
}

export function crumbsFor(pathname: string): { to: string; label: string }[] {
  const alarm = pathname.match(/^\/alarms\/([^/]+)$/);
  if (pathname === "/alarms" || alarm) {
    const crumbs = [
      { to: "/", label: "Dashboard" },
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
      { to: "/", label: "Dashboard" },
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
      { to: "/", label: "Dashboard" },
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
  const item = itemForPath(pathname);
  if (!item) {
    return [{ to: pathname, label: "Unknown" }];
  }
  if (item.to === "/") {
    return [{ to: "/", label: "Dashboard" }];
  }
  return [
    { to: "/", label: "Dashboard" },
    { to: item.to, label: item.label },
  ];
}
