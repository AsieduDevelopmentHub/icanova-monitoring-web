/**
 * Staging password-reset email setup helper (roadrunner only).
 *
 * 1. Confirms Resend env on staging (names / from-domain only — never prints secrets).
 * 2. Ensures a Convex Auth Password account for TEST_NOTIFY_EMAIL.
 * 3. Requests a reset code (triggers Resend).
 * 4. Optionally completes reset if RESET_OTP + RESET_NEW_PASSWORD are set.
 *
 * Usage:
 *   node scripts/staging-password-reset-setup.mjs
 *   RESET_OTP=12345678 RESET_NEW_PASSWORD='NewPass1!' node scripts/staging-password-reset-setup.mjs
 *
 * Requires: .env.staging.local with VITE_CONVEX_URL + TEST_NOTIFY_EMAIL
 * Does not target production / sturgeon.
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { chromium } from "@playwright/test";

const ROOT = new URL("../", import.meta.url);
const STAGING_HOST = "dapper-roadrunner-247.convex.cloud";
const BASE = process.env.E2E_BASE_URL?.trim() || "https://icanova.pages.dev";

function loadEnvFile(path) {
  const map = {};
  if (!existsSync(path)) return map;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    map[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return map;
}

function convexGet(name) {
  const r = spawnSync(
    "npx",
    ["convex", "env", "get", name, "--deployment", "staging"],
    { encoding: "utf8", shell: true, cwd: process.cwd() },
  );
  return (r.stdout || "").trim();
}

function domainOf(addr) {
  const email = (addr.match(/<([^>]+)>/)?.[1] || addr).trim().toLowerCase();
  return email.includes("@") ? email.split("@")[1] : "";
}

const fileEnv = {
  ...loadEnvFile(new URL(".env.staging.local", ROOT)),
  ...loadEnvFile(new URL(".env.local", ROOT)),
};

const convexUrl = (process.env.VITE_CONVEX_URL || fileEnv.VITE_CONVEX_URL || "").trim();
const mailbox = (process.env.TEST_NOTIFY_EMAIL || fileEnv.TEST_NOTIFY_EMAIL || "").trim().toLowerCase();
const otp = (process.env.RESET_OTP || "").trim();
const newPassword = (process.env.RESET_NEW_PASSWORD || "").trim();
const bootstrapPassword =
  (process.env.RESET_BOOTSTRAP_PASSWORD || "").trim() || `Bootstrap1!${Date.now().toString().slice(-6)}`;

if (!convexUrl.includes(STAGING_HOST)) {
  console.error(`FAIL\trefusing non-staging Convex URL host (need ${STAGING_HOST})`);
  process.exit(1);
}
if (BASE.match(/tremendous-sturgeon|production\./i)) {
  console.error("FAIL\trefusing production base URL");
  process.exit(1);
}
if (!mailbox || !mailbox.includes("@")) {
  console.error("FAIL\tTEST_NOTIFY_EMAIL missing (set in .env.staging.local)");
  process.exit(1);
}

const resendKey = convexGet("RESEND_API_KEY");
const resendFrom = convexGet("RESEND_FROM");
const authFrom = convexGet("AUTH_EMAIL_FROM");
const resetDev = convexGet("AUTH_PASSWORD_RESET_DEV");

console.log("profile=staging");
console.log(`pages=${BASE}`);
console.log(`mailbox_domain=${domainOf(mailbox)}`);
console.log(`RESEND_API_KEY_set=${Boolean(resendKey)}`);
console.log(`RESEND_FROM_domain=${domainOf(resendFrom) || "(unset)"}`);
console.log(`AUTH_EMAIL_FROM_domain=${domainOf(authFrom) || "(unset — falls back to RESEND_FROM)"}`);
console.log(`AUTH_PASSWORD_RESET_DEV=${resetDev || "(unset)"}`);

if (!resendKey) {
  console.error("FAIL\tRESEND_API_KEY missing on staging — set via convex env set");
  process.exit(1);
}
if (!resendFrom && !authFrom) {
  console.error("FAIL\tno from-address (RESEND_FROM or AUTH_EMAIL_FROM)");
  process.exit(1);
}
if (resetDev === "1") {
  console.warn("WARN\tAUTH_PASSWORD_RESET_DEV=1 — live Resend may be skipped; unset for real mail");
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const stamp = Date.now();

try {
  // Ensure account exists (sign-up is idempotent enough: if exists, sign-in).
  await page.goto(`${BASE}/auth/login`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /sign up/i }).click();
  const localPart = mailbox.split("@")[0].replace(/[^a-z0-9._-]/gi, "").slice(0, 24) || "resetuser";
  const uname = `${localPart}${String(stamp).slice(-6)}`.toLowerCase().slice(0, 32);
  await page.locator('input[name="username"]').fill(uname);
  await page.locator('input[name="email"]').fill(mailbox);
  await page.locator('input[name="password"]').fill(bootstrapPassword);
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForTimeout(4000);
  const signedIn = await page.getByText("Signed in", { exact: true }).isVisible().catch(() => false);
  if (signedIn) {
    console.log("account=created_or_session");
    // Sign out so reset page is usable
    const logout = page.getByRole("button", { name: /sign out|log out/i });
    if (await logout.isVisible().catch(() => false)) {
      await logout.click();
      await page.waitForTimeout(1500);
    } else {
      await page.goto(`${BASE}/auth/login`);
    }
  } else {
    // Account may already exist — try sign-in with bootstrap (may fail); continue to reset anyway.
    console.log("account=may_already_exist");
    await page.goto(`${BASE}/auth/login`);
    await page.locator('input[name="email"]').fill(mailbox);
    await page.locator('input[name="password"]').fill(bootstrapPassword);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await page.waitForTimeout(3000);
    if (await page.getByText("Signed in", { exact: true }).isVisible().catch(() => false)) {
      console.log("account=signed_in_existing");
      const logout = page.getByRole("button", { name: /sign out|log out/i });
      if (await logout.isVisible().catch(() => false)) await logout.click();
    } else {
      console.log("account=exists_or_unknown (continuing to reset request)");
    }
  }

  await page.goto(`${BASE}/auth/reset`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').fill(mailbox);
  await page.getByRole("button", { name: /send reset code/i }).click();
  await page.getByRole("status").waitFor({ timeout: 60_000 });
  const statusText = (await page.getByRole("status").textContent()) || "";
  if (!/if an account exists/i.test(statusText)) {
    console.error("FAIL\tunexpected reset UI status");
    process.exit(1);
  }
  console.log("reset_request=submitted");
  console.log(
    "ACTION\tCheck the staging mailbox for subject: Reset your iCaNova password",
  );
  console.log(
    "ACTION\tThen re-run with RESET_OTP=<code> RESET_NEW_PASSWORD='AtLeast8a1' to finish verification",
  );

  if (otp && newPassword) {
    await page.locator('input[name="code"]').fill(otp);
    await page.locator('input[name="newPassword"]').fill(newPassword);
    await page.getByRole("button", { name: /update password/i }).click();
    await page.waitForTimeout(5000);
    const ok =
      (await page.getByText("Signed in", { exact: true }).isVisible().catch(() => false)) ||
      page.url().includes("/app");
    if (!ok) {
      // Try login with new password
      await page.goto(`${BASE}/auth/login`);
      await page.locator('input[name="email"]').fill(mailbox);
      await page.locator('input[name="password"]').fill(newPassword);
      await page.getByRole("button", { name: /^sign in$/i }).click();
      await page.getByText("Signed in", { exact: true }).waitFor({ timeout: 60_000 });
    }
    console.log("reset_complete=VERIFIED");
    console.log(`note=otp_used stamp=${stamp}`);
  } else {
    console.log("reset_complete=PENDING_OTP");
  }
} finally {
  await browser.close();
}
