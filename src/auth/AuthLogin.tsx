import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useConvex, useMutation } from "convex/react";
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

type Mode = "signIn" | "signUp" | "request";

const USERNAME_HINT = "3–32 characters: letters, numbers, dots, underscores, or hyphens.";

/** Full-screen enterprise Convex Auth login / controlled registration. */
export function AuthLogin() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn } = useAuthActions();
  const convex = useConvex();
  const requestAccess = useMutation(api.accessRequests.submit);
  const location = useLocation();
  const [signupEnabled, setSignupEnabled] = useState<boolean | undefined>(undefined);
  const [mode, setMode] = useState<Mode>("signIn");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [orgNames, setOrgNames] = useState<string[]>([]);
  const [showOrgHint, setShowOrgHint] = useState(false);
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
    if (mode !== "request") {
      setShowOrgHint(false);
      setOrgNames([]);
      return;
    }
    let cancelled = false;
    void convex
      .query(api.accessRequests.organizationHints, {})
      .then((hints) => {
        if (cancelled) return;
        setShowOrgHint(hints.show === true);
        setOrgNames(hints.show ? hints.names : []);
      })
      .catch(() => {
        if (cancelled) return;
        setShowOrgHint(false);
        setOrgNames([]);
      });
    return () => {
      cancelled = true;
    };
  }, [convex, mode]);

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
    setMessage(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      if (mode === "request") {
        await requestAccess({
          name: String(form.get("name") ?? ""),
          email: String(form.get("email") ?? ""),
          organizationHint: String(form.get("organizationHint") ?? "") || undefined,
          note: String(form.get("note") ?? "") || undefined,
        });
        setMessage("Request submitted. An administrator will contact you when access is ready.");
        event.currentTarget.reset();
        return;
      }
      form.set("flow", mode);
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
            : mode === "request"
              ? "Could not submit the access request."
              : "Could not create the account. Username or email may already be registered.",
        ),
      );
    } finally {
      setPending(false);
    }
  }

  const canSignUp = signupEnabled === true;
  const title =
    mode === "signIn" ? "Sign in" : mode === "request" ? "Request access" : "Create account";

  return (
    <AuthChrome labelledBy="auth-login-title">
      <header className="auth-card-head">
        <h1 id="auth-login-title">{title}</h1>
        <p className="auth-switch">
          {mode === "signIn" ? (
            <>
              Need an account?{" "}
              {canSignUp ? (
                <button
                  type="button"
                  className="auth-text-link"
                  disabled={pending}
                  onClick={() => {
                    setError(null);
                    setMessage(null);
                    setMode("signUp");
                  }}
                >
                  Sign up
                </button>
              ) : (
                <button
                  type="button"
                  className="auth-text-link"
                  disabled={pending}
                  onClick={() => {
                    setError(null);
                    setMessage(null);
                    setMode("request");
                  }}
                >
                  Request access
                </button>
              )}
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
                  setMessage(null);
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
        {mode === "request" ? (
          <>
            <label className="field">
              <span>Full name</span>
              <input name="name" type="text" required disabled={pending} autoComplete="name" />
            </label>
            <label className="field">
              <span>Work email</span>
              <input name="email" type="email" required disabled={pending} autoComplete="email" />
            </label>
            {showOrgHint ? (
              <label className="field">
                <span>Organization (optional)</span>
                <select name="organizationHint" disabled={pending} defaultValue="">
                  <option value="">Select organization</option>
                  {orgNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="field">
              <span>Note (optional)</span>
              <input name="note" type="text" disabled={pending} />
            </label>
          </>
        ) : null}
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
        {mode !== "request" ? (
          <>
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
          </>
        ) : null}
        {error ? (
          <p className="notice" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="notice" role="status">
            {message}
          </p>
        ) : null}
        <button type="submit" className="btn btn-primary auth-submit" disabled={pending}>
          {pending
            ? "Working…"
            : mode === "signIn"
              ? "Sign in"
              : mode === "request"
                ? "Submit request"
                : "Create account"}
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
