import { useEffect, useRef, useState } from "react";
import { applyRosterOrder, sortSitesByCode, type SiteRosterRow } from "./siteRosterView";

/** How long the roster waits before painting the next batch of site updates. */
export const ROSTER_REFRESH_MS = 15_000;

function freezeOrder(rows: readonly SiteRosterRow[]): string[] {
  return sortSitesByCode(rows).map((row) => row.siteId);
}

/**
 * Keep site row order stable; apply Convex field updates on a timer so the
 * page does not reshuffle on every individual gateway ingest.
 */
export function useThrottledRoster(
  rows: readonly SiteRosterRow[],
  refreshMs = ROSTER_REFRESH_MS,
): SiteRosterRow[] {
  const orderRef = useRef<string[]>([]);
  const latestRef = useRef(rows);
  latestRef.current = rows;

  const [display, setDisplay] = useState<SiteRosterRow[]>(() =>
    rows.length ? applyRosterOrder(freezeOrder(rows), rows) : [],
  );

  useEffect(() => {
    const latest = rows;
    if (latest.length === 0) {
      orderRef.current = [];
      setDisplay([]);
      return;
    }

    const liveIds = new Set(latest.map((row) => row.siteId));
    const overlap = orderRef.current.filter((id) => liveIds.has(id)).length;
    // First load or org switch (no shared site ids): freeze a new stable order now.
    if (orderRef.current.length === 0 || overlap === 0) {
      orderRef.current = freezeOrder(latest);
      setDisplay(applyRosterOrder(orderRef.current, latest));
    }
  }, [rows]);

  useEffect(() => {
    const paint = () => {
      const latest = latestRef.current;
      if (latest.length === 0) {
        orderRef.current = [];
        setDisplay([]);
        return;
      }
      const liveIds = new Set(latest.map((row) => row.siteId));
      orderRef.current = orderRef.current.filter((id) => liveIds.has(id));
      if (orderRef.current.length === 0) {
        orderRef.current = freezeOrder(latest);
      } else {
        for (const row of sortSitesByCode(latest)) {
          if (!orderRef.current.includes(row.siteId)) {
            orderRef.current.push(row.siteId);
          }
        }
      }
      setDisplay(applyRosterOrder(orderRef.current, latest));
    };

    const id = window.setInterval(paint, refreshMs);
    return () => window.clearInterval(id);
  }, [refreshMs]);

  return display;
}
