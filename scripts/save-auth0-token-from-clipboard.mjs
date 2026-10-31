/**
 * Paste-free helper: reads Auth0 access token from stdin or clipboard file.
 * Usage (PowerShell):
 *   Get-Clipboard | node scripts/save-auth0-token-from-clipboard.mjs
 * Or:
 *   node scripts/save-auth0-token-from-clipboard.mjs < token.txt
 *
 * Saves to .jwt/staging/auth0.access.token (gitignored). Never prints the token.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { stdin } from "node:process";

const chunks = [];
for await (const chunk of stdin) chunks.push(chunk);
const token = Buffer.concat(chunks).toString("utf8").trim().replace(/^"+|"+$/g, "");
if (token.split(".").length !== 3) {
  console.error("save=FAILED need a JWT on stdin");
  process.exit(1);
}
mkdirSync(new URL("../.jwt/staging", import.meta.url), { recursive: true });
writeFileSync(new URL("../.jwt/staging/auth0.access.token", import.meta.url), token, "utf8");
const payload = JSON.parse(
  Buffer.from(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/") + "==", "base64").toString(
    "utf8",
  ),
);
const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
console.log(`save=OK aud=${aud.join(",")} subLen=${String(payload.sub || "").length} exp=${payload.exp}`);
if (!aud.includes("icanova")) {
  console.error("warn=audience is not icanova — Convex staging will reject this token");
  process.exitCode = 2;
}
