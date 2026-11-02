import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { ROLE_PRESETS } from "./rolePresets";
import type { SiteCodeFormat } from "./siteCodes";

/** Insert org + seeded Admin / Sub-admin / Operator / Viewer roles. Returns Admin role id. */
export async function insertOrganizationWithRoles(
  ctx: MutationCtx,
  args: { name: string; siteCodeFormat?: SiteCodeFormat },
): Promise<{ organizationId: Id<"organizations">; adminRoleId: Id<"roles"> }> {
  const organizationId = await ctx.db.insert("organizations", {
    name: args.name,
    createdAt: Date.now(),
    siteCodeFormat: args.siteCodeFormat ?? "text",
  });
  let adminRoleId: Id<"roles"> | null = null;
  for (const preset of ROLE_PRESETS) {
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: preset.name,
      permissions: [...preset.permissions],
    });
    if (preset.name === "Admin") {
      adminRoleId = roleId;
    }
  }
  if (!adminRoleId) {
    throw new Error("Admin role seed failed");
  }
  return { organizationId, adminRoleId };
}
