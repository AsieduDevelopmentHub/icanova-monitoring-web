import { useMemo } from "react";
import { Link, useSearchParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { id } from "../fleet/access";
import { LiveGate } from "../fleet/scope";
import { formatStat, seriesStats } from "../telemetry/seriesStats";
import { DataTable } from "../ui/DataTable";
import { EmptyState } from "../ui/EmptyState";
import { FilterBar, FilterSelect } from "../ui/FilterBar";
import { SeriesChart } from "../ui/SeriesChart";
import { PageSkeleton, Skeleton } from "../ui/Skeleton";
import type { BoardRow } from "./dashboard/types";

const RANGES = ["hour", "six", "day", "week"] as const;
type RangeName = (typeof RANGES)[number];

/** Type C — fleet analytics: pick a generator, chart primary series, export path. */
export function Trends() {
  return (
    <section className="page ops-page analytics-page">
      <header className="page-head">
        <h1>Trends</h1>
      </header>
      <LiveGate emptyLayout="list" emptyCaption="Trends" emptyColumns={["Metric", "Latest", "Min", "Max"]}>
        {(org) => <TrendsBody organizationId={org.organizationId} permissions={org.permissions} />}
      </LiveGate>
    </section>
  );
}

function TrendsBody({
  organizationId,
  permissions,
}: {
  organizationId: string;
  permissions: readonly string[];
}) {
  const [params, setParams] = useSearchParams();
  const rangeParam = params.get("range");
  const range: RangeName = RANGES.find((item) => item === rangeParam) ?? "day";
  const selected = params.get("generator") ?? "";

  const data = useQuery(
    api.telemetry.currentForOrg,
    permissions.includes("view.telemetry")
      ? { organizationId: id<"organizations">(organizationId) }
      : "skip",
  );
  const rows = useMemo(() => (Array.isArray(data?.rows) ? (data.rows as BoardRow[]) : []), [data]);

  if (!permissions.includes("view.telemetry")) {
    return <EmptyState title="Telemetry required" body="view.telemetry is needed for trends." />;
  }
  if (data === undefined) {
    return <PageSkeleton rows={6} label="Loading fleet" />;
  }
  if (rows.length === 0) {
    return <EmptyState title="No generators" body="Provision a site with generators to chart trends." />;
  }

  const generatorId =
    rows.find((row) => row.generatorId === selected)?.generatorId ?? rows[0]?.generatorId ?? "";
  const generator = rows.find((row) => row.generatorId === generatorId);

  function setGenerator(value: string) {
    const next = new URLSearchParams(params);
    next.set("generator", value);
    setParams(next);
  }

  function setRange(value: string) {
    const next = new URLSearchParams(params);
    if (value === "day") {
      next.delete("range");
    } else {
      next.set("range", value);
    }
    setParams(next);
  }

  return (
    <div className="stack">
      <FilterBar label="Trend filters">
        <FilterSelect
          label="Generator"
          value={generatorId}
          onChange={setGenerator}
          options={rows.map((row) => ({
            value: row.generatorId,
            label: `${row.name}${row.siteName ? ` · ${row.siteName}` : ""}`,
          }))}
        />
        <FilterSelect
          label="Range"
          value={range}
          onChange={setRange}
          options={[
            { value: "hour", label: "1 hour" },
            { value: "six", label: "6 hours" },
            { value: "day", label: "24 hours" },
            { value: "week", label: "7 days" },
          ]}
        />
      </FilterBar>
      {generator ? (
        <p className="meta">
          <Link to={`/generators/${generator.generatorId}`}>{generator.name}</Link>
          {generator.siteId ? (
            <>
              {" · "}
              <Link to={`/sites/${generator.siteId}`}>{generator.siteName ?? "Site"}</Link>
            </>
          ) : null}
          {" · "}
          <Link to={`/reports`}>Export</Link>
        </p>
      ) : null}
      <TrendCharts generatorId={generatorId} range={range} />
    </div>
  );
}

function TrendCharts({ generatorId, range }: { generatorId: string; range: RangeName }) {
  const series = useQuery(api.telemetry.series, {
    generatorId: id<"generators">(generatorId),
    range,
  });
  const caption =
    range === "hour" ? "1h" : range === "six" ? "6h" : range === "week" ? "7d" : "24h";

  if (series === undefined) {
    return <Skeleton lines={8} />;
  }

  const strip = [
    { label: "Power", unit: "kW", points: series.power },
    { label: "Frequency", unit: "Hz", points: series.frequency },
    { label: "RPM", unit: "rpm", points: series.rpm },
    { label: "Battery", unit: "V", points: series.battery },
    { label: "L1 voltage", unit: "V", points: series.voltage },
  ].map((item) => {
    const stats = seriesStats(item.points);
    return {
      label: item.label,
      unit: item.unit,
      latest: formatStat(stats.latest),
      min: formatStat(stats.min),
      max: formatStat(stats.max),
      average: formatStat(stats.average),
      count: String(stats.count),
    };
  });

  return (
    <div className="stack">
      {series.capped ? <p className="meta">Read limit reached.</p> : null}
      <div className="cc-charts">
        <SeriesChart
          title="Power"
          unit="kW"
          points={series.power}
          reduced={Boolean(series.reduced.power)}
          caption={caption}
          height={260}
        />
        <SeriesChart
          title="Frequency"
          unit="Hz"
          points={series.frequency}
          reduced={Boolean(series.reduced.frequency)}
          caption={caption}
          height={220}
        />
      </div>
      <div className="cc-charts">
        <SeriesChart
          title="RPM"
          unit="rpm"
          points={series.rpm}
          reduced={Boolean(series.reduced.rpm)}
          caption={caption}
          height={200}
        />
        <SeriesChart
          title="Battery"
          unit="V"
          points={series.battery}
          reduced={Boolean(series.reduced.battery)}
          caption={caption}
          height={200}
        />
        <SeriesChart
          title="L1 voltage"
          unit="V"
          points={series.voltage}
          reduced={Boolean(series.reduced.voltage)}
          caption={caption}
          height={200}
        />
      </div>
      <DataTable
        dense
        caption="Measured statistics"
        rows={strip}
        getRowKey={(row) => row.label}
        empty="No measured history in this range."
        columns={[
          { key: "label", header: "Measurement", render: (row) => row.label },
          { key: "unit", header: "Unit", render: (row) => row.unit },
          { key: "latest", header: "Latest", align: "right", render: (row) => row.latest },
          { key: "min", header: "Min", align: "right", render: (row) => row.min },
          { key: "max", header: "Max", align: "right", render: (row) => row.max },
          { key: "average", header: "Avg", align: "right", render: (row) => row.average },
          { key: "count", header: "Readings", align: "right", render: (row) => row.count },
        ]}
      />
    </div>
  );
}
