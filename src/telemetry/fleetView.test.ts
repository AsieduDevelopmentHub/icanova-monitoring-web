import { describe, expect, test } from "vitest";
import { formatReading } from "./readings";
import { storedReading } from "../fleet/access";
import { DEMO_GENERATOR_ID } from "./logModel";
import { NAV } from "../shell/nav";
import { sessionView } from "../fleet/session";
import { authProviderReady } from "../../convex/productionConfig";
import {
  auditActor,
  engineView,
  linkView,
  registrationLabel,
  snapshotScope,
} from "./fleetView";

describe("fleet snapshot", () => {
  test("a registered generator with no telemetry is unknown and unreported", () => {
    const row = {
      updatedAt: null,
      link: null,
      rpm: null,
      rpmQuality: "unavailable",
      alarmCount: null,
    };
    expect(linkView(row.link).label).toBe("Unknown");
    expect(engineView(row.rpm, row.rpmQuality).label).toBe("Unreported");
    expect(snapshotScope([row], false)).toMatchObject({
      generators: 1,
      reporting: 0,
      online: 0,
      unknown: 1,
      capped: false,
    });
  });

  test("a measured reading stays distinct from a failed Modbus link", () => {
    expect(linkView("ok")).toMatchObject({ label: "Modbus ok", tone: "ok" });
    expect(linkView("degraded").label).toBe("Modbus degraded");
    expect(linkView("fail").label).toBe("Modbus fail");
    expect(linkView("unknown").label).toBe("Unknown");
    expect(engineView(1500, "measured").label).toBe("Running");
    expect(engineView(0, "measured").label).toBe("Stopped");
    expect(engineView(null, "unavailable").label).toBe("Unreported");
    expect(engineView(0, "unavailable").label).toBe("Unreported");
  });

  test("a Modbus fail and a stopped engine are separate", () => {
    expect(linkView("fail").label).toBe("Modbus fail");
    expect(engineView(0, "measured").label).toBe("Stopped");
    expect(engineView(null, "unavailable").label).not.toBe("Stopped");
  });

  test("unavailable power is not zero and a negative measurement is kept", () => {
    expect(formatReading(storedReading(null, "unavailable", "kW"))).toBe("unavailable");
    expect(formatReading(storedReading(-0.45, "measured", "kW"))).toBe("-0.45 kW");
    expect(formatReading(storedReading(-0.98, "measured", "PF"))).toBe("-0.98 PF");
    expect(formatReading(storedReading(null, "unavailable", "rpm"))).not.toBe("0 rpm");
    expect(formatReading(storedReading(null, "unavailable", "V"))).not.toBe("0 V");
  });

  test("a capped site snapshot is not described as an organization total", () => {
    const scope = snapshotScope([], true);
    expect(scope.note).toContain("Not an organization total");
    expect(scope.generators).toBe(0);
  });

  test("registration text refuses a partial page as a complete count", () => {
    expect(registrationLabel(2, true)).toBe("2 registered on this site.");
    expect(registrationLabel(50, false)).toContain("not a complete count");
  });
});

describe("audit display", () => {
  test("the actor subject is shown and the token identifier is not", () => {
    expect(auditActor("unknown")).toBe("Not recorded");
    expect(auditActor("https://issuer.test|owner")).toBe("owner");
    expect(auditActor("https://issuer.test|owner")).not.toContain("https://");
    expect(auditActor("raw-token")).toBe("Recorded");
    expect(auditActor("ingest")).toBe("Ingest");
  });
});

describe("session and auth readiness", () => {
  test("a stored token with no user record does not open organization data", () => {
    expect(sessionView(false, undefined)).toBe("signed-out");
    expect(sessionView(true, undefined)).toBe("loading");
    expect(sessionView(true, null)).toBe("rejected");
    expect(sessionView(true, { _id: "user" })).toBe("open");
    expect(sessionView(false, { _id: "user" })).toBe("signed-out");
  });

  test("placeholder issuer values do not enable a provider", () => {
    expect(authProviderReady("disabled", "disabled")).toBe(false);
    expect(authProviderReady(undefined, "https://login.auth0.com/.well-known/jwks.json")).toBe(false);
    expect(authProviderReady("https://login.auth0.com/", undefined)).toBe(false);
    expect(authProviderReady("https://issuer.example", "https://issuer.example/jwks")).toBe(false);
    expect(
      authProviderReady(
        " https://login.auth0.com/ ",
        " https://login.auth0.com/.well-known/jwks.json ",
      ),
    ).toBe(true);
  });
});
describe("routes", () => {
  test("sites and events are no longer placeholders and the demo id remains", () => {
    expect(NAV.find((item) => item.to === "/sites")?.unavailable).toBeUndefined();
    expect(NAV.find((item) => item.to === "/events")?.unavailable).toBeUndefined();
    expect(DEMO_GENERATOR_ID).toBe("log-7320");
  });
});
