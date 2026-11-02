
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
