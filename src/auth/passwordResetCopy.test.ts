import { describe, expect, test } from "vitest";
import { resetRequestConfirmation } from "./passwordResetCopy";

describe("password reset UX copy", () => {
  test("request confirmation does not claim the account exists", () => {
    const text = resetRequestConfirmation().toLowerCase();
    expect(text).toContain("if an account exists");
    expect(text).not.toMatch(/account not found|unknown email|no user/);
  });
});
