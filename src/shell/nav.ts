import { DEMO_GENERATOR_ID } from "../telemetry/logModel";
import { sectionById } from "../telemetry/sections";
import type { IconName } from "../ui/icons";

export type NavGroup = "Overview" | "Monitor" | "Analyze" | "Operate" | "Administration";

export type NavItem = {
  to: string;
  label: string;
  icon: IconName;
  group: NavGroup;
  end?: boolean;
  unavailable?: string;
};

export const NAV: NavItem[] = [
  { to: "/app", label: "Command Center", icon: "dashboard", group: "Overview", end: true },
  { to: "/local", label: "Live Systems", icon: "local", group: "Monitor", end: true },
  { to: "/generators", label: "Generators", icon: "generator", group: "Monitor" },
  { to: "/gateways", label: "Gateways", icon: "gateway", group: "Monitor" },
  {
    to: `/generators/${DEMO_GENERATOR_ID}/trends`,
    label: "Trends",
    icon: "reports",
    group: "Analyze",
  },
  { to: "/reports", label: "Reports", icon: "reports", group: "Analyze" },
  { to: "/alarms", label: "Alarms", icon: "alarm", group: "Operate" },
  { to: "/events", label: "Events", icon: "events", group: "Operate" },
  { to: "/notifications", label: "Notifications", icon: "bell", group: "Operate" },
  { to: "/maintenance", label: "Maintenance", icon: "maintenance", group: "Operate" },
  { to: "/sites", label: "Sites", icon: "sites", group: "Administration" },
  { to: "/admin/users", label: "Users", icon: "users", group: "Administration" },
  { to: "/admin/roles", label: "Roles", icon: "roles", group: "Administration" },
  { to: "/admin/settings", label: "Settings", icon: "settings", group: "Administration" },
  { to: "/local/configure", label: "Configure", icon: "configure", group: "Administration" },
  { to: "/admin/ops", label: "Ops desk", icon: "configure", group: "Administration" },
];

export const NAV_GROUPS: NavGroup[] = [
  "Overview",
  "Monitor",
  "Analyze",
  "Operate",
  "Administration",
];

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
  if (pathname.match(/^\/generators\/[^/]+\/trends/)) {
    return NAV.find((item) => item.label === "Trends");
  }
  if (pathname.startsWith("/generators")) {
    return NAV.find((item) => item.to === "/generators");
  }
  if (pathname.startsWith("/local/configure")) {
    return NAV.find((item) => item.to === "/local/configure");
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
      { to: "/app", label: "Command Center" },
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
      { to: "/app", label: "Command Center" },
      { to: "/gateways", label: "Gateways" },
    ];
    if (gateway) {
      crumbs.push({ to: pathname, label: gateway[1] });
    }
    return crumbs;
  }
  const generator = pathname.match(/^\/generators\/([^/]+)(?:\/([^/]+))?$/);
  if (pathname === "/generators" || generator) {
    const crumbs = [
      { to: "/app", label: "Command Center" },
      { to: "/generators", label: "Generators" },
    ];
    if (generator) {
      crumbs.push({
        to: `/generators/${generator[1]}`,
        label: generator[1] === DEMO_GENERATOR_ID ? "Demo log" : generator[1],
      });
      if (generator[2]) {
        const section = sectionById(generator[2]);
        crumbs.push({
          to: pathname,
          label: section?.label ?? generator[2],
        });
      }
    }
    return crumbs;
  }
  if (pathname === "/app") {
    return [{ to: "/app", label: "Command Center" }];
  }
  const item = itemForPath(pathname);
  if (!item) {
    return [{ to: "/app", label: "Command Center" }];
  }
  if (item.to === "/app") {
    return [{ to: item.to, label: item.label }];
  }
  return [
    { to: "/app", label: "Command Center" },
    { to: item.to, label: item.label },
  ];
}
