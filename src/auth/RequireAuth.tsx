import { useConvexAuth } from "convex/react";
import { Navigate, Outlet, useLocation } from "react-router";
import { SessionPulse } from "../ui/SessionPulse";

/** Blocks Shell ops routes until Convex Auth has a session. Soft-AP routes stay outside this layout. */
export function RequireAuth() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const location = useLocation();

  if (!import.meta.env.VITE_CONVEX_URL) {
    return (
      <div className="auth-shell">
        <section className="auth-panel auth-card">
          <div className="notice" role="alert">
            <strong>No deployment URL.</strong>
            <p>
              Set <code className="tech">VITE_CONVEX_URL</code> before signing in to the monitoring
              application.
            </p>
          </div>
        </section>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="auth-shell auth-shell-pending">
        <SessionPulse label="Checking session" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/auth/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return <Outlet />;
}
