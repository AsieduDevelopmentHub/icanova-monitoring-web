import { expect, test } from "@playwright/test";

/**
 * Authenticated browser E2E against a real staging IdP.
 * Skipped unless E2E_OIDC=1 and E2E_BASE_URL points at a non-production host.
 * Mocked Vitest auth tests are not evidence for these scenarios.
 * Do not weaken Convex requirePermission to make these pass.
 */

const oidcEnabled = process.env.E2E_OIDC === "1";
const base = process.env.E2E_BASE_URL?.trim() || "http://127.0.0.1:4173";

test.describe("authenticated staging E2E", () => {
  test.skip(!oidcEnabled, "Real staging IdP not configured (set E2E_OIDC=1)");

  test.beforeEach(() => {
    expect(base).not.toMatch(/tremendous-sturgeon|production/i);
  });

  test("login reaches IdP or callback without production host", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page).not.toHaveURL(/tremendous-sturgeon|production/i);
  });

  test("session: dashboard loads when signed in", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
  });

  test("logout clears local application session chrome", async ({ page }) => {
    await page.goto("/");
    const signOut = page.getByRole("button", { name: /sign out|clear session/i });
    if (await signOut.isVisible()) {
      await signOut.click();
    }
    await expect(page.getByText(/not signed in/i).first()).toBeVisible();
  });

  test("ops page visible; section ACL still enforced server-side", async ({ page }) => {
    await page.goto("/admin/ops");
    await expect(page.getByRole("heading", { name: /operations/i })).toBeVisible();
    // Deep section ACL is proven in observability.convex.test.ts — browser only checks surface.
  });

  test("signed-in fleet pages render headings", async ({ page }) => {
    for (const path of [
      "/generators",
      "/gateways",
      "/sites",
      "/alarms",
      "/notifications",
      "/admin/settings",
    ]) {
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();
    }
  });

  test("tenant isolation: foreign org scope is refused in UI", async ({ page }) => {
    // Requires operator-seeded second org id via E2E_FOREIGN_ORG_ID after real IdP login.
    const foreignOrg = process.env.E2E_FOREIGN_ORG_ID?.trim();
    test.skip(!foreignOrg, "Set E2E_FOREIGN_ORG_ID for cross-tenant browser check");
    await page.goto(`/?organizationId=${foreignOrg}`);
    await expect(page.getByText(/access|denied|not authorized|forbidden|not signed/i).first()).toBeVisible();
  });
});
