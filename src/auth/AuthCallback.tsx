import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { getBearerToken } from "../platform/bearer";
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
    void (async () => {
      const result = await completeLoginFromCallback(config, params);
      if (!result.ok) {
        setFailed(true);
        setMessage("Sign-in was refused. Clear the session and try again.");
        return;
      }
      const convexUrl = import.meta.env.VITE_CONVEX_URL?.trim();
      const token = getBearerToken();
      if (convexUrl && token) {
        try {
          const client = new ConvexHttpClient(convexUrl);
          client.setAuth(token);
          // Create the users row for this Auth0 subject so LiveGate does not treat a valid JWT as rejected.
          await client.mutation(api.users.ensure, {});
        } catch {
          setFailed(true);
          setMessage(
            "Signed in at Auth0, but this Convex deployment did not accept the session. Check AUTH_JWT_* on the deployment that VITE_CONVEX_URL points to (staging vs production).",
          );
          return;
        }
      }
      window.location.replace("/");
    })();
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
