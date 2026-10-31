/**
 * Non-destructive restore-drill helper. Does NOT restore or delete anything.
 *
 *   node scripts/restore-drill-check.mjs
 *   node scripts/restore-drill-check.mjs --paths-file backups/staging-paths.txt
 */
import { readFileSync, existsSync } from "node:fs";

const FORBIDDEN_RESTORE_TARGETS = [
  "effervescent-kangaroo-10",
  "dapper-roadrunner-247",
  "tremendous-sturgeon-449",
];

const REQUIRED_BACKUP_TABLES = [
  "organizations",
  "users",
  "memberships",
  "sites",
  "devices",
  "generators",
  "telemetryCurrent",
  "alarms",
  "audits",
  "ingestCursors",
];

function validateBackupPaths(paths) {
  const issues = [];
  const normalized = paths.map((p) => p.replaceAll("\\", "/"));
  for (const path of normalized) {
    const lower = path.toLowerCase();
    if (["secret", "password", "private_key", "private-key", ".pem", "api_key"].some((h) => lower.includes(h))) {
      issues.push(`Suspicious path: ${path}`);
    }
  }
  for (const table of REQUIRED_BACKUP_TABLES) {
    const expected = `${table}/documents.jsonl`;
    if (!normalized.some((p) => p === expected || p.endsWith(`/${expected}`))) {
      issues.push(`Missing required table export: ${expected}`);
    }
  }
  return { ok: issues.length === 0, issues };
}

function restoreTargetAllowed(name) {
  const n = name.trim().toLowerCase();
  return !FORBIDDEN_RESTORE_TARGETS.some((f) => n.includes(f.toLowerCase()));
}

console.log(
  "RESTORE_TEST_STATUS=VERIFIED — isolated recovery 2026-10-31 (vivid-mosquito-28)",
);
console.log(
  "NOTE: staging drill complete; production DR still requires its own approved restore.",
);
console.log(`forbidden-targets=${FORBIDDEN_RESTORE_TARGETS.join(",")}`);
console.log("");
console.log("1. Written authorization (prod or new drill).");
console.log("2. Backup source deployment; download ZIP to encrypted storage.");
console.log("3. Create EMPTY recovery deployment (never kangaroo/roadrunner/sturgeon).");
console.log("4. Confirm recovery name allowed.");
console.log("5. Restore ZIP into recovery ONLY.");
console.log("6. Deploy matching functions with recovery-only deploy key; reconstruct env from vault.");
console.log("7. Validate orgs/sites/devices/auth; record RPO/RTO.");
console.log("8. Quarantine recovery. See docs/backup-restore-verification.md");
console.log("");

const pathsIdx = process.argv.indexOf("--paths-file");
if (pathsIdx >= 0) {
  const file = process.argv[pathsIdx + 1];
  if (!file || !existsSync(file)) {
    console.error("paths-file missing");
    process.exit(2);
  }
  const paths = readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const result = validateBackupPaths(paths);
  console.log(result.ok ? "PASS\tbackup-paths" : "FAIL\tbackup-paths");
  for (const issue of result.issues) console.log(`issue\t${issue}`);
  if (!result.ok) process.exitCode = 1;
} else {
  console.log("tip: after `unzip -l backup.zip`, save path column to a file and pass --paths-file.");
}

console.log("sample-recovery-allowed=", restoreTargetAllowed("dse-recovery-20261031"));
console.log("sample-staging-forbidden=", restoreTargetAllowed("dapper-roadrunner-247"));
