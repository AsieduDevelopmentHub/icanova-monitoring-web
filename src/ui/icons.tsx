import type { ReactNode } from "react";

export type IconName =
  | "dashboard"
  | "sites"
  | "generator"
  | "alarm"
  | "gateway"
  | "events"
  | "reports"
  | "maintenance"
  | "bell"
  | "users"
  | "roles"
  | "settings"
  | "local"
  | "configure"
  | "menu"
  | "close"
  | "search"
  | "sun"
  | "moon";

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const ICONS: Record<IconName, ReactNode> = {
  dashboard: (
    <Svg>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </Svg>
  ),
  sites: (
    <Svg>
      <path d="M4 20V6l8-3 8 3v14" />
      <path d="M9 20v-6h6v6" />
    </Svg>
  ),
  generator: (
    <Svg>
      <rect x="3" y="7" width="13" height="10" />
      <path d="M16 10h3l2 2v5h-5" />
      <path d="M7 12h4" />
    </Svg>
  ),
  alarm: (
    <Svg>
      <path d="M12 4 3 19h18L12 4z" />
      <path d="M12 10v4" />
      <path d="M12 16.5h.01" />
    </Svg>
  ),
  gateway: (
    <Svg>
      <rect x="6" y="6" width="12" height="12" />
      <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" />
    </Svg>
  ),
  events: (
    <Svg>
      <path d="M8 6h12M8 12h12M8 18h12" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
    </Svg>
  ),
  reports: (
    <Svg>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4M8 13h8M8 17h5" />
    </Svg>
  ),
  maintenance: (
    <Svg>
      <path d="M14.5 6.5a4 4 0 0 0-5.3 5.3L4 17l3 3 5.2-5.2a4 4 0 0 0 5.3-5.3l-2.4 2.4-2.1-2.1z" />
    </Svg>
  ),
  bell: (
    <Svg>
      <path d="M6 16V10a6 6 0 1 1 12 0v6l1.5 2H4.5z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </Svg>
  ),
  users: (
    <Svg>
      <path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" />
      <circle cx="10" cy="8" r="3" />
      <path d="M20 20v-1.2a3 3 0 0 0-2.2-2.9" />
      <path d="M16 5.2a3 3 0 0 1 0 5.6" />
    </Svg>
  ),
  roles: (
    <Svg>
      <path d="M12 3 5 6v5c0 4.2 2.8 7.2 7 8.5 4.2-1.3 7-4.3 7-8.5V6z" />
      <path d="M9 12l2 2 4-4" />
    </Svg>
  ),
  settings: (
    <Svg>
      <path d="M4 8h10M18 8h2M4 16h2M10 16h10" />
      <circle cx="16" cy="8" r="2" />
      <circle cx="8" cy="16" r="2" />
    </Svg>
  ),
  local: (
    <Svg>
      <path d="M4 12h4l2-5 4 10 2-5h4" />
    </Svg>
  ),
  configure: (
    <Svg>
      <path d="M14.5 4.5 16 8l3.5.8-2.2 2.8.4 3.6L14.5 14l-2.8 2.2-3.2-1.8-3.6.4L4 11.2 6.2 8.4 5.4 4.8 9 6z" />
      <circle cx="12" cy="11" r="2" />
    </Svg>
  ),
  menu: (
    <Svg>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  ),
  close: (
    <Svg>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  ),
  search: (
    <Svg>
      <circle cx="11" cy="11" r="6" />
      <path d="M16 16l4 4" />
    </Svg>
  ),
  sun: (
    <Svg>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
    </Svg>
  ),
  moon: (
    <Svg>
      <path d="M19 13.5A7 7 0 1 1 10.5 5 5.5 5.5 0 0 0 19 13.5z" />
    </Svg>
  ),
};

export function Icon({ name }: { name: IconName }) {
  return ICONS[name];
}
