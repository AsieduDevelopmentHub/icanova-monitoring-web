import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { BrandWordmark } from "../../../marketing/BrandLogo";
import { getBearerToken } from "../../../platform/bearer";
import { completeLoginFromCallback, readOidcConfig } from "./oidc";

/**
 * Auth0 OIDC redirect target — inactive in the default Convex Auth flow.
 * Kept for future enterprise IdP reactivation only.
 */
export function AuthCallback() {
  const [message, setMessage] = useState("Auth0 sign-in is inactive on this build.");
  const [failed, setFailed] = useState(true);

  useEffect(() => {
    const config = readOidcConfig();
    if (!config) {
      setMessage(
        "Auth0 is retained as a future integration but is not the active login provider. Use /auth/login for Convex Auth.",
      );
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
          await client.mutation(api.users.ensure, {});
        } catch {
          setFailed(true);
          setMessage(
            "Signed in at Auth0, but this Convex deployment did not accept the session. Auth0 is not the active provider.",
          );
          return;
        }
      }
      window.location.replace("/app");
    })();
  }, []);

  return (
    <div className="auth-screen">
      <section className="auth-panel" aria-labelledby="auth-callback-title">
        <header className="page-head">
          <BrandWordmark className="auth-callback-wordmark" />
          <h1 id="auth-callback-title">Auth0 callback</h1>
          <p role="status">{message}</p>
          {failed ? (
            <div className="btn-row">
              <Link to="/auth/login" className="btn btn-primary">
                Use Convex Auth sign-in
              </Link>
              <Link to="/app" className="btn btn-secondary">
                Back to dashboard
              </Link>
            </div>
          ) : null}
        </header>
      </section>
    </div>
  );
}
