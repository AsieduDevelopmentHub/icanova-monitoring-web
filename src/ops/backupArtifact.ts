/**
 * Non-destructive checks on Convex export/backup ZIP layouts.
 * Does not perform restore. Does not claim disaster recovery is tested.
 */

export const REQUIRED_BACKUP_TABLES = [
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
] as const;

const SECRET_NAME_HINTS = [
  "secret",
  "password",
  "private_key",
  "private-key",
  ".pem",
  "bearer",
  "api_key",
  "apikey",
];

export type BackupPathCheck = {
  ok: boolean;
  issues: string[];
  tableFiles: string[];
};

/** Validate paths present in a downloaded Convex snapshot ZIP (path list only). */
export function validateBackupPaths(paths: string[]): BackupPathCheck {
  const issues: string[] = [];
  const normalized = paths.map((p) => p.replaceAll("\\", "/"));
  for (const path of normalized) {
    const lower = path.toLowerCase();
    if (SECRET_NAME_HINTS.some((hint) => lower.includes(hint))) {
      issues.push(`Suspicious path that may contain secrets: ${path}`);
    }
  }
  const tableFiles = normalized.filter((p) => /\/documents\.jsonl$/i.test(p));
  if (tableFiles.length === 0) {
    issues.push("No <table>/documents.jsonl entries found.");
  }
  for (const table of REQUIRED_BACKUP_TABLES) {
    const expected = `${table}/documents.jsonl`;
    if (!normalized.some((p) => p === expected || p.endsWith(`/${expected}`))) {
      issues.push(`Missing required table export: ${expected}`);
    }
  }
  return { ok: issues.length === 0, issues, tableFiles };
}

export type BackupManifest = {
  tables: Record<string, number>;
  exportedAtMs?: number;
  environment?: string;
};

export function validateBackupManifest(manifest: BackupManifest): {
  ok: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  if (!manifest.tables || typeof manifest.tables !== "object") {
    return { ok: false, issues: ["Manifest tables object is missing."] };
  }
  for (const table of REQUIRED_BACKUP_TABLES) {
    const count = manifest.tables[table];
    if (count === undefined) {
      issues.push(`Manifest missing table count for ${table}.`);
    } else if (!Number.isFinite(count) || count < 0) {
      issues.push(`Invalid count for ${table}.`);
    }
  }
  if (manifest.environment === "production" && manifest.exportedAtMs == null) {
    issues.push("Production backups should record exportedAtMs.");
  }
  return { ok: issues.length === 0, issues };
}

/** Guardrail: restore targets must never silently default to production. */
export function restoreTargetAllowed(target: {
  deploymentName: string;
  explicitApproval: boolean;
  isProduction: boolean;
}): { allowed: boolean; reason: string } {
  if (target.isProduction && !target.explicitApproval) {
    return {
      allowed: false,
      reason: "Production restore requires explicit operator approval.",
    };
  }
  if (!target.deploymentName.trim()) {
    return { allowed: false, reason: "Deployment name is required." };
  }
  return { allowed: true, reason: "Target accepted for isolated recovery planning." };
}

export const RESTORE_TEST_STATUS =
  "NOT TESTED — OPERATOR ACTION REQUIRED" as const;
