import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL?.trim() || "http://127.0.0.1:4173";

function assertNonProductionBase(url: string) {
  const lower = url.toLowerCase();
  if (lower.includes("production") || lower.includes("prod.")) {
    throw new Error("E2E_BASE_URL refuses production hosts");
  }
}

assertNonProductionBase(baseURL);

const previewPort = (() => {
  try {
    return new URL(baseURL).port || "4173";
  } catch {
    return "4173";
  }
})();

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: `pnpm exec vite preview --host 127.0.0.1 --port ${previewPort}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Expect `pnpm build` before `pnpm test:e2e` so preview serves current dist/.
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
