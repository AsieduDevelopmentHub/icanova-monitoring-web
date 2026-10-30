import { describe, expect, test } from "vitest";
import { decodeBatch } from "../../convex/ingestDecode";
import { orderBatch } from "../../convex/order";

describe("session ordering", () => {
  test("a later epoch is accepted and an older epoch is not", () => {
    expect(orderBatch(null, { epoch: 1, boot: 9, seq: 1 }).action).toBe("accept");
    expect(orderBatch({ epoch: 2, boot: 9, seq: 4 }, { epoch: 3, boot: 1, seq: 1 })).toMatchObject({
      action: "accept",
      ordered: false,
    });
    expect(orderBatch({ epoch: 3, boot: 1, seq: 2 }, { epoch: 3, boot: 8, seq: 1 }).action).toBe("stale");
    expect(orderBatch({ epoch: 3, boot: 1, seq: 2 }, { epoch: 3, boot: 1, seq: 2 }).action).toBe("duplicate");
    expect(orderBatch({ epoch: 3, boot: 1, seq: 2 }, { epoch: 3, boot: 1, seq: 3 })).toMatchObject({
      action: "accept",
      ordered: true,
    });
  });

  test("a random boot cannot replace another random boot", () => {
    expect(orderBatch({ boot: 7, seq: 4 }, { boot: 99, seq: 1 }).action).toBe("stale");
    expect(orderBatch({ epoch: 4, boot: 7, seq: 1 }, { boot: 99, seq: 9 }).action).toBe("stale");
    expect(orderBatch({ boot: 7, seq: 4 }, { boot: 7, seq: 5 })).toMatchObject({ action: "accept", ordered: true });
  });
});

describe("cloud payload decode", () => {
  test("an old payload stays compatible and a new field is scaled", () => {
    const old = decodeBatch({
      identity: "aabbccddeeff",
      boot: 1,
      seq: 2,
      samples: [{ t: 1, age: 0, link: "fail", alm: 0, mode: null, rpm: null, batt10: null, hz10: null, kw100: -1250, van10: null }],
    });
    expect(old.epoch).toBeUndefined();
    expect(old.samples[0]?.kw100).toBe(-1250);
    expect(old.samples[0]?.extra.voltageL2).toBeNull();
    expect(old.samples[0]?.extraQuality.voltageL2).toBe("unavailable");
    const next = decodeBatch({
      v: 2,
      identity: "aabbccddeeff",
      boot: 1,
      epoch: 4,
      seq: 3,
      samples: [
        {
          t: 1,
          age: 0,
          link: "ok",
          alm: 0,
          mode: 1,
          rpm: 0,
          batt10: null,
          hz10: null,
          kw100: null,
          van10: null,
          vbn10: 4000,
          oil: 0,
          cool: -5,
          pa: -45000,
          pf: 0,
          pfa: -12,
          spare1: 12,
        },
      ],
    });
    expect(next.epoch).toBe(4);
    expect(next.samples[0]?.extra).toMatchObject({
      voltageL2: 400,
      oilPressureKpa: 0,
      coolantC: -5,
      powerL1W: -45000,
      pfTot: 0,
      pfL1: -0.12,
    });
    expect(next.samples[0]?.extraQuality.oilPressureKpa).toBe("measured");
    expect(next.samples[0]?.unmapped).toEqual({ spare1: 12 });
    expect(next.samples[0]?.rpm).toBe(0);
  });

  test("a malformed field and an unknown version are rejected", () => {
    expect(() =>
      decodeBatch({
        identity: "aabbccddeeff",
        boot: 1,
        seq: 1,
        samples: [{ t: 1, age: 0, link: "ok", alm: 0, mode: null, rpm: "1500", batt10: null, hz10: null, kw100: null, van10: null }],
      }),
    ).toThrow(/Invalid sample/);
    expect(() =>
      decodeBatch({ identity: "aabbccddeeff", boot: 1, seq: 1, v: 9, samples: [] }),
    ).toThrow(/Invalid sample/);
  });

  test("zero, negative, above-int16, unavailable, and 32-bit wire values stay distinct", () => {
    const decoded = decodeBatch({
      v: 2,
      identity: "aabbccddeeff",
      boot: 2,
      epoch: 1,
      seq: 1,
      samples: [
        {
          t: 10,
          age: 0,
          link: "ok",
          alm: 0,
          mode: null,
          rpm: 0,
          batt10: null,
          hz10: null,
          kw100: null,
          van10: null,
          oil: 0,
          cool: -12,
          pa: 400000,
          pb: -400000,
          pf: 0,
          pfa: null,
          sa: 32768,
          eng2: 0,
          ctrl: 3,
        },
      ],
    });
    const extra = decoded.samples[0]?.extra;
    const quality = decoded.samples[0]?.extraQuality;
    expect(extra).toMatchObject({
      oilPressureKpa: 0,
      coolantC: -12,
      powerL1W: 400000,
      powerL2W: -400000,
      pfTot: 0,
      pfL1: null,
      apparentL1Va: 32768,
      engineStatusAlt: 0,
      controlStatus: 3,
    });
    expect(quality?.oilPressureKpa).toBe("measured");
    expect(quality?.pfL1).toBe("unavailable");
    expect(quality?.powerL1W).toBe("measured");
    expect(quality?.voltageL2).toBe("unavailable");
    expect(extra?.voltageL2).toBeNull();
  });

  test("a non-finite expanded wire value is rejected", () => {
    expect(() =>
      decodeBatch({
        v: 2,
        identity: "aabbccddeeff",
        boot: 1,
        seq: 1,
        samples: [
          {
            t: 1,
            age: 0,
            link: "ok",
            alm: 0,
            mode: null,
            rpm: null,
            batt10: null,
            hz10: null,
            kw100: null,
            van10: null,
            pa: Number.NaN,
          },
        ],
      }),
    ).toThrow(/Invalid sample/);
  });
});
