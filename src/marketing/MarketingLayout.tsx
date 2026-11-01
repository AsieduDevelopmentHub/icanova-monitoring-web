import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { useConvexAuth } from "convex/react";
import { BrandLogo } from "./BrandLogo";
import "./landing.css";

type MarketingLayoutProps = {
  children: ReactNode;
  /** When true, add scroll-reveal observer for `[data-mkt-reveal]` nodes. */
  reveal?: boolean;
};

export function MarketingLayout({ children, reveal = false }: MarketingLayoutProps) {
  const { isAuthenticated } = useConvexAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const exploreTo = isAuthenticated ? "/app" : "/auth/login";
  const exploreLabel = isAuthenticated ? "Open platform" : "Get started";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  useEffect(() => {
    if (!reveal) return;
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-mkt-reveal]"));
    if (!nodes.length) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      nodes.forEach((node) => node.classList.add("is-in"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            observer.unobserve(entry.target);
          }
        }
      },
      { root: null, rootMargin: "0px 0px -6% 0px", threshold: 0.08 },
    );
    nodes.forEach((node) => {
      const rect = node.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) {
        node.classList.add("is-in");
        return;
      }
      observer.observe(node);
    });
    return () => observer.disconnect();
  }, [reveal, location.pathname]);

  return (
    <div className="mkt">
      <header className={scrolled ? "mkt-nav is-scrolled" : "mkt-nav"}>
        <Link to="/" className="mkt-brand" aria-label="iCaNova Monitoring home">
          <span className="mkt-brand-plate">
            <BrandLogo variant="lockup" className="mkt-brand-logo-lockup" alt="iCaNova" />
          </span>
        </Link>
        <ul className="mkt-nav-pill">
          <li>
            <NavLink to="/" end>
              Home
            </NavLink>
          </li>
          <li>
            <NavLink to="/platform">Platform</NavLink>
          </li>
          <li>
            <NavLink to="/product">Product</NavLink>
          </li>
          <li>
            <NavLink to="/about">About</NavLink>
          </li>
          <li>
            <NavLink to="/contact">Contact</NavLink>
          </li>
        </ul>
        <div className="mkt-nav-actions">
          <Link
            className="mkt-btn mkt-btn-nav mkt-btn-nav-desktop"
            to={isAuthenticated ? "/app" : "/auth/login"}
          >
            {isAuthenticated ? "Dashboard" : "Sign in"}
          </Link>
          <button
            type="button"
            className="mkt-menu-btn"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="mkt-menu-icon" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
        </div>
      </header>
      {menuOpen ? (
        <button
          type="button"
          className="mkt-menu-backdrop"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}
      <nav
        className={menuOpen ? "mkt-drawer open" : "mkt-drawer"}
        aria-label="Mobile"
        aria-hidden={!menuOpen}
      >
        <NavLink to="/" end onClick={() => setMenuOpen(false)}>
          Home
        </NavLink>
        <NavLink to="/platform" onClick={() => setMenuOpen(false)}>
          Platform
        </NavLink>
        <NavLink to="/product" onClick={() => setMenuOpen(false)}>
          Product
        </NavLink>
        <NavLink to="/about" onClick={() => setMenuOpen(false)}>
          About
        </NavLink>
        <NavLink to="/contact" onClick={() => setMenuOpen(false)}>
          Contact
        </NavLink>
        <div className="mkt-drawer-actions">
          <Link
            className="mkt-btn mkt-btn-secondary"
            to="/auth/login"
            onClick={() => setMenuOpen(false)}
          >
            Sign in
          </Link>
          <Link
            className="mkt-btn mkt-btn-primary"
            to={exploreTo}
            onClick={() => setMenuOpen(false)}
          >
            {exploreLabel}
          </Link>
        </div>
      </nav>

      {children}

      <footer className="mkt-footer">
        <div className="mkt-inner mkt-footer-grid">
          <div>
            <div className="mkt-footer-brand">
              <BrandLogo variant="lockup" className="mkt-footer-logo" alt="iCaNova" />
            </div>
            <p className="mkt-footer-tag">Imagine. Connect. Innovate.</p>
            <p className="mkt-footer-tag">Intelligent technology for connected industries.</p>
          </div>
          <div className="mkt-footer-cols">
            <div>
              <h3>Product</h3>
              <ul>
                <li>
                  <Link to="/">Home</Link>
                </li>
                <li>
                  <Link to="/product">Edge Gateway</Link>
                </li>
                <li>
                  <Link to="/platform">Platform</Link>
                </li>
                <li>
                  <Link to="/#capabilities">Capabilities</Link>
                </li>
                <li>
                  <Link to="/#faq">FAQ</Link>
                </li>
              </ul>
            </div>
            <div>
              <h3>Access</h3>
              <ul>
                <li>
                  <Link to="/auth/login">Sign in</Link>
                </li>
                <li>
                  <Link to={exploreTo}>{exploreLabel}</Link>
                </li>
                <li>
                  <Link to="/contact">Contact</Link>
                </li>
              </ul>
            </div>
            <div>
              <h3>Company</h3>
              <ul>
                <li>
                  <Link to="/about">About iCaNova</Link>
                </li>
                <li>
                  <Link to="/privacy">Privacy</Link>
                </li>
                <li>
                  <Link to="/terms">Terms</Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mkt-footer-mark" aria-hidden="true">
          <BrandLogo variant="wordmark" className="mkt-footer-mark-img" alt="" />
        </div>
        <p className="mkt-footer-legal mkt-inner">
          © 2026 iCaNova. All rights reserved. · Established 2026
        </p>
      </footer>
    </div>
  );
}
