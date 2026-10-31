/**
 * Fail if dist/ embeds the wrong Convex cloud host for the intended profile.
 * Never prints full URLs beyond the host fragment.
 *
 *   node scripts/assert-dist-convex-url.mjs staging
 *   node scripts/assert-dist-convex-url.mjs production
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const profile = process.argv[2];
const EXPECTED = {
  staging: {
    must: "dapper-roadrunner-247.convex.cloud",
    forbid: [
      "effervescent-kangaroo-10.convex.cloud",
      "tremendous-sturgeon-449.convex.cloud",
      "vivid-mosquito-28.convex.cloud",
    ],
  },
  production: {
    must: "tremendous-sturgeon-449.convex.cloud",
    forbid: [
      "effervescent-kangaroo-10.convex.cloud",
      "dapper-roadrunner-247.convex.cloud",
      "vivid-mosquito-28.convex.cloud",
    ],
  },
};

if (!profile || !(profile in EXPECTED)) {
  console.error("usage: node scripts/assert-dist-convex-url.mjs <staging|production>");
  process.exit(2);
}

const dist = join(process.cwd(), "dist");
if (!existsSync(dist)) {
  console.log("FAIL\tdist-missing\trun build first");
  process.exit(1);
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(js|html|css|map)$/i.test(name)) out.push(p);
  }
  return out;
}

const files = walk(dist);
const blob = files.map((f) => readFileSync(f, "utf8")).join("\n");
const { must, forbid } = EXPECTED[profile];
let failed = 0;

if (!blob.includes(must)) {
  console.log(`FAIL\tmissing-host\t${profile}\texpected=${must}`);
  failed++;
} else {
  console.log(`PASS\thost\t${profile}\t${must}`);
}

for (const host of forbid) {
  if (blob.includes(host)) {
    console.log(`FAIL\tforbidden-host\t${profile}\t${host}`);
    failed++;
  }
}

if (!failed) {
  console.log(`PASS\tdist-convex-url\tprofile=${profile}\tfiles=${files.length}`);
}
process.exitCode = failed ? 1 : 0;
