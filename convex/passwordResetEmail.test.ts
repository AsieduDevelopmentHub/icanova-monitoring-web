import { describe, expect, test } from "vitest";
import { resolveResendApiKey, resolveResetFromAddress } from "./passwordResetEmail";

describe("password reset email config (unit)", () => {
  test("prefers AUTH_RESEND_KEY over RESEND_API_KEY", () => {
    expect(
      resolveResendApiKey({
        AUTH_RESEND_KEY: "auth-key",
        RESEND_API_KEY: "shared-key",
      } as NodeJS.ProcessEnv),
    ).toBe("auth-key");
  });

  test("falls back to RESEND_API_KEY", () => {
    expect(
      resolveResendApiKey({
        RESEND_API_KEY: "shared-key",
      } as NodeJS.ProcessEnv),
    ).toBe("shared-key");
  });

  test("returns undefined when no key configured", () => {
    expect(resolveResendApiKey({} as NodeJS.ProcessEnv)).toBeUndefined();
  });

  test("from address prefers AUTH_EMAIL_FROM then RESEND_FROM", () => {
    expect(
      resolveResetFromAddress({
        AUTH_EMAIL_FROM: "A <a@example.com>",
        RESEND_FROM: "B <b@example.com>",
      } as NodeJS.ProcessEnv),
    ).toBe("A <a@example.com>");
    expect(
      resolveResetFromAddress({
        RESEND_FROM: "B <b@example.com>",
      } as NodeJS.ProcessEnv),
    ).toBe("B <b@example.com>");
    expect(resolveResetFromAddress({} as NodeJS.ProcessEnv)).toMatch(/iCanOva/);
  });
});
