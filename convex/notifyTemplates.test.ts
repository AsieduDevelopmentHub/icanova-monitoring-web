import { describe, expect, test } from "vitest";
import { alarmSms, deviceRegisteredEmail } from "./notifyTemplates";

describe("notify template branding", () => {
  test("SMS copy uses iCaNova product name", () => {
    const sms = alarmSms(
      {
        organizationName: "Org",
        siteName: "Site",
        generatorName: "G1",
        alarmId: "a1",
        summary: "High coolant",
        severity: "warning",
        category: null,
        state: "active",
        firstOccurredAt: 0,
        lastOccurredAt: 0,
        acknowledged: false,
      },
      "alarm.raised",
    );
    expect(sms.startsWith("iCaNova ")).toBe(true);
    expect(sms).not.toMatch(/^DSE /);
  });

  test("device registration SMS uses iCaNova", () => {
    const copy = deviceRegisteredEmail("Org", "Site", "GW1", "d1");
    expect(copy.sms.startsWith("iCaNova ")).toBe(true);
  });
});
