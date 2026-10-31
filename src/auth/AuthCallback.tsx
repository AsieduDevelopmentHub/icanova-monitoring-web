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
    <section className="page">
      <header className="page-head">
        <h1>Sign in</h1>
        <p role="status">{message}</p>
        {failed ? (
          <div className="btn-row">
            <Link to="/auth/login" className="text-btn">
              Try sign-in again
            </Link>
            <Link to="/" className="text-btn">
              Back to dashboard
            </Link>
          </div>
        ) : null}
      </header>
    </section>
  );
}
