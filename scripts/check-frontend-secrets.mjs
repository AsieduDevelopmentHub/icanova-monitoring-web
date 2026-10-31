/**
 * Fail if SPA source or dist embeds secret-shaped material.
 * Never prints secret values — only path + rule id.
 *
 *   node scripts/check-frontend-secrets.mjs
 *   node scripts/check-frontend-secrets.mjs --dist
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const checkDist = process.argv.includes("--dist");
const root = process.cwd();

/** Patterns that must never appear in browser-facing bundles / SPA source. */
const RULES = [
  { id: "vite-secret-key-name", re: /\bVITE_[A-Z0-9_]*(?:SECRET|PASSWORD|PRIVATE_KEY|API_KEY|DEPLOY_KEY)\b/ },
  { id: "pem-private", re: /BEGIN (?:RSA )?PRIVATE KEY/ },
  { id: "assigned-ingest-secret", re: /INGEST_SECRET\s*=\s*['"`][^'"`\s]{8,}/ },
  { id: "assigned-resend-key", re: /RESEND_API_KEY\s*=\s*['"`][^'"`\s]{8,}/ },
  { id: "assigned-arkesel-key", re: /ARKESEL_API_KEY\s*=\s*['"`][^'"`\s]{8,}/ },
  { id: "assigned-deploy-key", re: /CONVEX_DEPLOY_KEY\s*=\s*['"`][^'"`\s]{8,}/ },
];

const SKIP_DIR = new Set(["node_modules", ".git", "test-results", "playwright-report", "coverage", "backups", ".jwt"]);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (SKIP_DIR.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|mjs|css|html|map)$/i.test(name)) out.push(p);
  }
  return out;
}

const targets = [...walk(join(root, "src"))];
if (checkDist) {
  if (!existsSync(join(root, "dist"))) {
    console.log("FAIL\tdist-missing\trun pnpm build first");
    process.exit(1);
  }
  targets.push(...walk(join(root, "dist")));
}

let failed = 0;
for (const file of targets) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const rule of RULES) {
    if (!rule.re.test(text)) continue;
    console.log(`FAIL\t${rule.id}\t${relative(root, file)}`);
    failed++;
  }
}

if (!failed) {
  console.log(`PASS\tfrontend-secret-scan\tfiles=${targets.length}${checkDist ? " (incl dist)" : ""}`);
}
process.exitCode = failed ? 1 : 0;
