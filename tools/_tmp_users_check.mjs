import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const query = `
const users = await ctx.db.query("users").take(40);
const memberships = await ctx.db.query("memberships").take(40);
return {
  users: users.map((u) => ({
    id: String(u._id),
    email: u.email ?? null,
    username: u.username ?? null,
    name: u.name ?? null,
    token: u.tokenIdentifier ?? null,
  })),
  memberships: memberships.map((m) => ({
    id: String(m._id),
    org: String(m.organizationId),
    user: String(m.userId),
    role: String(m.roleId),
  })),
};
`;

writeFileSync("tools/_tmp_inline_query.js", query);
const r = spawnSync(
  process.execPath,
  ["./node_modules/convex/bin/main.js", "run", "--inline-query", query],
  { encoding: "utf8" },
);
process.stdout.write(r.stdout || "");
process.stderr.write(r.stderr || "");
process.exit(r.status ?? 1);
