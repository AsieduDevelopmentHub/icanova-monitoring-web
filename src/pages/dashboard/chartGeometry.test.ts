import { describe, expect, it } from "vitest";
import { arcPath, horseshoeSegments, polar } from "./chartGeometry";

describe("chartGeometry", () => {
  it("polar places east at 0°", () => {
    const [x, y] = polar(0, 0, 10, 0);
    expect(x).toBeCloseTo(10, 5);
    expect(y).toBeCloseTo(0, 5);
  });

  it("arcPath returns a path for a sweep", () => {
    const d = arcPath(60, 60, 40, 30, 330);
    expect(d.startsWith("M ")).toBe(true);
    expect(d.includes(" A ")).toBe(true);
  });

  it("horseshoeSegments proportions segments across the visible sweep", () => {
    const segs = horseshoeSegments(60, 60, 40, [
      { value: 75, color: "orange" },
      { value: 25, color: "gray" },
    ]);
    expect(segs).toHaveLength(2);
    expect(segs[0]?.color).toBe("orange");
    expect(segs[1]?.color).toBe("gray");
  });
});
