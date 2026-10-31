import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router";
import { OtpInput } from "../ui/OtpInput";
import { PasswordField } from "../ui/PasswordField";
import { AuthChrome } from "./AuthChrome";
import {
  PASSWORD_RULE_HINT,
  clientPasswordIssue,
  sanitizeConvexError,
} from "./convexError";
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
        <p role="alert">Set VITE_CONVEX_URL to use password recovery.</p>
        <p className="auth-aux">
          <Link to="/auth/login" className="auth-text-link">
            Back to sign in
          </Link>
        </p>
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
    const newPassword = String(form.get("newPassword") ?? "");
    const localIssue = clientPasswordIssue(newPassword);
    if (localIssue) {
      setError(localIssue);
      setPending(false);
      return;
    }
    try {
      await signIn("password", form);
    } catch (err) {
      setError(
        sanitizeConvexError(
          err,
          "Could not reset the password. Check the latest code and try again.",
        ),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthChrome labelledBy="auth-reset-title">
      <header className="auth-card-head">
        <h1 id="auth-reset-title">Reset password</h1>
        <p className="auth-switch">
          Remembered it?{" "}
          <Link to="/auth/login" className="auth-text-link">
            Sign in
          </Link>
        </p>
      </header>

      {step === "request" ? (
        <form className="stack auth-form" onSubmit={(event) => void onRequest(event)}>
          <label className="field">
            <span>Email address</span>
            <input name="email" type="email" autoComplete="username" required disabled={pending} />
          </label>
          {error ? (
            <p className="notice" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="btn btn-primary auth-submit" disabled={pending}>
            {pending ? "Sending…" : "Send reset code"}
          </button>
        </form>
      ) : (
        <form className="stack auth-form" onSubmit={(event) => void onVerify(event)}>
          {info ? (
            <p className="notice" role="status">
              {info}
            </p>
          ) : null}
          <div className="field">
            <span>Reset code</span>
            <OtpInput name="code" length={8} required disabled={pending} />
          </div>
          <PasswordField
            label="New password"
            name="newPassword"
            autoComplete="new-password"
            required
            minLength={8}
            disabled={pending}
            hint={PASSWORD_RULE_HINT}
          />
          {error ? (
            <p className="notice" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="btn btn-primary auth-submit" disabled={pending}>
            {pending ? "Working…" : "Update password"}
          </button>
          <p className="auth-aux">
            <button
              type="button"
              className="auth-text-link"
              disabled={pending}
              onClick={() => {
                setStep("request");
                setError(null);
                setInfo(null);
              }}
            >
              Start over
            </button>
          </p>
        </form>
      )}
    </AuthChrome>
  );
}
