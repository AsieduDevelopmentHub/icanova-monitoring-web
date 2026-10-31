import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router";
import { AuthChrome, AuthFormBrand } from "./AuthChrome";
import { resetRequestConfirmation } from "./passwordResetCopy";

type Step = "request" | "verify";

/**
 * Convex Auth Password recovery: request OTP email, then set a new password.
 * UI always uses a non-enumerating confirmation after the request step.
 */
export function AuthPasswordReset() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn } = useAuthActions();
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    document.title = "Reset password · iCanOva Monitoring";
  }, []);

  if (!import.meta.env.VITE_CONVEX_URL) {
    return (
      <AuthChrome>
        <AuthFormBrand />
        <p role="alert">Set VITE_CONVEX_URL to use password recovery.</p>
        <div className="auth-footer">
          <Link to="/auth/login" className="text-btn">
            Back to sign in
          </Link>
        </div>
      </AuthChrome>
    );
  }

  if (isLoading) {
    return (
      <AuthChrome>
        <AuthFormBrand />
        <p role="status">Checking session…</p>
      </AuthChrome>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/app" replace />;
  }

  async function onRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const requested = String(form.get("email") ?? "")
      .trim()
      .toLowerCase();
    form.set("flow", "reset");
    try {
      await signIn("password", form);
    } catch {
      // Anti-enumeration: do not reveal whether the email exists or mail failed.
    } finally {
      setPending(false);
      setEmail(requested);
      setStep("verify");
      setInfo(resetRequestConfirmation());
    }
  }

  async function onVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    form.set("flow", "reset-verification");
    form.set("email", email);
    try {
      await signIn("password", form);
    } catch {
      setError("Could not reset the password. Check the code and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthChrome labelledBy="auth-reset-title">
      <header className="page-head">
        <AuthFormBrand />
        <h1 id="auth-reset-title">Reset password</h1>
        <p className="auth-lede">Recover access with a one-time email code.</p>
      </header>

      {step === "request" ? (
        <form className="stack auth-form" onSubmit={(event) => void onRequest(event)}>
          <label className="field">
            <span>Email</span>
            <input name="email" type="email" autoComplete="username" required disabled={pending} />
          </label>
          {error ? (
            <p className="notice" role="alert">
              {error}
            </p>
          ) : null}
          <div className="btn-row auth-actions">
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? "Sending…" : "Send reset code"}
            </button>
            <Link to="/auth/login" className="btn btn-secondary">
              Back to sign in
            </Link>
          </div>
        </form>
      ) : (
        <form className="stack auth-form" onSubmit={(event) => void onVerify(event)}>
          {info ? (
            <p className="notice" role="status">
              {info}
            </p>
          ) : null}
          <label className="field">
            <span>Reset code</span>
            <input
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              disabled={pending}
            />
          </label>
          <label className="field">
            <span>New password</span>
            <input
              name="newPassword"
              type="password"
              autoComplete="new-password"
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
          <div className="btn-row auth-actions">
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? "Working…" : "Update password"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={pending}
              onClick={() => {
                setStep("request");
                setError(null);
                setInfo(null);
              }}
            >
              Start over
            </button>
          </div>
        </form>
      )}
    </AuthChrome>
  );
}
