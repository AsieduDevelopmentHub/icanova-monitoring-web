import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { assertPasswordRequirements } from "./passwordPolicy";

describe("assertPasswordRequirements", () => {
  test("accepts 8+ chars with letter and number", () => {
    expect(() => assertPasswordRequirements("Abcdef12")).not.toThrow();
  });

  test("rejects short passwords", () => {
    expect(() => assertPasswordRequirements("Ab1")).toThrow(ConvexError);
  });

  test("rejects missing letter or number", () => {
    expect(() => assertPasswordRequirements("abcdefgh")).toThrow(ConvexError);
    expect(() => assertPasswordRequirements("12345678")).toThrow(ConvexError);
  });
});
