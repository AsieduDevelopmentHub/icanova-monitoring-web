import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import { snapshotScope } from "../../telemetry/fleetView";
import { pageFreshness } from "../../telemetry/freshness";
import { EmptyState } from "../../ui/EmptyState";
import { DashboardSkeleton } from "../../ui/Skeleton";
import { AttentionTable } from "./AttentionTable";
import { EventsSection } from "./EventsSection";
import { FleetStatusStrip } from "./FleetStatusStrip";
import { OperationalArea } from "./OperationalArea";
import { TelemetrySection } from "./TelemetrySection";
import type { BoardRow, ChartRange } from "./types";
import { isRunning, isStopped, pickPrimary } from "./logic";

export function CommandBoard({
  organizationId,
  siteId,
  siteName,
  permissions,
}: {
  organizationId: string;
  siteId: Id<"sites"> | null;
  siteName: string;
  permissions: readonly string[];
}) {
  const orgId = organizationId as Id<"organizations">;
  const siteData = useQuery(
    api.telemetry.currentForSite,
    siteId ? { organizationId: orgId, siteId } : "skip",
  );
  const orgData = useQuery(
    api.telemetry.currentForOrg,
    siteId ? "skip" : { organizationId: orgId },
  );
  const siteSummary = useQuery(
    api.telemetry.siteSummary,
    siteId ? { organizationId: orgId, siteId } : "skip",
  );
  const fleetSummary = useQuery(
    api.telemetry.fleetSummary,
    siteId ? "skip" : { organizationId: orgId },
  );
  const alarms = useQuery(
    api.alarms.forSite,
    siteId && permissions.includes("view.alarms")
      ? { organizationId: orgId, siteId }
      : "skip",
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [range, setRange] = useState<ChartRange>("day");

  const loading =
    (siteId ? siteData === undefined || siteSummary === undefined : orgData === undefined || fleetSummary === undefined);

  const loaded = useMemo(() => {
    const raw = siteId ? siteData?.rows : orgData?.rows;
    return (Array.isArray(raw) ? raw : []) as BoardRow[];
  }, [siteId, siteData, orgData]);

  const primary = useMemo(() => pickPrimary(loaded, selectedId), [loaded, selectedId]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  const capped = Boolean(siteId ? siteData?.capped : orgData?.capped);
  const scope = snapshotScope(loaded, capped);
  const freshness = pageFreshness(loaded, Date.now());
  const running = loaded.filter(isRunning).length;
  const stopped = loaded.filter(isStopped).length;

  const alarmRows = Array.isArray(alarms?.rows) ? alarms.rows : [];
  const activeAlarms = alarmRows.filter(
    (row: { state?: string }) => row.state === "active" || row.state === "acknowledged",
  ).length;

  const siteReady = siteSummary?.ready === true;
  const fleetReady = fleetSummary?.ready === true;

  const strip = siteId
    ? {
        sites: 1,
        generators: siteReady && siteSummary.generators !== null ? siteSummary.generators : scope.generators,
        running,
        stopped,
        alarms: permissions.includes("view.alarms") ? activeAlarms : null,
        offlineGateways: siteReady ? (siteSummary.gatewayOffline ?? 0) : null,
        gatewayOnline: siteReady ? (siteSummary.gatewayOnline ?? 0) > 0 : null,
        tone:
          (siteSummary?.overallUnhealthy ?? 0) > 0 || (siteSummary?.linkFail ?? 0) > 0
            ? ("alarm" as const)
            : (siteSummary?.gatewayOffline ?? 0) > 0 || freshness.stale > 0
              ? ("warn" as const)
              : siteReady
                ? ("ok" as const)
                : ("offline" as const),
        subtitle:
          (siteSummary?.overallUnhealthy ?? 0) > 0 || (siteSummary?.linkFail ?? 0) > 0
            ? "Attention required"
            : (siteSummary?.gatewayOffline ?? 0) > 0 || freshness.stale > 0
              ? "Degraded"
              : siteReady
                ? "Operational"
                : "Unavailable",
      }
    : {
        sites: fleetSummary?.sites ?? 0,
        generators: fleetReady ? fleetSummary!.generators : scope.generators,
        running,
        stopped,
        alarms: null,
        offlineGateways: fleetReady ? fleetSummary!.gatewayOffline : null,
        gatewayOnline: fleetReady ? fleetSummary!.gatewayOnline > 0 : null,
        tone:
          (fleetSummary?.overallUnhealthy ?? 0) > 0 || (fleetSummary?.linkFail ?? 0) > 0
            ? ("alarm" as const)
            : (fleetSummary?.gatewayOffline ?? 0) > 0 || freshness.stale > 0
              ? ("warn" as const)
              : fleetReady
                ? ("ok" as const)
                : ("offline" as const),
        subtitle:
          (fleetSummary?.overallUnhealthy ?? 0) > 0 || (fleetSummary?.linkFail ?? 0) > 0
            ? "Attention required"
            : (fleetSummary?.gatewayOffline ?? 0) > 0 || freshness.stale > 0
              ? "Degraded"
              : fleetReady
                ? "Fleet overview"
                : "Unavailable",
      };

  return (
    <div className="cc-layout">
      <FleetStatusStrip
        title={siteName}
        subtitle={strip.subtitle}
        sites={strip.sites}
        generators={strip.generators}
        running={strip.running}
        stopped={strip.stopped}
        alarms={strip.alarms}
        offlineGateways={strip.offlineGateways}
        tone={strip.tone}
      />

      {loaded.length === 0 ? (
        <EmptyState
          title="No generators"
          body="Register a gateway and generator for this organization."
          action={<Link to="/generators">Generators</Link>}
        />
      ) : scope.reporting === 0 ? (
        <div className="notice" role="note">
          <strong>No telemetry yet.</strong>
        </div>
      ) : null}

      <OperationalArea
        rows={loaded}
        primary={primary}
        siteName={siteName}
        gatewayOnline={strip.gatewayOnline}
        onSelect={setSelectedId}
      />

      <AttentionTable
        rows={loaded}
        showSite={!siteId}
        selectedId={primary?.generatorId ?? null}
        onSelect={setSelectedId}
      />

      {permissions.includes("view.telemetry") ? (
        <TelemetrySection primary={primary} range={range} onRange={setRange} />
      ) : null}

      <EventsSection
        organizationId={organizationId}
        siteId={siteId}
        permissions={permissions}
      />
    </div>
  );
}
