import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { Drawer } from "../ui/Overlay";
import { Icon } from "../ui/icons";
import { NAV, NAV_GROUPS, crumbsFor } from "./nav";

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
          <span className="session">Not signed in</span>
        </header>
        <main id="main" className="canvas">
          <Outlet />
        </main>
      </div>
      <Drawer open={menuOpen} title="Navigation" side="left" onClose={() => setMenuOpen(false)}>
        <NavList onNavigate={() => setMenuOpen(false)} />
        <p className="session drawer-session">Not signed in</p>
      </Drawer>
    </div>
  );
}
