import { describe, expect, test } from "vitest";
import {
  clientPasswordIssue,
  extractConvexErrorText,
  sanitizeConvexError,
} from "./convexError";

describe("sanitizeConvexError", () => {
  test("strips Request ID / ConvexError wrappers and maps password rule", () => {
    const err = new Error(
      "[Request ID: 98ed023558844958] Server Error\nUncaught ConvexError: Password must include letters and a number.\nCalled by client",
    );
    expect(sanitizeConvexError(err, "fallback")).toBe(
      "Password must include letters and a number.",
    );
  });

  test("falls back when message is opaque infrastructure noise", () => {
    expect(sanitizeConvexError(new Error("[Request ID: abc] Server Error"), "Could not reset")).toBe(
      "Could not reset",
    );
  });

  test("extractConvexErrorText removes wrappers", () => {
    expect(
      extractConvexErrorText(
        new Error("[Request ID: x] Server Error Uncaught ConvexError: Email is required"),
      ),
    ).toBe("Email is required");
  });
});

describe("clientPasswordIssue", () => {
  test("accepts compliant passwords", () => {
    expect(clientPasswordIssue("Abcdef12")).toBeNull();
  });

  test("rejects missing number or letter", () => {
    expect(clientPasswordIssue("abcdefgh")).toMatch(/letter/i);
    expect(clientPasswordIssue("12345678")).toMatch(/letter/i);
  });
});
