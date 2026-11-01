import { Link } from "react-router";
import { StatusStrip, type StripItem } from "../../ui/StatusStrip";

type FleetStripProps = {
  title: string;
  subtitle: string;
  sites: number | null;
  generators: number | null;
  running: number | null;
  stopped: number | null;
  alarms: number | null;
  offlineGateways: number | null;
  tone: "ok" | "warn" | "alarm" | "offline";
};

export function FleetStatusStrip({
  title,
  subtitle,
  sites,
  generators,
  running,
  stopped,
  alarms,
  offlineGateways,
  tone,
}: FleetStripProps) {
  const items: StripItem[] = [
    { label: "Sites", value: sites == null ? "—" : String(sites) },
    { label: "Generators", value: generators == null ? "—" : String(generators) },
    {
      label: "Running",
      value: running == null ? "—" : String(running),
      tone: (running ?? 0) > 0 ? "ok" : "default",
    },
    {
      label: "Stopped",
      value: stopped == null ? "—" : String(stopped),
    },
    {
      label: "Alarms",
      value: alarms == null ? "—" : String(alarms),
      tone: (alarms ?? 0) > 0 ? "alarm" : "ok",
    },
    {
      label: "Offline GW",
      value: offlineGateways == null ? "—" : String(offlineGateways),
      tone: (offlineGateways ?? 0) > 0 ? "warn" : "ok",
    },
  ];

  return (
    <StatusStrip
      title={title}
      subtitle={subtitle}
      items={items}
      trailing={
        <div className="ops-links">
          <span className={`status-strip-pill tone-${tone}`}>{subtitle}</span>
          <Link to="/alarms">Alarms</Link>
          <Link to="/gateways">Gateways</Link>
        </div>
      }
    />
  );
}
