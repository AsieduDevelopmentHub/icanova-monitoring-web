import type { LiveRow } from "../../telemetry/fleetView";

export type BoardRow = LiveRow & {
  generatorId: string;
  name: string;
  siteId?: string;
  siteName?: string;
  powerKw: number | null;
  powerQuality: string;
  batteryV?: number | null;
  batteryQuality?: string;
  frequencyHz?: number | null;
  frequencyQuality?: string;
  voltageL1?: number | null;
  voltageQuality?: string;
};

export type ChartRange = "hour" | "six" | "day" | "week";

export const CHART_RANGE_LABEL: Record<ChartRange, string> = {
  hour: "1h",
  six: "6h",
  day: "24h",
  week: "7d",
};
