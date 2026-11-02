import { ConvexError } from "convex/values";

export type SiteCodeFormat = "numeric" | "text";

export function normalizeSiteCodeFormat(value: string | undefined | null): SiteCodeFormat {
  return value === "numeric" ? "numeric" : "text";
}

/** Validate and normalize a human site code for the org format. */
export function requireSiteCode(raw: string, format: SiteCodeFormat): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new ConvexError("Site code is required.");
  }
  if (format === "numeric") {
    if (!/^[0-9]+$/.test(trimmed)) {
      throw new ConvexError("Site code must be digits only for this organization.");
    }
    return trimmed;
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/.test(trimmed)) {
    throw new ConvexError(
      "Site code must be 1–32 characters: letters, numbers, dots, underscores, or hyphens.",
    );
  }
  return trimmed;
}

/** Derive a backfill code from a site name. */
export function codeFromName(name: string, format: SiteCodeFormat, fallbackIndex: number): string {
  if (format === "numeric") {
    return String(fallbackIndex);
  }
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return slug.length > 0 ? slug : `site-${fallbackIndex}`;
}
