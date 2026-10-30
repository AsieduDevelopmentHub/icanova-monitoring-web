/**
 * Host-side model of Uplink::fitSamples / postBatch.
 * Firmware builds JSON and shrinks the prefix until it fits the buffer.
 * A single sample that still overflows is reported, not discarded.
 */

export type FitOk = { action: "fit"; sent: number; bytes: number };
export type FitSplit = { action: "split"; sent: number; remain: number; bytes: number };
export type FitOversized = { action: "sample_too_large"; sent: 0; remain: number };
export type FitEmpty = { action: "empty"; sent: 0; remain: 0 };
export type FitResult = FitOk | FitSplit | FitOversized | FitEmpty;

/** Bytes for n samples: envelope + sum of the first n sample sizes + commas between them. */
export function batchBytes(envelope: number, sampleSizes: number[], count: number): number {
  if (count <= 0) {
    return envelope;
  }
  let total = envelope;
  for (let index = 0; index < count; index += 1) {
    total += sampleSizes[index] ?? 0;
    if (index > 0) {
      total += 1;
    }
  }
  return total;
}

export function fitSamples(envelope: number, sampleSizes: number[], cap: number): FitResult {
  const total = sampleSizes.length;
  if (total === 0) {
    return { action: "empty", sent: 0, remain: 0 };
  }
  for (let n = total; n > 0; n -= 1) {
    const bytes = batchBytes(envelope, sampleSizes, n);
    if (bytes <= cap) {
      if (n === total) {
        return { action: "fit", sent: n, bytes };
      }
      return { action: "split", sent: n, remain: total - n, bytes };
    }
  }
  return { action: "sample_too_large", sent: 0, remain: total };
}

export type QueueState = {
  samples: number[];
  seq: number;
  last: string;
};

/** Apply one post attempt. Network failure keeps the queue and the same seq. */
export function applyPost(
  state: QueueState,
  envelope: number,
  cap: number,
  outcome: "ok" | "network" | "duplicate",
): QueueState {
  const fit = fitSamples(envelope, state.samples, cap);
  if (fit.action === "empty") {
    return { ...state, last: "idle" };
  }
  if (fit.action === "sample_too_large") {
    return { ...state, last: "sample too large" };
  }
  if (outcome === "network") {
    return { ...state, last: "send failed" };
  }
  if (outcome === "duplicate") {
    // Same seq accepted as duplicate: clear the prefix that was posted.
    return {
      samples: state.samples.slice(fit.sent),
      seq: state.seq + 1,
      last: "http 200",
    };
  }
  return {
    samples: state.samples.slice(fit.sent),
    seq: state.seq + 1,
    last: "http 200",
  };
}
