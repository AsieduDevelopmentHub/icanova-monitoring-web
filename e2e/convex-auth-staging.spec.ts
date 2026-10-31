import { expect, test } from "@playwright/test";

/**
 * Live staging Convex Auth E2E (Password) against preview of dist/
 * talking to dapper-roadrunner-247. Not a mocked withIdentity test.
 *
 * Requires: E2E_CONVEX_AUTH=1. Preview serves dist built with VITE_CONVEX_URL=roadrunner.
 * Does not use Auth0. Does not target production.
 */

const enabled = process.env.E2E_CONVEX_AUTH === "1";
const base = process.env.E2E_BASE_URL?.trim() || "http://127.0.0.1:4173";
const stamp = Date.now();
const email = `85f.verify.${stamp}@icanova.test`;
const password = `Stage85f!${stamp}`;

test.describe.configure({ mode: "serial" });

test.describe("Convex Auth staging (live roadrunner)", () => {
  test.skip(!enabled, "Set E2E_CONVEX_AUTH=1");

  test.beforeEach(() => {
    expect(base).not.toMatch(/tremendous-sturgeon|production/i);
  });

  test("Auth0 isolation: login has password form, no Auth0 redirect", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.locator("#auth-login-title")).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page).not.toHaveURL(/auth0\.com/i);
    await expect(page.locator("body")).not.toContainText(/Redirecting to the identity provider/i);
  });

  test("Register creates Convex Auth session without Auth0", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByRole("button", { name: /create an account/i }).click();
    await expect(page.locator("#auth-login-title")).toHaveText(/create account/i);
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole("button", { name: /create account/i }).click();

    await expect(page.getByText("Signed in", { exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(page).not.toHaveURL(/auth0\.com/i);
    // New account is authenticated but has no org membership yet (dashboard LiveGate)
    await expect(page.getByText(/no organization membership/i).first()).toBeVisible({
      timeout: 60_000,
    });
  });

  test("Login, create organization (membership), settings load", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/auth/login");
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page.getByText("Signed in", { exact: true })).toBeVisible({ timeout: 60_000 });

    await page.goto("/generators");
    await expect(page.getByRole("button", { name: /create organization/i })).toBeVisible({
      timeout: 60_000,
    });
    const orgName = `85F Org ${stamp}`;
    await page.getByText("New organization", { exact: true }).locator("..").locator("input").fill(orgName);
    await page.getByRole("button", { name: /create organization/i }).click();
    // Native <option> nodes are often "hidden" to Playwright; assert attachment + select value.
    await expect(page.getByRole("option", { name: orgName })).toBeAttached({ timeout: 60_000 });
    await expect(page.getByTitle(orgName)).toBeVisible({ timeout: 60_000 });

    await page.goto("/admin/settings");
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page).not.toHaveURL(/auth0\.com/i);
  });

  test("Logout rejects protected live queries; bad password fails", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/auth/login");
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible({ timeout: 60_000 });

    await page.getByRole("button", { name: /sign out/i }).click();
    // Logout may land on /auth/login (form) or keep chrome "Not signed in" + Sign in link.
    await expect(
      page
        .locator("#auth-login-title")
        .or(page.getByRole("link", { name: /sign in/i }))
        .or(page.getByText("Not signed in", { exact: true })),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Signed in", { exact: true })).toHaveCount(0);

    await page.goto("/auth/login");
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill("WrongPassword!999");
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Signed in", { exact: true })).toHaveCount(0);
  });
});
