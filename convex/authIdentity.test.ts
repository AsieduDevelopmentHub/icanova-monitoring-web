import { describe, expect, test } from "vitest";
import { ConvexError } from "convex/values";
import {
  assertSignupAllowed,
  isSignupEnabled,
  looksLikeEmail,
  normalizeEmail,
  normalizeUsername,
} from "./authIdentity";

describe("isSignupEnabled / assertSignupAllowed", () => {
  test("defaults to enabled when unset", () => {
    expect(isSignupEnabled({} as NodeJS.ProcessEnv)).toBe(true);
  });

  test("disables on 0 / false / off / no", () => {
    expect(isSignupEnabled({ AUTH_SIGNUP_ENABLED: "0" } as NodeJS.ProcessEnv)).toBe(false);
    expect(isSignupEnabled({ AUTH_SIGNUP_ENABLED: "false" } as NodeJS.ProcessEnv)).toBe(false);
    expect(isSignupEnabled({ AUTH_SIGNUP_ENABLED: "OFF" } as NodeJS.ProcessEnv)).toBe(false);
    expect(isSignupEnabled({ AUTH_SIGNUP_ENABLED: "no" } as NodeJS.ProcessEnv)).toBe(false);
  });

  test("assertSignupAllowed throws when disabled", () => {
    expect(() => assertSignupAllowed({ AUTH_SIGNUP_ENABLED: "0" } as NodeJS.ProcessEnv)).toThrow(
      ConvexError,
    );
  });
});

describe("normalizeUsername", () => {
  test("lowercases and accepts valid names", () => {
    expect(normalizeUsername("Ops.User_1")).toBe("ops.user_1");
  });

  test("returns null for empty", () => {
    expect(normalizeUsername("  ")).toBeNull();
  });

  test("rejects invalid charset or length", () => {
    expect(() => normalizeUsername("ab")).toThrow(ConvexError);
    expect(() => normalizeUsername("bad name")).toThrow(ConvexError);
  });
});

describe("normalizeEmail / looksLikeEmail", () => {
  test("normalizes email", () => {
    expect(normalizeEmail(" Ops@Example.COM ")).toBe("ops@example.com");
  });

  test("detects email-shaped identifiers", () => {
    expect(looksLikeEmail("a@b.co")).toBe(true);
    expect(looksLikeEmail("ops.user")).toBe(false);
  });
});
