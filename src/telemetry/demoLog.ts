import { DSE_LOG_EXCERPT } from "../fixtures/dseLogExcerpt";
import { parseCommFrames, parseLogSamples, type CommFrame, type LogSample } from "./logModel";

export const demoSamples: LogSample[] = parseLogSamples(DSE_LOG_EXCERPT);
export const demoFrames: CommFrame[] = parseCommFrames(DSE_LOG_EXCERPT);

export function latestSample(): LogSample {
  return demoSamples[demoSamples.length - 1];
}

export function samplesForMode(mode: "live" | "history"): LogSample[] {
  if (mode === "history") {
    return demoSamples;
  }
  const latest = latestSample();
  return latest ? [latest] : [];
}
