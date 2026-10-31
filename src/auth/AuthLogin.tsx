import { useEffect, useState } from "react";
import { Link } from "react-router";
import { beginLogin, oidcConfigured, readOidcConfig } from "./oidc";

type Phase = "checking" | "redirecting" | "not_configured" | "error";

/** Starts the OIDC authorization redirect when public OIDC env is configured. */
export function AuthLogin() {
  const [phase, setPhase] = useState<Phase>(() => (oidcConfigured() ? "checking" : "not_configured"));
  const [error, setError] = useState<string | null>(null);

  async function startLogin() {
    const config = readOidcConfig();
    if (!config) {
      setPhase("not_configured");
      setError("Sign-in is not configured. Operator must supply VITE_OIDC_* values at build time.");
      return;
    }
    setPhase("redirecting");
    setError(null);
    try {
      const url = await beginLogin(config);
      window.location.assign(url);
    } catch {
      setPhase("error");
      setError("Could not start sign-in.");
    }
  }

  useEffect(() => {
    if (!oidcConfigured()) {
      setPhase("not_configured");
      return;
    }
    void startLogin();
  }, []);

  return (
    <section className="page">
      <header className="page-head">
        <p className="brand-mark">iCanOva</p>
        <h1>Sign in</h1>
        <p>iCanOva Monitoring</p>
        <p>Imagine. Connect. Innovate.</p>
        {phase === "checking" || phase === "redirecting" ? (
          <p role="status">Redirecting to the identity provider…</p>
        ) : null}
        {phase === "not_configured" ? (
          <div className="notice" role="alert">
            <strong>Sign-in is not configured for this build.</strong>
            <p>
              Public OIDC variables are missing or incomplete (
              <code>VITE_OIDC_ISSUER</code>, <code>VITE_OIDC_CLIENT_ID</code>,{" "}
              <code>VITE_OIDC_AUDIENCE</code>, <code>VITE_OIDC_REDIRECT_URI</code>
              ). Rebuild the SPA after they are set. Audience must be{" "}
              <code>icanova</code> (no lab fallback).
            </p>
          </div>
        ) : null}
        {error && phase === "error" ? (
          <p className="notice" role="alert">
            {error}
          </p>
        ) : null}
        <div className="btn-row">
          {phase === "not_configured" || phase === "error" ? (
            <button type="button" className="text-btn" onClick={() => void startLogin()}>
              Try sign-in again
            </button>
          ) : (
            <button type="button" className="text-btn" onClick={() => void startLogin()}>
              Continue to sign-in
            </button>
          )}
          <Link to="/" className="text-btn">
            Back to dashboard
          </Link>
        </div>
      </header>
    </section>
  );
}
