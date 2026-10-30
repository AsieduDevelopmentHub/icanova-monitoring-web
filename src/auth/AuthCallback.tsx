import { useEffect, useState } from "react";
import { completeLoginFromCallback, readOidcConfig } from "./oidc";

/** OIDC redirect target. Never renders tokens or raw IdP errors. */
export function AuthCallback() {
  const [message, setMessage] = useState("Completing sign-in…");

  useEffect(() => {
    const config = readOidcConfig();
    if (!config) {
      setMessage("Sign-in is not configured on this build.");
      return;
    }
    const params = new URLSearchParams(window.location.search);
    void completeLoginFromCallback(config, params).then((result) => {
      if (result.ok) {
        window.location.replace("/");
        return;
      }
      setMessage("Sign-in was refused. Clear the session and try again.");
    });
  }, []);

  return (
    <section className="page">
      <header className="page-head">
        <h1>Sign-in</h1>
        <p>{message}</p>
      </header>
    </section>
  );
}
