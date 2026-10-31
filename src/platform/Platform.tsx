import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { useState, type ReactNode } from "react";

/**
 * Active auth: Convex Auth via ConvexAuthProvider.
 * Auth0 OIDC bearer wiring is inactive (see src/auth/integrations/auth0/).
 */
export function Platform({ children }: { children: ReactNode }) {
  const url = import.meta.env.VITE_CONVEX_URL;
  const [client] = useState(() => (url ? new ConvexReactClient(url) : null));
  if (!url || !client) {
    return children;
  }
  return <ConvexAuthProvider client={client}>{children}</ConvexAuthProvider>;
}
