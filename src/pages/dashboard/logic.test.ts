import { describe, expect, it } from "vitest";
import { attentionScore, isRunning, pickPrimary, twinFromRows } from "./logic";
import type { BoardRow } from "./types";

function row(partial: Partial<BoardRow> & Pick<BoardRow, "generatorId" | "name">): BoardRow {
  return {
    powerKw: null,
    powerQuality: "unavailable",
    rpm: null,
    rpmQuality: "unavailable",
    link: null,
    updatedAt: Date.now(),
    alarmCount: 0,
    ...partial,
  } as BoardRow;
}

describe("dashboard logic", () => {
  it("ranks attention by alarms and link faults", () => {
    const quiet = row({ generatorId: "a", name: "A", rpm: 0, rpmQuality: "measured" });
    const loud = row({
      generatorId: "b",
      name: "B",
      alarmCount: 3,
      link: "fail",
      rpm: 1500,
      rpmQuality: "measured",
    });
    expect(attentionScore(loud)).toBeGreaterThan(attentionScore(quiet));
  });

  it("picks selected primary when present", () => {
    const rows = [
      row({ generatorId: "a", name: "A" }),
      row({ generatorId: "b", name: "B", rpm: 1500, rpmQuality: "measured" }),
    ];
    expect(pickPrimary(rows, "a")?.generatorId).toBe("a");
    expect(isRunning(rows[1]!)).toBe(true);
  });

  it("derives twin status from fleet rows", () => {
    expect(twinFromRows([])).toBe("unknown");
    expect(
      twinFromRows([row({ generatorId: "a", name: "A", rpm: 1500, rpmQuality: "measured" })]),
    ).toBe("running");
  });
});
