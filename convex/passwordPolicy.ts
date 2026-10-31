import { ConvexError } from "convex/values";

/** Shared password rules for sign-up, reset, and authenticated change. */
export function assertPasswordRequirements(password: string): void {
  if (password.length < 8) {
    throw new ConvexError("Password must be at least 8 characters.");
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new ConvexError("Password must include letters and a number.");
  }
}
