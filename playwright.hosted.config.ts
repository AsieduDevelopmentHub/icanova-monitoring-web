import { defineConfig, devices } from "@playwright/test";

/**
 * Hosted staging E2E against Cloudflare Pages (no local vite preview).
 * Usage: E2E_CONVEX_AUTH=1 E2E_BASE_URL=https://icanova.pages.dev pnpm exec playwright test --config=playwright.hosted.config.ts e2e/convex-auth-staging.spec.ts
 */
const baseURL = process.env.E2E_BASE_URL?.trim() || "https://icanova.pages.dev";

function assertNonProductionBase(url: string) {
  const lower = url.toLowerCase();
  if (lower.includes("tremendous-sturgeon") || lower.includes("production.")) {
    throw new Error("E2E_BASE_URL refuses production Convex / production hosts");
  }
}

assertNonProductionBase(baseURL);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  timeout: 90_000,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
