import { useAuthActions } from "@convex-dev/auth/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { api } from "../../convex/_generated/api";
import { Drawer } from "../ui/Overlay";
import { Icon } from "../ui/icons";
import { applyTheme, persistTheme, resolveTheme, type ThemeMode } from "../theme/theme";
import {
  NAV,
  NAV_GROUP_ICONS,
  NAV_GROUPS,
  activeGroupFor,
  crumbsFor,
  pageTitleFor,
  type NavGroup,
} from "./nav";

function UnreadBadge() {
  const { isAuthenticated } = useConvexAuth();
  const live = Boolean(import.meta.env.VITE_CONVEX_URL) && isAuthenticated;
  const orgs = useQuery(api.organizations.mine, live ? {} : "skip");
  const organizationId = orgs?.[0]?.organizationId;
  const unread = useQuery(
    api.notifications.unreadCount,
    live && organizationId ? { organizationId } : "skip",
  );
  if (!unread) {
    return null;
  }
  return (
    <span className="nav-badge" aria-label={`${unread} unread notifications`}>
      {unread}
    </span>
  );
}

function initialsFrom(name: string | undefined, email: string | undefined): string {
  const source = (name ?? email ?? "U").trim();
  const parts = source.split(/[\s@_./-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase() || "U";
}

function displayNameFrom(user: {
  name?: string;
  username?: string;
  email?: string;
} | null | undefined): string {
  return user?.name?.trim() || user?.username?.trim() || user?.email?.trim() || "Signed in";
}

function useOrgContext() {
  const { isAuthenticated } = useConvexAuth();
  const live = Boolean(import.meta.env.VITE_CONVEX_URL) && isAuthenticated;
  const orgs = useQuery(api.organizations.mine, live ? {} : "skip");
  const org = Array.isArray(orgs) && orgs.length > 0 ? orgs[0] : null;
  return { live, org };
}

function accordionState(openGroup: NavGroup | null): Record<NavGroup, boolean> {
  const next = {} as Record<NavGroup, boolean>;
  for (const group of NAV_GROUPS) {
    next[group] = group !== openGroup;
  }
  return next;
}

function useNavAccess() {
  const { isAuthenticated } = useConvexAuth();
  const live = Boolean(import.meta.env.VITE_CONVEX_URL) && isAuthenticated;
  const orgs = useQuery(api.organizations.mine, live ? {} : "skip");
  const platform = useQuery(api.platformAdmin.isCapable, live ? {} : "skip");
  const activated = Array.isArray(orgs) && orgs.length > 0;
  const permissions = new Set(orgs?.[0]?.permissions ?? []);
  const platformCapable = platform?.capable === true;
  return { activated, permissions, platformCapable, ready: orgs !== undefined };
}

function navItemsForAccess(access: {
  activated: boolean;
  permissions: Set<string>;
  platformCapable: boolean;
}) {
  // Platform admins must reach /admin/platform even before they have an org membership.
  if (!access.activated) {
    return NAV.filter(
      (item) =>
        item.to === "/app" || (item.to === "/admin/platform" && access.platformCapable),
    );
  }
  return NAV.filter((item) => {
    if (item.to === "/admin/platform") {
      return access.platformCapable;
    }
    if (item.group !== "Administration") {
      return true;
    }
    if (item.to === "/sites") {
      return access.permissions.has("manage.sites") || access.permissions.has("view.dashboard");
    }
    if (item.to === "/admin/users" || item.to === "/admin/roles") {
      return access.permissions.has("manage.users");
    }
    if (item.to === "/admin/settings") {
      return access.permissions.has("manage.devices") || access.permissions.has("manage.users");
    }
    if (item.to === "/admin/ops") {
      return access.permissions.has("view.audit") || access.permissions.has("manage.devices");
    }
    if (item.to === "/local/configure") {
      return access.permissions.has("manage.devices");
    }
    return true;
  });
}

function NavList({
  onNavigate,
  rail = false,
  onRailActivate,
}: {
  onNavigate?: () => void;
  rail?: boolean;
  onRailActivate?: (group: NavGroup) => void;
}) {
  const { pathname } = useLocation();
  const access = useNavAccess();
  const items = navItemsForAccess(access);
  const groups = NAV_GROUPS.filter((group) => items.some((item) => item.group === group));
  const [openGroup, setOpenGroup] = useState<NavGroup | null>(
    () => activeGroupFor(pathname) ?? "Overview",
  );

  useEffect(() => {
    const active = activeGroupFor(pathname);
    if (!active) {
      return;
    }
    setOpenGroup(active);
  }, [pathname]);

  const collapsed = accordionState(openGroup);

  if (rail) {
    return (
      <nav className="side-nav side-nav-rail" aria-label="Primary">
        {groups.map((group) => {
          const active = activeGroupFor(pathname) === group;
          return (
            <button
              key={group}
              type="button"
              className={active ? "nav-rail-btn on" : "nav-rail-btn"}
              aria-label={group}
              title={group}
              onClick={() => onRailActivate?.(group)}
            >
              <Icon name={NAV_GROUP_ICONS[group]} />
              <span className="nav-tooltip" role="tooltip">
                {group}
              </span>
            </button>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="side-nav" aria-label="Primary">
      {groups.map((group) => {
        const groupItems = items.filter((item) => item.group === group);
        const expanded = !collapsed[group];
        return (
          <div key={group} className="nav-group">
            <button
              type="button"
              className="nav-group-toggle"
              aria-expanded={expanded}
              onClick={() => setOpenGroup((prev) => (prev === group ? null : group))}
            >
              <span className="nav-group-label">
                <Icon name={NAV_GROUP_ICONS[group]} />
                <span>{group}</span>
              </span>
              <span className={`nav-chevron${expanded ? " is-open" : ""}`} aria-hidden="true">
                <Icon name="chevronDown" />
              </span>
            </button>
            <div className="nav-group-links" hidden={!expanded}>
              {groupItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => (isActive ? "nav-link on" : "nav-link")}
                  onClick={onNavigate}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                  {item.to === "/notifications" ? <UnreadBadge /> : null}
                </NavLink>
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function ThemeToggle({ mode, onToggle }: { mode: ThemeMode; onToggle: () => void }) {
  const next = mode === "light" ? "dark" : "light";
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      onClick={onToggle}
    >
      <Icon name={mode === "light" ? "moon" : "sun"} />
    </button>
  );
}

function OrgContext({ compact = false }: { compact?: boolean }) {
  const { org } = useOrgContext();
  const platform = useQuery(
    api.platformAdmin.isCapable,
    Boolean(import.meta.env.VITE_CONVEX_URL) ? {} : "skip",
  );
  if (!org?.name || platform?.capable !== true) {
    return null;
  }
  return (
    <span className={compact ? "session org-context org-context-compact" : "session org-context"} title={org.name}>
      {org.name}
    </span>
  );
}

function SystemStatusChip() {
  const { live, org } = useOrgContext();
  const organizationId = org?.organizationId;
  const unreadCritical = useQuery(
    api.notifications.unreadCriticalCount,
    live && organizationId ? { organizationId } : "skip",
  );
  if (!live || !organizationId) {
    return null;
  }
  const critical = typeof unreadCritical === "number" ? unreadCritical : null;
  const label =
    critical == null
      ? "Session active"
      : critical > 0
        ? `${critical} critical notice${critical === 1 ? "" : "s"}`
        : "No critical notices";
  return (
    <div className="topbar-sys" title={label}>
      <strong>{critical != null && critical > 0 ? "Attention" : "Operational"}</strong>
      <span>{label}</span>
    </div>
  );
}

function ProfileMenu({
  placement = "header",
  collapsed = false,
  onNavigate,
}: {
  placement?: "header" | "sidebar" | "drawer";
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const navigate = useNavigate();
  const live = Boolean(import.meta.env.VITE_CONVEX_URL) && isAuthenticated;
  const user = useQuery(api.users.me, live ? {} : "skip");
  const platform = useQuery(api.platformAdmin.isCapable, live ? {} : "skip");
  const { org } = useOrgContext();
  const platformCapable = platform?.capable === true;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (isLoading) {
    return <span className="session">…</span>;
  }

  if (!isAuthenticated) {
    return null;
  }

  const name = displayNameFrom(user);
  const role = org?.roleName ?? "Member";
  const initials = initialsFrom(user?.name ?? user?.username, user?.email);
  const image = user?.image;

  function go(to: string) {
    setOpen(false);
    onNavigate?.();
    void navigate(to);
  }

  return (
    <div
      className={`profile-menu profile-menu-${placement}${collapsed ? " is-collapsed" : ""}`}
      ref={rootRef}
    >
      <button
        type="button"
        className={collapsed || placement === "header" ? "profile-trigger compact" : "profile-trigger"}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="profile-avatar" aria-hidden="true">
          {image ? <img src={image} alt="" /> : initials}
        </span>
        {!collapsed && placement !== "header" ? (
          <span className="profile-meta">
            <strong>{name}</strong>
            <span>{role}</span>
          </span>
        ) : null}
        {!collapsed && placement !== "header" ? (
          <span className="nav-chevron" aria-hidden="true">
            <Icon name="chevronDown" />
          </span>
        ) : null}
        {(collapsed || placement === "header") && (
          <span className="sr-only">
            {name}, {role}
          </span>
        )}
      </button>
      {open ? (
        <div className="profile-popover" id={menuId} role="menu">
          <div className="profile-popover-head">
            <strong>{name}</strong>
            <span>{role}</span>
            {user?.email ? <span className="profile-email">{user.email}</span> : null}
            {platformCapable && org?.name ? <span className="profile-org">{org.name}</span> : null}
          </div>
          <button type="button" role="menuitem" onClick={() => go("/admin/settings")}>
            Account settings
          </button>
          <button type="button" role="menuitem" onClick={() => go("/notifications")}>
            Notification preferences
          </button>
          <div className="profile-popover-sep" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="profile-signout"
            onClick={() => {
              setOpen(false);
              void signOut().finally(() => onNavigate?.());
            }}
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SidebarBrand({ collapsed }: { collapsed: boolean }) {
  const { org } = useOrgContext();
  const platform = useQuery(
    api.platformAdmin.isCapable,
    Boolean(import.meta.env.VITE_CONVEX_URL) ? {} : "skip",
  );
  const showOrg = platform?.capable === true && Boolean(org?.name);
  return (
    <NavLink to="/app" className={`brand-lockup${collapsed ? " is-collapsed" : ""}`}>
      <span className="brand-plate">
        {collapsed ? (
          <img
            className="brand-logo-compact"
            src="/brand/logo-app-dark.png"
            alt="iCaNova"
            decoding="async"
          />
        ) : (
          <img
            className="brand-logo-lockup"
            src="/brand/logo-lockup-light.png"
            alt="iCaNova"
            decoding="async"
          />
        )}
      </span>
      {!collapsed && showOrg ? (
        <span className="brand-org" title={org!.name}>
          {org!.name}
        </span>
      ) : null}
    </NavLink>
  );
}

function useMobileNav(breakpointPx = 720) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(`(max-width: ${breakpointPx}px)`).matches : false,
  );

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${breakpointPx}px)`);
    const onChange = () => setIsMobile(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [breakpointPx]);

  return isMobile;
}

export function Shell() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isMobile = useMobileNav(720);
  const [menuOpen, setMenuOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => resolveTheme());
  const crumbs = useMemo(() => crumbsFor(pathname), [pathname]);
  const here = pageTitleFor(pathname);
  const deep = crumbs.length > 1;

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    document.title = `${here} · iCaNova Monitoring`;
  }, [here]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMobile) {
      setMenuOpen(false);
    }
  }, [isMobile]);

  function cycleTheme() {
    const next: ThemeMode = theme === "light" ? "dark" : "light";
    persistTheme(next);
    setTheme(next);
  }

  function onRailActivate(group: NavGroup) {
    const first = NAV.find((item) => item.group === group);
    setNavCollapsed(false);
    if (first) {
      void navigate(first.to);
    }
  }

  return (
    <div className={`shell${navCollapsed ? " nav-collapsed" : ""}`}>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <aside className="sidebar" aria-label="Application">
        <div className="sidebar-inner">
          <SidebarBrand collapsed={navCollapsed} />
          <NavList rail={navCollapsed} onRailActivate={onRailActivate} />
          <div className="sidebar-foot">
            <ProfileMenu placement="sidebar" collapsed={navCollapsed} />
          </div>
        </div>
        <button
          type="button"
          className="sidebar-collapse-btn"
          aria-label={navCollapsed ? "Expand navigation" : "Collapse navigation"}
          title={navCollapsed ? "Expand navigation" : "Collapse navigation"}
          onClick={() => setNavCollapsed((value) => !value)}
        >
          <Icon name={navCollapsed ? "chevronRight" : "chevronLeft"} />
        </button>
      </aside>
      <div className="shell-main">
        <header className="topbar">
          {isMobile ? (
            <button
              type="button"
              className="icon-btn menu-btn"
              aria-label="Open navigation"
              aria-expanded={menuOpen}
              aria-controls="app-navigation"
              onClick={() => setMenuOpen(true)}
            >
              <Icon name="menu" />
            </button>
          ) : null}
          <div className="crumbs">
            {deep ? (
              <nav aria-label="Breadcrumb">
                <ol>
                  {crumbs.map((crumb, index) => {
                    const last = index === crumbs.length - 1;
                    return (
                      <li key={`${crumb.to}-${crumb.label}`}>
                        {last ? (
                          <span aria-current="page">{crumb.label}</span>
                        ) : (
                          <NavLink to={crumb.to}>{crumb.label}</NavLink>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </nav>
            ) : (
              <h1 className="topbar-title">{here}</h1>
            )}
          </div>
          <div className="topbar-cluster">
            <SystemStatusChip />
            <OrgContext compact />
            <NavLink
              to="/notifications"
              className="icon-btn"
              aria-label="Notifications"
              title="Notifications"
            >
              <Icon name="bell" />
              <UnreadBadge />
            </NavLink>
            <ThemeToggle mode={theme} onToggle={cycleTheme} />
            <ProfileMenu placement="header" />
          </div>
        </header>
        <main id="main" className="canvas">
          <Outlet />
        </main>
      </div>
      <Drawer
        open={isMobile && menuOpen}
        title="iCaNova"
        side="left"
        className="nav-drawer"
        onClose={() => setMenuOpen(false)}
      >
        <div className="drawer-nav-body">
          <NavList onNavigate={() => setMenuOpen(false)} />
          <div className="drawer-session">
            <ThemeToggle mode={theme} onToggle={cycleTheme} />
            <ProfileMenu placement="drawer" onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      </Drawer>
    </div>
  );
}
