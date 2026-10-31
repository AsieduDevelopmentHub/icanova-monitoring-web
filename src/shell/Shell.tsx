import { useAuthActions } from "@convex-dev/auth/react";
import { useEffect, useMemo, useState } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { NavLink, Outlet, useLocation } from "react-router";
import { api } from "../../convex/_generated/api";
import { Drawer } from "../ui/Overlay";
import { Icon } from "../ui/icons";
import { sessionChrome } from "../auth/sessionControls";
import { applyTheme, persistTheme, resolveTheme, type ThemeMode } from "../theme/theme";
import {
  NAV,
  NAV_COLLAPSE_DEFAULT,
  NAV_GROUPS,
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

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState<Record<NavGroup, boolean>>(() => {
    const initial = {} as Record<NavGroup, boolean>;
    for (const group of NAV_GROUPS) {
      initial[group] = NAV_COLLAPSE_DEFAULT[group] === true;
    }
    return initial;
  });

  useEffect(() => {
    const active = NAV.find((item) => {
      if (item.end) {
        return pathname === item.to;
      }
      return pathname === item.to || pathname.startsWith(`${item.to}/`);
    });
    if (!active) {
      return;
    }
    setCollapsed((prev) =>
      prev[active.group] ? { ...prev, [active.group]: false } : prev,
    );
  }, [pathname]);

  return (
    <nav className="side-nav" aria-label="Primary">
      {NAV_GROUPS.map((group) => {
        const items = NAV.filter((item) => item.group === group);
        if (items.length === 0) {
          return null;
        }
        const expanded = !collapsed[group];
        return (
          <div key={group} className="nav-group">
            <button
              type="button"
              className="nav-group-toggle"
              aria-expanded={expanded}
              onClick={() =>
                setCollapsed((prev) => ({
                  ...prev,
                  [group]: !prev[group],
                }))
              }
            >
              <span>{group}</span>
              <span aria-hidden="true">{expanded ? "−" : "+"}</span>
            </button>
            <div className="nav-group-links">
              {items.map((item) => (
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

function SessionActions({ onNavigate }: { onNavigate?: () => void }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const chrome = sessionChrome({
    isAuthenticated: isAuthenticated && !isLoading,
    authReady: Boolean(import.meta.env.VITE_CONVEX_URL),
  });

  return (
    <div className="session-actions">
      <span className="session" aria-live="polite">
        {chrome.label}
      </span>
      {chrome.showSignIn ? (
        <NavLink to="/auth/login" className="text-btn" aria-label="Sign in" onClick={onNavigate}>
          Sign in
        </NavLink>
      ) : null}
      {chrome.showSignOut ? (
        <button
          type="button"
          className="text-btn"
          aria-label={chrome.signOutLabel}
          onClick={() => {
            void signOut().finally(() => onNavigate?.());
          }}
        >
          {chrome.signOutLabel}
        </button>
      ) : null}
    </div>
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

function OrgContext() {
  const { isAuthenticated } = useConvexAuth();
  const live = Boolean(import.meta.env.VITE_CONVEX_URL) && isAuthenticated;
  const orgs = useQuery(api.organizations.mine, live ? {} : "skip");
  const name = orgs?.[0]?.name;
  if (!name) {
    return null;
  }
  return (
    <span className="session org-context" title={name}>
      {name}
    </span>
  );
}

function SystemStatusChip() {
  const { isAuthenticated } = useConvexAuth();
  const live = Boolean(import.meta.env.VITE_CONVEX_URL) && isAuthenticated;
  const orgs = useQuery(api.organizations.mine, live ? {} : "skip");
  const organizationId = orgs?.[0]?.organizationId;
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

export function Shell() {
  const { pathname } = useLocation();
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
    document.title = `${here} · iCanOva Monitoring`;
  }, [here]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  function cycleTheme() {
    const next: ThemeMode = theme === "light" ? "dark" : "light";
    persistTheme(next);
    setTheme(next);
  }

  return (
    <div className={`shell${navCollapsed ? " nav-collapsed" : ""}`}>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <aside className="sidebar" aria-label="Application">
        <NavLink to="/" className="brand-lockup">
          <span className="brand-mark">iCanOva</span>
          <span className="brand-name">Monitoring</span>
        </NavLink>
        <NavList />
        <p className="sidebar-foot">ADH</p>
      </aside>
      <div className="shell-main">
        <header className="topbar">
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
          <button
            type="button"
            className="icon-btn nav-collapse-btn"
            aria-label={navCollapsed ? "Expand navigation" : "Collapse navigation"}
            onClick={() => setNavCollapsed((v) => !v)}
          >
            <Icon name="menu" />
          </button>
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
            <OrgContext />
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
            <SessionActions />
          </div>
        </header>
        <main id="main" className="canvas">
          <Outlet />
        </main>
      </div>
      <Drawer open={menuOpen} title="Navigation" side="left" onClose={() => setMenuOpen(false)}>
        <div id="app-navigation">
          <NavList onNavigate={() => setMenuOpen(false)} />
          <div className="drawer-session">
            <ThemeToggle mode={theme} onToggle={cycleTheme} />
            <SessionActions onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      </Drawer>
    </div>
  );
}
