import { useAction } from "convex/react";
import { useState, type FormEvent } from "react";
import { api } from "../../convex/_generated/api";
import { PasswordField } from "../ui/PasswordField";
import {
  PASSWORD_RULE_HINT,
  clientPasswordIssue,
  sanitizeConvexError,
} from "./convexError";

/** Signed-in password rotation using Convex Auth account credentials. */
export function ChangePasswordForm() {
  const changePassword = useAction(api.accountSecurity.changePassword);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setPending(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    const currentPassword = String(data.get("currentPassword") ?? "");
    const newPassword = String(data.get("newPassword") ?? "");
    const confirmPassword = String(data.get("confirmPassword") ?? "");
    try {
      if (newPassword !== confirmPassword) {
        throw new Error("New password and confirmation do not match.");
      }
      const localIssue = clientPasswordIssue(newPassword);
      if (localIssue) {
        throw new Error(localIssue);
      }
      await changePassword({ currentPassword, newPassword });
      form.reset();
      setInfo("Password updated. Other sessions were signed out.");
    } catch (err) {
      setError(sanitizeConvexError(err, "Could not change password."));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="stack" onSubmit={(event) => void onSubmit(event)}>
      <PasswordField
        className="filter-field"
        label="Current password"
        name="currentPassword"
        autoComplete="current-password"
        required
        disabled={pending}
      />
      <PasswordField
        className="filter-field"
        label="New password"
        name="newPassword"
        autoComplete="new-password"
        required
        minLength={8}
        disabled={pending}
        hint={PASSWORD_RULE_HINT}
      />
      <PasswordField
        className="filter-field"
        label="Confirm new password"
        name="confirmPassword"
        autoComplete="new-password"
        required
        minLength={8}
        disabled={pending}
      />
      {error ? (
        <p className="notice" role="alert">
          {error}
        </p>
      ) : null}
      {info ? (
        <p className="notice" role="status">
          {info}
        </p>
      ) : null}
      <div className="btn-row">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Updating…" : "Update password"}
        </button>
      </div>
    </form>
  );
}
