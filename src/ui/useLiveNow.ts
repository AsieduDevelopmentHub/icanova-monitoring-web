import { useEffect, useState } from "react";

/** Client tick for age-based live indicators — not a full page reload. */
export const LIVE_TICK_MS = 30_000;

export function useLiveNow(intervalMs = LIVE_TICK_MS): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}
