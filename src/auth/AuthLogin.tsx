import { useEffect, useState } from "react";
import { beginLogin, readOidcConfig } from "./oidc";

/** Starts the OIDC authorization redirect when public OIDC env is configured. */
export function AuthLogin() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const config = readOidcConfig();
    if (!config) {
      setError("Sign-in is not configured. Operator must supply VITE_OIDC_* values.");
      return;
    }
    void beginLogin(config)
      .then((url) => {
        window.location.assign(url);
      })
      .catch(() => {
        setError("Could not start sign-in.");
      });
  }, []);

  return (
    <section className="page">
      <header className="page-head">
        <p className="brand-mark">iCanOva</p>
        <h1>Sign-in</h1>
        <p>Imagine. Connect. Innovate.</p>
        <p>{error ?? "Redirecting to the identity provider…"}</p>
      </header>
    </section>
  );
}
