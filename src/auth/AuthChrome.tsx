import type { ReactNode } from "react";
import { Link } from "react-router";

type AuthChromeProps = {
  children: ReactNode;
  /** Optional labelled section id for the form panel. */
  labelledBy?: string;
};

/** Shared landing-family chrome for public auth screens. */
export function AuthChrome({ children, labelledBy }: AuthChromeProps) {
  return (
    <div className="auth-shell">
      <aside className="auth-brand-pane" aria-hidden="true">
        <div className="auth-brand-lockup">
          <span className="auth-brand-mark">iCanOva</span>
          <span className="auth-brand-sub">Monitoring</span>
        </div>
        <div className="auth-brand-body">
          <h2>Honest industrial visibility.</h2>
          <p>Edge Gateways, generators, and site status — without inventing calm.</p>
          <img
            className="auth-brand-product"
            src="/brand/icanova-edge-gateway.png?v=7"
            alt=""
            width={813}
            height={545}
            decoding="async"
          />
        </div>
        <p className="auth-brand-tag">Imagine. Connect. Innovate.</p>
      </aside>
      <div className="auth-form-pane">
        <section className="auth-panel auth-card" aria-labelledby={labelledBy}>
          {children}
        </section>
      </div>
    </div>
  );
}

export function AuthFormBrand() {
  return (
    <div className="auth-form-brand">
      <Link to="/" className="auth-brand-lockup auth-brand-lockup-link">
        <span className="auth-brand-mark">iCanOva</span>
        <span className="auth-brand-sub">Monitoring</span>
      </Link>
    </div>
  );
}
