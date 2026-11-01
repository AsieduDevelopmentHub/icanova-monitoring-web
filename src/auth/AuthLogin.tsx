import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useConvex } from "convex/react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router";
import { api } from "../../convex/_generated/api";
import { PasswordField } from "../ui/PasswordField";
import { SessionPulse } from "../ui/SessionPulse";
import { AuthChrome } from "./AuthChrome";
import {
  PASSWORD_RULE_HINT,
  clientPasswordIssue,
  sanitizeConvexError,
} from "./convexError";
import { safeReturnPath } from "./returnPath";

type Mode = "signIn" | "signUp";

const USERNAME_HINT = "3–32 characters: letters, numbers, dots, underscores, or hyphens.";

/** Full-screen enterprise Convex Auth login / registration. */
export function AuthLogin() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn } = useAuthActions();
  const convex = useConvex();
  const location = useLocation();
  const [signupEnabled, setSignupEnabled] = useState<boolean | undefined>(undefined);
  const [mode, setMode] = useState<Mode>("signIn");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const returnTo = safeReturnPath((location.state as { from?: unknown } | null)?.from, "/app");

  useEffect(() => {
    document.title = "Sign in · iCaNova Monitoring";
  }, []);

  useEffect(() => {
    let cancelled = false;
    void convex
      .query(api.authPublic.signupEnabled, {})
      .then((enabled) => {
        if (!cancelled) setSignupEnabled(enabled);
      })
      .catch(() => {
        if (!cancelled) setSignupEnabled(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [convex]);

  useEffect(() => {
    if (signupEnabled === false && mode === "signUp") {
      setMode("signIn");
    }
  }, [signupEnabled, mode]);

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
        <SessionPulse compact label="Checking session" />
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
    try {
      if (mode === "signUp") {
        if (signupEnabled === false) {
          setError("Public signup is disabled.");
          return;
        }
        const localIssue = clientPasswordIssue(String(form.get("password") ?? ""));
        if (localIssue) {
          setError(localIssue);
          return;
        }
      } else {
        const identifier = String(form.get("email") ?? "").trim();
        const resolved = await convex.query(api.authPublic.resolveSignInEmail, {
          identifier,
        });
        if (resolved.email) {
          form.set("email", resolved.email);
        }
      }
      await signIn("password", form);
    } catch (err) {
      setError(
        sanitizeConvexError(
          err,
          mode === "signIn"
            ? "Sign-in failed. Check username/email and password."
            : "Could not create the account. Username or email may already be registered.",
        ),
      );
    } finally {
      setPending(false);
    }
  }

  const canSignUp = signupEnabled !== false;

  return (
    <AuthChrome labelledBy="auth-login-title">
      <header className="auth-card-head">
        <h1 id="auth-login-title">{mode === "signIn" ? "Sign in" : "Create account"}</h1>
        <p className="auth-switch">
          {mode === "signIn" ? (
            canSignUp ? (
              <>
                New to iCaNova?{" "}
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
              <>Self-service signup is disabled. Ask an administrator for access.</>
            )
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
        {mode === "signUp" ? (
          <label className="field">
            <span>Username</span>
            <input
              name="username"
              type="text"
              autoComplete="username"
              required
              minLength={3}
              maxLength={32}
              pattern="[A-Za-z0-9._\-]+"
              disabled={pending}
            />
            <small className="field-hint">{USERNAME_HINT}</small>
          </label>
        ) : null}
        <label className="field">
          <span>{mode === "signIn" ? "Username or email" : "Email address"}</span>
          <input
            name="email"
            type={mode === "signIn" ? "text" : "email"}
            autoComplete={mode === "signIn" ? "username" : "email"}
            required
            disabled={pending}
          />
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
