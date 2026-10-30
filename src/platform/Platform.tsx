import { ConvexProvider, ConvexReactClient } from "convex/react";
import { useEffect, useState, type ReactNode } from "react";
import { getBearerToken, onBearerChange } from "./bearer";

function ConvexBoundary({
  url,
  children,
}: {
  url: string;
  children: ReactNode;
}) {
  const [client] = useState(() => {
    const next = new ConvexReactClient(url);
    next.setAuth(async () => getBearerToken());
    return next;
  });

  useEffect(() => {
    return onBearerChange(() => {
      client.setAuth(async () => getBearerToken());
    });
  }, [client]);

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}

export function Platform({ children }: { children: ReactNode }) {
  const url = import.meta.env.VITE_CONVEX_URL;
  if (!url) {
    return children;
  }
  return <ConvexBoundary url={url}>{children}</ConvexBoundary>;
}
