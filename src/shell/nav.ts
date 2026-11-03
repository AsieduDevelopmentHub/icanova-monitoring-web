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
  { to: "/sites", label: "Sites", icon: "sites", group: "Monitor" },
  { to: "/trends", label: "Trends", icon: "reports", group: "Analyze" },
  { to: "/reports", label: "Reports", icon: "reports", group: "Analyze" },
  { to: "/alarms", label: "Alarms", icon: "alarm", group: "Operate" },
  { to: "/events", label: "Events", icon: "events", group: "Operate" },
  { to: "/notifications", label: "Notifications", icon: "bell", group: "Operate" },
  { to: "/maintenance", label: "Maintenance", icon: "maintenance", group: "Operate" },
  { to: "/admin/users", label: "Users", icon: "users", group: "Administration" },
  { to: "/admin/roles", label: "Roles", icon: "roles", group: "Administration" },
  { to: "/admin/settings", label: "Settings", icon: "settings", group: "Administration" },
  { to: "/admin/platform", label: "Platform", icon: "configure", group: "Administration" },
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

/** Section icons for the collapsed sidebar rail. */
export const NAV_GROUP_ICONS: Record<NavGroup, IconName> = {
  Overview: "dashboard",
  Monitor: "sites",
  Analyze: "reports",
  Operate: "alarm",
  Administration: "settings",
};

export function activeGroupFor(pathname: string): NavGroup | undefined {
  return itemForPath(pathname)?.group;
}

export function itemForPath(pathname: string): NavItem | undefined {
  const exact = NAV.find((item) => item.to === pathname);
  if (exact) {
    return exact;
  }
  if (pathname.startsWith("/alarms")) {
    return NAV.find((item) => item.to === "/alarms");
  }
  if (pathname.startsWith("/sites")) {
    return NAV.find((item) => item.to === "/sites");
  }
  if (pathname.startsWith("/trends")) {
    return NAV.find((item) => item.to === "/trends");
  }
  if (pathname.startsWith("/events")) {
    return NAV.find((item) => item.to === "/events");
  }
  if (pathname.startsWith("/maintenance")) {
    return NAV.find((item) => item.to === "/maintenance");
  }
  if (pathname.startsWith("/local/configure")) {
    return NAV.find((item) => item.to === "/local/configure");
  }
  if (pathname.startsWith("/local")) {
    return NAV.find((item) => item.to === "/local/configure");
  }
  if (pathname.startsWith("/admin")) {
    return NAV.find((item) => item.to === pathname) ?? NAV.find((item) => item.to === "/admin/settings");
  }
  // Legacy fleet asset URLs still map to Sites while redirects settle.
  if (pathname.startsWith("/generators") || pathname.startsWith("/gateways")) {
    return NAV.find((item) => item.to === "/sites");
  }
  return undefined;
}

export function pageTitleFor(pathname: string): string {
  const crumbs = crumbsFor(pathname);
  return crumbs[crumbs.length - 1]?.label ?? "iCaNova Monitoring";
}

export function crumbsFor(pathname: string): { to: string; label: string }[] {
  const root = [
    { to: "/app", label: "Command Center" },
    { to: "/sites", label: "Sites" },
  ];

  const nestedGen = pathname.match(/^\/sites\/([^/]+)\/generators\/([^/]+)(?:\/([^/]+))?$/);
  if (nestedGen) {
    const [, siteId, generatorId, section] = nestedGen;
    const crumbs = [
      ...root,
      { to: `/sites/${siteId}`, label: "Site" },
      {
        to: `/sites/${siteId}/generators/${generatorId}`,
        label: generatorId === DEMO_GENERATOR_ID ? "Demo log" : "Generator",
      },
    ];
    if (section) {
      crumbs.push({
        to: pathname,
        label: sectionById(section)?.label ?? section,
      });
    }
    return crumbs;
  }

  const nestedGw = pathname.match(/^\/sites\/([^/]+)\/gateways\/([^/]+)$/);
  if (nestedGw) {
    const [, siteId, gatewayId] = nestedGw;
    return [
      ...root,
      { to: `/sites/${siteId}`, label: "Site" },
      { to: pathname, label: gatewayId },
    ];
  }

  const siteOnly = pathname.match(/^\/sites\/([^/]+)$/);
  if (pathname === "/sites") {
    return root;
  }
  if (siteOnly) {
    return [...root, { to: pathname, label: "Site" }];
  }

  if (pathname === "/app") {
    return [{ to: "/app", label: "Command Center" }];
  }

  const alarm = pathname.match(/^\/alarms\/([^/]+)$/);
  if (pathname === "/alarms" || alarm) {
    const crumbs = [
      { to: "/app", label: "Command Center" },
      { to: "/alarms", label: "Alarms" },
    ];
    if (alarm) {
      crumbs.push({
        to: pathname,
        label: alarm[1].startsWith("demo-") ? "Demo alarm" : "Alarm",
      });
    }
    return crumbs;
  }

  if (pathname === "/trends") {
    return [
      { to: "/app", label: "Command Center" },
      { to: "/trends", label: "Trends" },
    ];
  }
  if (pathname === "/events") {
    return [
      { to: "/app", label: "Command Center" },
      { to: "/events", label: "Events" },
    ];
  }
  if (pathname === "/reports") {
    return [
      { to: "/app", label: "Command Center" },
      { to: "/reports", label: "Reports" },
    ];
  }

  // Legacy paths: crumbs still site-oriented until redirect lands.
  const legacyGen = pathname.match(/^\/generators\/([^/]+)(?:\/([^/]+))?$/);
  if (pathname === "/generators" || legacyGen) {
    return root;
  }
  const legacyGw = pathname.match(/^\/gateways\/([^/]+)$/);
  if (pathname === "/gateways" || legacyGw) {
    return root;
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
