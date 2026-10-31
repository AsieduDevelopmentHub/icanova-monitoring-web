import { useEffect, useState } from "react";
import { Link } from "react-router";
import { completeLoginFromCallback, readOidcConfig } from "./oidc";

/** OIDC redirect target. Never renders tokens or raw IdP errors. */
export function AuthCallback() {
  const [message, setMessage] = useState("Completing sign-in…");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const config = readOidcConfig();
    if (!config) {
      setMessage("Sign-in is not configured on this build.");
      setFailed(true);
      return;
    }
    const params = new URLSearchParams(window.location.search);
    void completeLoginFromCallback(config, params).then((result) => {
      if (result.ok) {
        window.location.replace("/");
        return;
      }
      setFailed(true);
      setMessage("Sign-in was refused. Clear the session and try again.");
    });
  }, []);

  return (
    <div className="auth-screen">
      <section className="auth-panel" aria-labelledby="auth-callback-title">
        <header className="page-head">
          <p className="brand-mark">iCanOva</p>
          <p className="brand-name">iCanOva Monitoring</p>
          <h1 id="auth-callback-title">Sign in</h1>
          <p role="status">{message}</p>
          {failed ? (
            <div className="btn-row">
              <Link to="/auth/login" className="btn btn-primary">
                Try sign-in again
              </Link>
              <Link to="/" className="btn btn-secondary">
                Back to dashboard
              </Link>
            </div>
          ) : null}
        </header>
      </section>
    </div>
  );
}
