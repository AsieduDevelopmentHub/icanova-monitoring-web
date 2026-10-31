import { describe, expect, test } from "vitest";
import { formatMeasure } from "./Metric";

describe("design system primitives", () => {
  test("formatMeasure keeps missing values honest", () => {
    expect(formatMeasure(null, 1)).toBe("—");
    expect(formatMeasure(undefined, 1)).toBe("—");
    expect(formatMeasure(12.34, 1)).toBe("12.3");
  });
});
