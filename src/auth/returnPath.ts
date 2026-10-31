/** Safe in-app path for post-login redirect. Rejects open redirects. */
export function safeReturnPath(from: unknown, fallback = "/app"): string {
  if (typeof from === "string") {
    if (from.startsWith("/") && !from.startsWith("//") && !from.includes("://")) {
      return from;
    }
    return fallback;
  }
  if (from && typeof from === "object" && "pathname" in from) {
    const loc = from as { pathname?: unknown; search?: unknown };
    if (typeof loc.pathname === "string") {
      const search = typeof loc.search === "string" ? loc.search : "";
      return safeReturnPath(`${loc.pathname}${search}`, fallback);
    }
  }
  return fallback;
}
