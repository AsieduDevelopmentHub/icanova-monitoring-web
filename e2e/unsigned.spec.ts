import { expect, test } from "@playwright/test";

/**
 * Browser smoke without IdP. Real authentication scenarios are blocked until
 * operator configures staging OIDC (see docs/status/browser-e2e-report.md).
 */

test.describe("unsigned SPA smoke", () => {
  test("dashboard shows unsigned or offline notice", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
    await expect(page.getByRole("note").filter({ hasText: /not signed in|no deployment url/i })).toBeVisible();
  });

  test("ops requires sign-in or configuration", async ({ page }) => {
    await page.goto("/admin/ops");
    await expect(page.getByRole("heading", { name: /operations/i })).toBeVisible();
    await expect(
      page.locator(".notice, .empty").filter({ hasText: /not signed in|convex is not configured/i }).first(),
    ).toBeVisible();
  });

  test("settings shows unsigned notice when convex URL present without bearer", async ({ page }) => {
    await page.goto("/admin/settings");
    await expect(page.getByRole("heading", { name: /settings/i })).toBeVisible();
  });

  test("demo generators remain labelled fixtures", async ({ page }) => {
    await page.goto("/generators");
    await expect(page.getByRole("heading", { name: /generators/i })).toBeVisible();
  });
});

test.describe("IdP-dependent scenarios", () => {
  test.skip(!process.env.E2E_OIDC || process.env.E2E_OIDC === "0", "Real IdP not configured");

  test("sign-in redirect", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page).not.toHaveURL(/production/i);
  });
});
