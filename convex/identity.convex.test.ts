import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.modules";

/**
 * Mocked identity tests (convex-test withIdentity) — not a live Convex Auth Password proof.
 */

function person(name: string, email?: string) {
  return {
    subject: name,
    issuer: "https://issuer.test",
    tokenIdentifier: `https://issuer.test|${name}`,
    email,
  };
}

describe("identity email-rebind (mocked)", () => {
  test("ensureUser rebinds tokenIdentifier when email matches a legacy user", async () => {
    const t = convexTest(schema, modules);
    const asLegacy = t.withIdentity(person("auth0-sub", "ops@example.com"));
    const orgId = await asLegacy.mutation(api.organizations.create, { name: "Fleet" });
    const legacyUser = await asLegacy.query(api.users.me, {});
    expect(legacyUser?.email).toBe("ops@example.com");

    const asConvexAuth = t.withIdentity({
      subject: "convex-auth-user",
      issuer: "https://convex.site",
      tokenIdentifier: "https://convex.site|convex-auth-user",
      email: "ops@example.com",
    });
    const reboundId = await asConvexAuth.mutation(api.users.ensure, {});
    expect(reboundId).toBe(legacyUser?._id);

    const orgs = await asConvexAuth.query(api.organizations.mine, {});
    expect(orgs.map((row) => row.organizationId)).toContain(orgId);
  });

  test("ensureUser does not create a second user for the same email", async () => {
    const t = convexTest(schema, modules);
    await t.withIdentity(person("a", "same@example.com")).mutation(api.users.ensure, {});
    await t
      .withIdentity({
        subject: "b",
        issuer: "https://issuer.test",
        tokenIdentifier: "https://issuer.test|b",
        email: "same@example.com",
      })
      .mutation(api.users.ensure, {});

    const rows = await t.run(async (ctx) => {
      return await ctx.db.query("users").collect();
    });
    const withEmail = rows.filter((row) => row.email === "same@example.com");
    expect(withEmail).toHaveLength(1);
  });

  test("unauthenticated me returns null", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.users.me, {})).toBeNull();
  });
});
