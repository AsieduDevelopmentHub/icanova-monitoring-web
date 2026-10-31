import { describe, expect, test } from "vitest";
import { alarmSms, deviceRegisteredEmail } from "./notifyTemplates";

describe("notify template branding", () => {
  test("SMS copy uses iCanOva product name", () => {
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
    expect(sms.startsWith("iCanOva ")).toBe(true);
    expect(sms).not.toMatch(/^DSE /);
  });

  test("device registration SMS uses iCanOva", () => {
    const copy = deviceRegisteredEmail("Org", "Site", "GW1", "d1");
    expect(copy.sms.startsWith("iCanOva ")).toBe(true);
  });
});
