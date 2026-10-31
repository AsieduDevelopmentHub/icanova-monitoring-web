import { expect, test } from "@playwright/test";

/**
 * Hosted password-reset UX smoke against staging Pages + roadrunner.
 * Does not assert live email delivery (provider NOT TESTED separately).
 */
const enabled = process.env.E2E_CONVEX_AUTH === "1";
const base = process.env.E2E_BASE_URL?.trim() || "http://127.0.0.1:4173";

test.describe("Password reset staging UX", () => {
  test.skip(!enabled, "Set E2E_CONVEX_AUTH=1");

  test.beforeEach(() => {
    expect(base).not.toMatch(/tremendous-sturgeon|production/i);
  });

  test("login links to reset; request step is anti-enumerating", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.getByRole("link", { name: /forgot password/i })).toBeVisible();
    await page.getByRole("link", { name: /forgot password/i }).click();
    await expect(page).toHaveURL(/\/auth\/reset/);
    await expect(page.locator("#auth-reset-title")).toHaveText(/reset password/i);

    await page.locator('input[name="email"]').fill(`reset.smoke.${Date.now()}@icanova.test`);
    await page.getByRole("button", { name: /send reset code/i }).click();

    await expect(page.getByRole("status")).toContainText(/if an account exists/i, {
      timeout: 60_000,
    });
    await expect(page.locator('input[name="code"]')).toBeVisible();
    await expect(page.locator('input[name="newPassword"]')).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/account not found|unknown email|no user/i);
    await expect(page).not.toHaveURL(/auth0\.com/i);
  });
});
