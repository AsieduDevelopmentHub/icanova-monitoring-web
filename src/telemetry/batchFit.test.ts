import { describe, expect, test } from "vitest";
import { applyPost, batchBytes, fitSamples } from "./batchFit";

describe("uplink batch fit", () => {
  test("a batch that fits is sent in one post", () => {
    expect(fitSamples(40, [100, 100, 100, 100], 500)).toEqual({
      action: "fit",
      sent: 4,
      bytes: batchBytes(40, [100, 100, 100, 100], 4),
    });
  });

  test("a batch that requires splitting keeps the remainder", () => {
    const sizes = [200, 200, 200, 200, 200, 200, 200, 200];
    const result = fitSamples(40, sizes, 700);
    expect(result.action).toBe("split");
    if (result.action !== "split") {
      return;
    }
    expect(result.sent).toBeGreaterThan(0);
    expect(result.remain).toBe(sizes.length - result.sent);
    expect(result.bytes).toBeLessThanOrEqual(700);
    expect(batchBytes(40, sizes, result.sent + 1)).toBeGreaterThan(700);
  });

  test("a single oversized sample is reported and not discarded", () => {
    expect(fitSamples(40, [9000], 7168)).toEqual({
      action: "sample_too_large",
      sent: 0,
      remain: 1,
    });
    const after = applyPost({ samples: [9000], seq: 3, last: "idle" }, 40, 7168, "ok");
    expect(after.samples).toEqual([9000]);
    expect(after.seq).toBe(3);
    expect(after.last).toBe("sample too large");
  });

  test("network failure retries the same samples with the same seq", () => {
    const start = { samples: [120, 120, 120, 120], seq: 5, last: "idle" };
    const failed = applyPost(start, 40, 500, "network");
    expect(failed.samples).toEqual(start.samples);
    expect(failed.seq).toBe(5);
    expect(failed.last).toBe("send failed");
  });

  test("a duplicate response still advances past the posted prefix", () => {
    const sizes = [200, 200, 200, 200, 200, 200];
    const after = applyPost({ samples: sizes, seq: 2, last: "idle" }, 40, 700, "duplicate");
    expect(after.seq).toBe(3);
    expect(after.samples.length).toBeLessThan(sizes.length);
    expect(after.samples.length).toBeGreaterThan(0);
  });

  test("remaining samples are sent on the next successful post", () => {
    const sizes = [250, 250, 250, 250, 250, 250, 250, 250];
    let state = { samples: sizes, seq: 1, last: "idle" };
    state = applyPost(state, 40, 800, "ok");
    expect(state.samples.length).toBeGreaterThan(0);
    const firstRemain = state.samples.length;
    state = applyPost(state, 40, 800, "ok");
    expect(state.samples.length).toBeLessThan(firstRemain);
    while (state.samples.length > 0) {
      state = applyPost(state, 40, 800, "ok");
    }
    expect(state.samples).toEqual([]);
    expect(state.seq).toBeGreaterThan(1);
  });
});
