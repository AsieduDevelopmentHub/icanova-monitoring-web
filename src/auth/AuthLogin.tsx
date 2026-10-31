import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router";
import { safeReturnPath } from "./returnPath";

type Mode = "signIn" | "signUp";

/** Full-screen enterprise Convex Auth login / registration. */
export function AuthLogin() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn } = useAuthActions();
  const location = useLocation();
  const [mode, setMode] = useState<Mode>("signIn");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const returnTo = safeReturnPath((location.state as { from?: unknown } | null)?.from, "/app");

  useEffect(() => {
    document.title = "Sign in · iCanOva Monitoring";
  }, []);

  if (!import.meta.env.VITE_CONVEX_URL) {
    return (
      <div className="auth-shell">
        <BrandPane />
        <div className="auth-form-pane">
          <section className="auth-panel auth-card" aria-labelledby="auth-login-title">
            <header className="page-head">
              <p className="brand-mark">iCanOva</p>
              <p className="brand-name">Monitoring</p>
              <h1 id="auth-login-title">Sign in</h1>
              <div className="notice" role="alert">
                <strong>No deployment URL.</strong>
                <p>
                  Set <code className="tech">VITE_CONVEX_URL</code> to use Convex Auth.
                </p>
              </div>
              <Link to="/" className="btn btn-secondary">
                Back to home
              </Link>
            </header>
          </section>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="auth-shell">
        <BrandPane />
        <div className="auth-form-pane">
          <section className="auth-panel auth-card">
            <p role="status">Checking session…</p>
          </section>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={returnTo} replace />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    form.set("flow", mode);
    try {
      await signIn("password", form);
    } catch {
      setError(
        mode === "signIn"
          ? "Sign-in failed. Check email and password."
          : "Could not create the account. The email may already be registered.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-shell">
      <BrandPane />
      <div className="auth-form-pane">
        <section className="auth-panel auth-card" aria-labelledby="auth-login-title">
          <header className="page-head">
            <p className="brand-mark">iCanOva</p>
            <p className="brand-name">Monitoring</p>
            <h1 id="auth-login-title">{mode === "signIn" ? "Sign in" : "Create account"}</h1>
          </header>
          <form className="stack" onSubmit={(event) => void onSubmit(event)}>
            <label className="field">
              <span>Email</span>
              <input name="email" type="email" autoComplete="username" required disabled={pending} />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                name="password"
                type="password"
                autoComplete={mode === "signIn" ? "current-password" : "new-password"}
                required
                minLength={8}
                disabled={pending}
              />
            </label>
            {error ? (
              <p className="notice" role="alert">
                {error}
              </p>
            ) : null}
            <div className="btn-row">
              <button type="submit" className="btn btn-primary" disabled={pending}>
                {pending ? "Working…" : mode === "signIn" ? "Sign in" : "Create account"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={pending}
                onClick={() => {
                  setError(null);
                  setMode((current) => (current === "signIn" ? "signUp" : "signIn"));
                }}
              >
                {mode === "signIn" ? "Create an account" : "Have an account? Sign in"}
              </button>
            </div>
          </form>
          {mode === "signIn" ? (
            <p className="empty" style={{ marginTop: "1.25rem" }}>
              <Link to="/auth/reset" className="text-btn">
                Forgot password?
              </Link>
            </p>
          ) : null}
          <Link to="/" className="btn btn-secondary" style={{ marginTop: "0.75rem" }}>
            Back to home
          </Link>
        </section>
      </div>
    </div>
  );
}

function BrandPane() {
  return (
    <aside className="auth-brand-pane" aria-hidden="true">
      <div>
        <div className="brand-mark">iCanOva</div>
        <div className="brand-name">Monitoring</div>
      </div>
      <div>
        <h2>Command Center</h2>
        <p>Gateways, generators, and site status.</p>
      </div>
      <p>Imagine. Connect. Innovate.</p>
    </aside>
  );
}
