import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { NavLink, Outlet, useLocation } from "react-router";
import { api } from "../../convex/_generated/api";
import { Drawer } from "../ui/Overlay";
import { Icon } from "../ui/icons";
import { logout, oidcConfigured, readOidcConfig } from "../auth/oidc";
import { setBearerToken } from "../platform/bearer";
import { useBearerToken } from "../fleet/useBearer";
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

export function Shell() {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const crumbs = crumbsFor(pathname);
  const here = crumbs[crumbs.length - 1]?.label ?? "DSE Control Center";
  const token = useBearerToken();
  const session = token ? "Session token stored" : "Not signed in";

  useEffect(() => {
    document.title = `${here} · DSE Control Center`;
  }, [here]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <div className="shell">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <div className="brand-lockup">
          <span className="brand-mark">ADH</span>
          <span className="brand-name">DSE Control Center</span>
        </div>
        <NavList />
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
          <span className="session">{session}</span>
          {!token && oidcConfigured() ? (
            <NavLink to="/auth/login" className="text-btn">
              Sign in
            </NavLink>
          ) : null}
          {token ? (
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                if (oidcConfigured()) {
                  logout(readOidcConfig());
                  return;
                }
                setBearerToken(null);
              }}
            >
              {oidcConfigured() ? "Sign out" : "Clear session"}
            </button>
          ) : null}
        </header>
        <main id="main" className="canvas">
          <Outlet />
        </main>
      </div>
      <Drawer open={menuOpen} title="Navigation" side="left" onClose={() => setMenuOpen(false)}>
        <NavList onNavigate={() => setMenuOpen(false)} />
        <p className="session drawer-session">{session}</p>
      </Drawer>
    </div>
  );
}
