import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { NavLink, Outlet, useLocation } from "react-router";
import { api } from "../../convex/_generated/api";
import { Drawer } from "../ui/Overlay";
import { Icon } from "../ui/icons";
import { logout, oidcConfigured, readOidcConfig } from "../auth/oidc";
import { sessionChrome } from "../auth/sessionControls";
import { setBearerToken } from "../platform/bearer";
import { useBearerToken } from "../fleet/useBearer";
import { applyTheme, persistTheme, resolveTheme, type ThemeMode } from "../theme/theme";
import { NAV, NAV_GROUPS, crumbsFor } from "./nav";

function UnreadBadge() {
  const token = useBearerToken();
  const live = Boolean(import.meta.env.VITE_CONVEX_URL) && Boolean(token);
  const orgs = useQuery(api.organizations.mine, live ? {} : "skip");
  const organizationId = orgs?.[0]?.organizationId;
  const unread = useQuery(
    api.notifications.unreadCount,
    live && organizationId ? { organizationId } : "skip",
  );
  if (!unread) {
    return null;
  }
  return <span className="nav-badge" aria-label={`${unread} unread notifications`}>{unread}</span>;
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="side-nav" aria-label="Primary">
      {NAV_GROUPS.map((group) => (
        <div key={group} className="nav-group">
          <div className="nav-label">{group}</div>
          {NAV.filter((item) => item.group === group).map((item) => (
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
      ))}
    </nav>
  );
}

function SessionActions({ onNavigate }: { onNavigate?: () => void }) {
  const token = useBearerToken();
  const chrome = sessionChrome({
    hasBearer: Boolean(token),
    oidcReady: oidcConfigured(),
  });

  return (
    <div className="session-actions">
      <span className="session" aria-live="polite">
        {chrome.label}
      </span>
      {chrome.showSignIn ? (
        <NavLink
          to="/auth/login"
          className="text-btn"
          aria-label="Sign in with identity provider"
          onClick={onNavigate}
        >
          Sign in
        </NavLink>
      ) : null}
      {chrome.showSignOut ? (
        <button
          type="button"
          className="text-btn"
          aria-label={chrome.signOutLabel}
          onClick={() => {
            if (chrome.oidcReady) {
              logout(readOidcConfig());
              return;
            }
            setBearerToken(null);
            onNavigate?.();
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

export function Shell() {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => resolveTheme());
  const crumbs = crumbsFor(pathname);
  const here = crumbs[crumbs.length - 1]?.label ?? "iCanOva Monitoring";

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
    <div className="shell">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <div className="brand-lockup">
          <span className="brand-mark">iCanOva</span>
          <span className="brand-name">Monitoring</span>
          <p className="brand-tag">Industrial operations visibility</p>
        </div>
        <NavList />
        <p className="sidebar-foot">ASIEDU DEVELOPMENT HUB (ADH)</p>
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
          <nav className="crumbs" aria-label="Breadcrumb">
            <ol>
              {crumbs.map((crumb, index) => {
                const last = index === crumbs.length - 1;
                return (
                  <li key={crumb.to}>
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
          <ThemeToggle mode={theme} onToggle={cycleTheme} />
          <SessionActions />
        </header>
        <main id="main" className="canvas">
          <Outlet />
        </main>
      </div>
      <Drawer open={menuOpen} title="Navigation" side="left" onClose={() => setMenuOpen(false)}>
        <NavList onNavigate={() => setMenuOpen(false)} />
        <div className="drawer-session">
          <ThemeToggle mode={theme} onToggle={cycleTheme} />
          <SessionActions onNavigate={() => setMenuOpen(false)} />
        </div>
      </Drawer>
    </div>
  );
}
