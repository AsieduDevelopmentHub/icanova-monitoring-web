import { describe, expect, test } from "vitest";
import {
  RESTORE_TEST_STATUS,
  restoreTargetAllowed,
  validateBackupManifest,
  validateBackupPaths,
} from "./backupArtifact";

describe("backup artifact checks", () => {
  test("accepts a complete Convex export path layout", () => {
    const paths = [
      "organizations/documents.jsonl",
      "users/documents.jsonl",
      "memberships/documents.jsonl",
      "sites/documents.jsonl",
      "devices/documents.jsonl",
      "generators/documents.jsonl",
      "telemetryCurrent/documents.jsonl",
      "alarms/documents.jsonl",
      "audits/documents.jsonl",
      "ingestCursors/documents.jsonl",
      "telemetryBuckets/documents.jsonl",
    ];
    expect(validateBackupPaths(paths).ok).toBe(true);
  });

  test("rejects missing tables and secret-looking paths", () => {
    const result = validateBackupPaths(["devices/documents.jsonl", "secrets/private_key.pem"]);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.includes("Missing required"))).toBe(true);
    expect(result.issues.some((i) => i.toLowerCase().includes("secret"))).toBe(true);
  });

  test("manifest validation and production restore guard", () => {
    const tables: Record<string, number> = {
      organizations: 1,
      users: 2,
      memberships: 2,
      sites: 1,
      devices: 1,
      generators: 1,
      telemetryCurrent: 1,
      alarms: 0,
      audits: 3,
      ingestCursors: 1,
    };
    expect(validateBackupManifest({ tables }).ok).toBe(true);
    expect(
      restoreTargetAllowed({
        deploymentName: "tremendous-sturgeon-449",
        isProduction: true,
        explicitApproval: false,
      }).allowed,
    ).toBe(false);
    expect(
      restoreTargetAllowed({
        deploymentName: "effervescent-kangaroo-10",
        isProduction: false,
        explicitApproval: false,
      }).allowed,
    ).toBe(true);
    expect(RESTORE_TEST_STATUS).toContain("NOT TESTED");
  });
});
