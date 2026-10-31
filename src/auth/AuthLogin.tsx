import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router";
import { PasswordField } from "../ui/PasswordField";
import { AuthChrome } from "./AuthChrome";
import {
  PASSWORD_RULE_HINT,
  clientPasswordIssue,
  sanitizeConvexError,
} from "./convexError";
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
      <AuthChrome labelledBy="auth-login-title">
        <h1 id="auth-login-title">Sign in</h1>
        <div className="notice" role="alert">
          <strong>No deployment URL.</strong>
          <p>
            Set <code className="tech">VITE_CONVEX_URL</code> to use Convex Auth.
          </p>
        </div>
      </AuthChrome>
    );
  }

  if (isLoading) {
    return (
      <AuthChrome>
        <p role="status">Checking session…</p>
      </AuthChrome>
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
    if (mode === "signUp") {
      const localIssue = clientPasswordIssue(String(form.get("password") ?? ""));
      if (localIssue) {
        setError(localIssue);
        setPending(false);
        return;
      }
    }
    try {
      await signIn("password", form);
    } catch (err) {
      setError(
        sanitizeConvexError(
          err,
          mode === "signIn"
            ? "Sign-in failed. Check email and password."
            : "Could not create the account. The email may already be registered.",
        ),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthChrome labelledBy="auth-login-title">
      <header className="auth-card-head">
        <h1 id="auth-login-title">{mode === "signIn" ? "Sign in" : "Create account"}</h1>
        <p className="auth-switch">
          {mode === "signIn" ? (
            <>
              New to iCanOva?{" "}
              <button
                type="button"
                className="auth-text-link"
                disabled={pending}
                onClick={() => {
                  setError(null);
                  setMode("signUp");
                }}
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                className="auth-text-link"
                disabled={pending}
                onClick={() => {
                  setError(null);
                  setMode("signIn");
                }}
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </header>
      <form className="stack auth-form" onSubmit={(event) => void onSubmit(event)}>
        <label className="field">
          <span>Email address</span>
          <input name="email" type="email" autoComplete="username" required disabled={pending} />
        </label>
        <PasswordField
          label="Password"
          name="password"
          autoComplete={mode === "signIn" ? "current-password" : "new-password"}
          required
          minLength={8}
          disabled={pending}
          hint={mode === "signUp" ? PASSWORD_RULE_HINT : undefined}
        />
        {error ? (
          <p className="notice" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="btn btn-primary auth-submit" disabled={pending}>
          {pending ? "Working…" : mode === "signIn" ? "Sign in" : "Create account"}
        </button>
      </form>
      {mode === "signIn" ? (
        <p className="auth-aux">
          <Link to="/auth/reset" className="auth-text-link">
            Forgot password?
          </Link>
        </p>
      ) : null}
    </AuthChrome>
  );
}
