import { useAction } from "convex/react";
import { useState, type FormEvent } from "react";
import { api } from "../../convex/_generated/api";

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
      await changePassword({ currentPassword, newPassword });
      form.reset();
      setInfo("Password updated. Other sessions were signed out.");
    } catch (err) {
      const message =
        err instanceof Error && err.message.trim().length > 0
          ? err.message.replace(/^\[CONVEX[^\]]*\]\s*/i, "").replace(/^Uncaught Error:\s*/i, "")
          : "Could not change password.";
      setError(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="stack" onSubmit={(event) => void onSubmit(event)}>
      <label className="filter-field">
        <span>Current password</span>
        <input
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          disabled={pending}
        />
      </label>
      <label className="filter-field">
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
      <label className="filter-field">
        <span>Confirm new password</span>
        <input
          name="confirmPassword"
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
