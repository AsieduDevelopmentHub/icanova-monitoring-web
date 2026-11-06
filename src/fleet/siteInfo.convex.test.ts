import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import schema from "../../convex/schema";
import { modules } from "../../convex/test.modules";

function person(name: string) {
  return {
    subject: name,
    issuer: "https://issuer.test",
    tokenIdentifier: `https://issuer.test|${name}`,
    name,
  };
}

const details = {
  zone: "North",
  cluster: "Cluster 1",
  address: "12 Example Road",
  siteType: "Rooftop",
  category: "Telecom",
  energyClassification: "Hybrid",
  coolingClassification: "Free cooling",
  geoClassification: "Urban",
  siteClassification: "Tier 2",
  simDetails: "MTN / 0240000000",
  customerSiteId: "CUST-10",
  fieldEngineer: "Field Engineer",
  engineerContact: "+233240000000",
  communicationMode: "Cellular",
  installationAt: 1_700_000_000_000,
};

async function seed() {
  const t = convexTest(schema, modules);
  const asAdmin = t.withIdentity(person("admin"));
  const asOperator = t.withIdentity(person("operator"));
  const asViewer = t.withIdentity(person("viewer"));
  const asOutsider = t.withIdentity(person("outsider"));
  const organizationId = await asAdmin.mutation(api.organizations.create, { name: "Site Info Org" });
  const otherOrganizationId = await asOutsider.mutation(api.organizations.create, {
    name: "Other Org",
  });
  const siteId = await asAdmin.mutation(api.sites.create, {
    organizationId,
    name: "North Tower",
  });
  const otherSiteId = await asOutsider.mutation(api.sites.create, {
    organizationId: otherOrganizationId,
    name: "South Tower",
  });
  const operatorUserId = await asOperator.mutation(api.users.ensure, {});
  const viewerUserId = await asViewer.mutation(api.users.ensure, {});
  const otherUserId = await asOutsider.mutation(api.users.ensure, {});
  const roles = await asAdmin.query(api.organizations.listRoles, { organizationId });
  const otherRoles = await asOutsider.query(api.organizations.listRoles, {
    organizationId: otherOrganizationId,
  });
  const operatorRole = roles.find((role) => role.name === "Operator");
  const viewerRole = roles.find((role) => role.name === "Viewer");
  const otherOperatorRole = otherRoles.find((role) => role.name === "Operator");
  if (!operatorRole || !viewerRole || !otherOperatorRole) {
    throw new Error("Expected default organization roles");
  }
  await asAdmin.mutation(api.organizations.grant, {
    organizationId,
    userId: operatorUserId,
    roleId: operatorRole.roleId,
  });
  await asAdmin.mutation(api.organizations.grant, {
    organizationId,
    userId: viewerUserId,
    roleId: viewerRole.roleId,
  });
  await asOutsider.mutation(api.organizations.grant, {
    organizationId: otherOrganizationId,
    userId: otherUserId,
    roleId: otherOperatorRole.roleId,
  });
  return {
    asAdmin,
    asViewer,
    organizationId,
    otherOrganizationId,
    siteId,
    otherSiteId,
    operatorUserId,
    viewerUserId,
    otherUserId,
  };
}

function updateInput(
  organizationId: Id<"organizations">,
  siteId: Id<"sites">,
) {
  return {
    organizationId,
    siteId,
    name: "North Tower",
    code: "NORTH-1",
    region: "Greater Accra",
    latitude: 5.6037,
    longitude: -0.187,
    details,
    assignedOperatorUserId: null,
    assignedOperatorNote: "",
    onAirSince: 1_700_000_000_000,
  };
}

describe("site information management", () => {
  test("updates administrative details, coordinates, operator, and on-air time", async () => {
    const { asAdmin, organizationId, siteId, operatorUserId } = await seed();
    const options = await asAdmin.query(api.sites.operatorOptions, { organizationId });
    expect(options).toEqual([{ userId: operatorUserId, name: "operator" }]);
    const input = {
      ...updateInput(organizationId, siteId),
      assignedOperatorUserId: operatorUserId,
      assignedOperatorNote: "Covers the morning shift",
    };

    await asAdmin.mutation(api.sites.updateInfo, input);
    const site = await asAdmin.query(api.sites.get, { organizationId, siteId });

    expect(site).toMatchObject({
      name: "North Tower",
      code: "NORTH-1",
      region: "Greater Accra",
      latitude: 5.6037,
      longitude: -0.187,
      siteInfo: details,
      assignedOperatorUserId: operatorUserId,
      assignedOperatorName: "operator",
      assignedOperatorNote: "Covers the morning shift",
      onAirSince: 1_700_000_000_000,
      locationSource: "manual",
    });
  });

  test("limits editing and operator assignment to authorized same-organization members", async () => {
    const {
      asAdmin,
      asViewer,
      organizationId,
      otherOrganizationId,
      siteId,
      otherSiteId,
      otherUserId,
      viewerUserId,
    } = await seed();

    await expect(
      asViewer.mutation(api.sites.updateInfo, updateInput(organizationId, siteId)),
    ).rejects.toThrow(/Forbidden/);
    await expect(
      asAdmin.query(api.sites.operatorOptions, { organizationId: otherOrganizationId }),
    ).rejects.toThrow(/Forbidden/);
    await expect(
      asAdmin.mutation(api.sites.updateInfo, {
        ...updateInput(organizationId, siteId),
        assignedOperatorUserId: viewerUserId,
      }),
    ).rejects.toThrow(/Choose an Operator/);
    await expect(
      asAdmin.mutation(api.sites.updateInfo, {
        ...updateInput(organizationId, siteId),
        assignedOperatorUserId: otherUserId,
      }),
    ).rejects.toThrow(/Choose an Operator/);
    await expect(
      asAdmin.mutation(api.sites.updateInfo, updateInput(organizationId, otherSiteId)),
    ).rejects.toThrow(/Forbidden/);
  });

  test("rejects invalid coordinates, future dates, and duplicate site codes", async () => {
    const { asAdmin, organizationId, siteId } = await seed();
    const secondSiteId = await asAdmin.mutation(api.sites.create, {
      organizationId,
      name: "Second Tower",
      code: "SECOND-1",
    });
    await asAdmin.mutation(api.sites.updateInfo, updateInput(organizationId, siteId));

    await expect(
      asAdmin.mutation(api.sites.updateInfo, {
        ...updateInput(organizationId, siteId),
        latitude: 91,
      }),
    ).rejects.toThrow(/latitude must be between/);
    await expect(
      asAdmin.mutation(api.sites.updateInfo, {
        ...updateInput(organizationId, siteId),
        onAirSince: Date.now() + 60_000,
      }),
    ).rejects.toThrow(/Time on air must be a valid date/);
    await expect(
      asAdmin.mutation(api.sites.updateInfo, {
        ...updateInput(organizationId, secondSiteId),
        code: "NORTH-1",
      }),
    ).rejects.toThrow(/Site code already in use/);
  });
});
