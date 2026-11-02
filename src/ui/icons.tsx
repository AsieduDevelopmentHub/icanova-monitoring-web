import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bell,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Cpu,
  Eye,
  EyeOff,
  FileText,
  LayoutDashboard,
  List,
  Menu,
  Moon,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  TriangleAlert,
  Users,
  Wrench,
  X,
  Zap,
} from "lucide-react";

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
  | "moon"
  | "eye"
  | "eyeOff"
  | "chevronLeft"
  | "chevronRight"
  | "chevronDown"
  | "chevronUp";

const ICONS: Record<IconName, LucideIcon> = {
  dashboard: LayoutDashboard,
  sites: Building2,
  generator: Zap,
  alarm: TriangleAlert,
  gateway: Cpu,
  events: List,
  reports: FileText,
  maintenance: Wrench,
  bell: Bell,
  users: Users,
  roles: ShieldCheck,
  settings: Settings2,
  local: Activity,
  configure: SlidersHorizontal,
  menu: Menu,
  close: X,
  search: Search,
  sun: Sun,
  moon: Moon,
  eye: Eye,
  eyeOff: EyeOff,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  chevronDown: ChevronDown,
  chevronUp: ChevronUp,
};

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const Lucide = ICONS[name];
  return <Lucide size={size} strokeWidth={1.75} aria-hidden="true" />;
}
