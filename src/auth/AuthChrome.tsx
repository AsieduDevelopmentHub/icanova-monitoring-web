import type { ReactNode } from "react";
import { Link } from "react-router";
import { AuthTechDiagram } from "./AuthTechDiagram";

type AuthChromeProps = {
  children: ReactNode;
  /** Optional labelled section id for the form panel. */
  labelledBy?: string;
};

/** Auth chrome — form left, animated IoT diagram right. */
export function AuthChrome({ children, labelledBy }: AuthChromeProps) {
  return (
    <div className="auth-shell">
      <div className="auth-form-pane">
        <header className="auth-form-top">
          <AuthFormBrand />
          <Link to="/" className="auth-form-top-link">
            Learn more
          </Link>
        </header>
        <section className="auth-panel auth-card" aria-labelledby={labelledBy}>
          {children}
        </section>
        <footer className="auth-form-legal">
          <span>© 2026 iCaNova · Established 2026</span>
        </footer>
      </div>
      <aside className="auth-brand-pane" aria-hidden="true">
        <div className="auth-brand-frame">
          <AuthTechDiagram />
          <div className="auth-brand-overlay">
            <p className="auth-brand-eyebrow">Industrial edge network</p>
            <h2>Honest industrial visibility.</h2>
            <p>Edge Gateways, generators, and site status — without inventing calm.</p>
            <p className="auth-brand-tag">Imagine. Connect. Innovate.</p>
          </div>
        </div>
      </aside>
    </div>
  );
}

export function AuthFormBrand() {
  return (
    <Link to="/" className="auth-brand-lockup auth-brand-lockup-link" aria-label="iCaNova Monitoring home">
      <span className="auth-brand-mark">iCaNova</span>
      <span className="auth-brand-sub">Monitoring</span>
    </Link>
  );
}
