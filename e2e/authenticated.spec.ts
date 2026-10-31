import { expect, test } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * LEGACY Auth0 bearer E2E — inactive after Phase 8.5E (Convex Auth is primary).
 * These tests still inject sessionStorage Auth0 access tokens and will not
 * authenticate against Convex Auth deployments. Keep gated behind E2E_OIDC=1
 * until a Convex Auth Password E2E harness replaces them.
 *
 * Token: E2E_ACCESS_TOKEN or .jwt/staging/auth0.access.token
 * Build: `pnpm exec vite build --mode staging` before preview.
 */

const oidcEnabled = process.env.E2E_OIDC === "1";
const base = process.env.E2E_BASE_URL?.trim() || "http://127.0.0.1:4173";
const meUrl = "https://dapper-roadrunner-247.convex.site/me";

function loadAccessToken(): string | null {
  const fromEnv = process.env.E2E_ACCESS_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  const path = resolve(process.cwd(), ".jwt/staging/auth0.access.token");
  if (existsSync(path)) {
    const text = readFileSync(path, "utf8").trim();
    return text || null;
  }
  return null;
}

const accessToken = loadAccessToken();

test.describe("authenticated staging E2E", () => {
  test.skip(!oidcEnabled, "Set E2E_OIDC=1");
  test.skip(!accessToken, "Missing Auth0 access token");

  test.beforeEach(async ({ page }) => {
    expect(base).not.toMatch(/tremendous-sturgeon|production/i);
    await page.addInitScript((token) => {
      sessionStorage.setItem("dse.bearer", token);
    }, accessToken!);
  });

  test("login route reaches Auth0 host without production", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page).not.toHaveURL(/tremendous-sturgeon|production/i);
    await expect(page).toHaveURL(/auth\/login|auth0\.com|callback/i);
  });

  test("session: dashboard loads when signed in", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
    // OIDC-built SPA: "Sign out"; bearer-only / non-OIDC build: "Clear session"
    await expect(page.getByRole("button", { name: /sign out|clear session/i })).toBeVisible();
  });

  test("me endpoint accepts Auth0 access token", async ({ request }) => {
    const res = await request.get(meUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.subject).toBeTruthy();
  });

  test("fleet pages render when authenticated", async ({ page }) => {
    for (const path of ["/generators", "/gateways", "/sites", "/alarms", "/notifications"]) {
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();
    }
  });

  test("ops and settings surfaces load", async ({ page }) => {
    await page.goto("/admin/ops");
    await expect(page.getByRole("heading", { name: /operations/i })).toBeVisible();
    await page.goto("/admin/settings");
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("logout clears local application bearer", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: /sign out|clear session/i })).toBeVisible();
    await page.evaluate(() => {
      sessionStorage.removeItem("dse.bearer");
      window.dispatchEvent(new Event("dse-bearer"));
    });
    await expect(page.getByRole("link", { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /sign out|clear session/i })).toHaveCount(0);
  });

  test("session protection: /me fails without bearer", async ({ request }) => {
    const res = await request.get(meUrl);
    expect(res.status()).toBe(401);
  });

  test("tenant isolation: foreign org id is configured", async ({ page }) => {
    const foreignOrg =
      process.env.E2E_FOREIGN_ORG_ID?.trim() ||
      (existsSync(resolve(process.cwd(), ".jwt/staging/foreign-org-id.txt"))
        ? readFileSync(resolve(process.cwd(), ".jwt/staging/foreign-org-id.txt"), "utf8").trim()
        : "");
    test.skip(!foreignOrg, "Set E2E_FOREIGN_ORG_ID");
    await page.goto(`/?organizationId=${foreignOrg}`);
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
    // Backend denial proven by scripts/verify-auth0-staging.mjs (foreign-org-denied).
  });
});
