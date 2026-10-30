import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Tenancy is the organization id on each row.
 * telemetryCurrent is the live document: one per generator, overwritten.
 * telemetryBuckets is history: one per generator per 15-minute window, overwritten.
 * Fleet subscriptions read telemetryCurrent for a single site and stop at 50.
 * They do not read telemetryBuckets.
 * ingestCursors stores the last accepted session. epoch is the persistent
 * boot counter. A random boot id is not an ordering key.
 * extra holds measurements the cloud JSON added after the original seven.
 * A null extra value is unavailable. It is not zero.
 */
const quality = v.union(
  v.literal("measured"),
  v.literal("unavailable"),
  v.literal("unsupported"),
  v.literal("under-range"),
  v.literal("over-range"),
  v.literal("stale"),
  v.literal("invalid"),
);

const sampleFields = {
  sourceTime: v.union(v.number(), v.null()),
  link: v.union(v.string(), v.null()),
  mode: v.union(v.string(), v.null()),
  alarmCount: v.union(v.number(), v.null()),
  rpm: v.union(v.number(), v.null()),
  rpmQuality: quality,
  batteryV: v.union(v.number(), v.null()),
  batteryQuality: quality,
  frequencyHz: v.union(v.number(), v.null()),
  frequencyQuality: quality,
  powerKw: v.union(v.number(), v.null()),
  powerQuality: quality,
  voltageL1: v.union(v.number(), v.null()),
  voltageQuality: quality,
  extra: v.optional(v.record(v.string(), v.union(v.number(), v.null()))),
  extraQuality: v.optional(v.record(v.string(), quality)),
  unmapped: v.optional(v.record(v.string(), v.union(v.number(), v.null()))),
};

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    name: v.optional(v.string()),
  }).index("by_token", ["tokenIdentifier"]),

  organizations: defineTable({
    name: v.string(),
    createdAt: v.number(),
  }),

  roles: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    permissions: v.array(v.string()),
  }).index("by_org", ["organizationId"]),

  memberships: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    roleId: v.id("roles"),
  })
    .index("by_org_user", ["organizationId", "userId"])
    .index("by_user", ["userId"]),

  sites: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    generatorCount: v.optional(v.number()),
    recounting: v.optional(v.boolean()),
  }).index("by_org", ["organizationId"]),

  devices: defineTable({
    organizationId: v.id("organizations"),
    siteId: v.id("sites"),
    name: v.string(),
    identity: v.string(),
    /**
     * Missing or "active" accepts ingest. "inactive" rejects before telemetry/health writes.
     * Optional for migration-compatible handling of existing rows.
     */
    lifecycle: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
    lifecycleChangedAt: v.optional(v.number()),
  })
    .index("by_org_site", ["organizationId", "siteId"])
    .index("by_org_identity", ["organizationId", "identity"])
    .index("by_identity", ["identity"]),

  /**
   * Bounded per-key ingest counters. One row per device identity or IP key.
   * Windows reset automatically; stale rows are pruned in small batches.
   */
  ingestRateWindows: defineTable({
    key: v.string(),
    windowStart: v.number(),
    count: v.number(),
    updatedAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_updated", ["updatedAt"]),

  generators: defineTable({
    organizationId: v.id("organizations"),
    siteId: v.id("sites"),
    deviceId: v.id("devices"),
    name: v.string(),
  })
    .index("by_org_site", ["organizationId", "siteId"])
    .index("by_device", ["deviceId"]),

  telemetryCurrent: defineTable({
    organizationId: v.id("organizations"),
    siteId: v.id("sites"),
    deviceId: v.id("devices"),
    generatorId: v.id("generators"),
    updatedAt: v.number(),
    ...sampleFields,
    boot: v.optional(v.number()),
    seq: v.optional(v.number()),
    epoch: v.optional(v.number()),
  })
    .index("by_generator", ["generatorId"])
    .index("by_org_site", ["organizationId", "siteId"]),

  telemetryBuckets: defineTable({
    organizationId: v.id("organizations"),
    siteId: v.id("sites"),
    deviceId: v.id("devices"),
    generatorId: v.id("generators"),
    bucketStart: v.number(),
    updatedAt: v.number(),
    ...sampleFields,
    sampleCount: v.optional(v.number()),
    rpmMin: v.optional(v.union(v.number(), v.null())),
    rpmMax: v.optional(v.union(v.number(), v.null())),
    rpmSum: v.optional(v.number()),
    rpmCount: v.optional(v.number()),
    rpmLast: v.optional(v.union(v.number(), v.null())),
    batteryMin: v.optional(v.union(v.number(), v.null())),
    batteryMax: v.optional(v.union(v.number(), v.null())),
    batterySum: v.optional(v.number()),
    batteryCount: v.optional(v.number()),
    batteryLast: v.optional(v.union(v.number(), v.null())),
    frequencyMin: v.optional(v.union(v.number(), v.null())),
    frequencyMax: v.optional(v.union(v.number(), v.null())),
    frequencySum: v.optional(v.number()),
    frequencyCount: v.optional(v.number()),
    frequencyLast: v.optional(v.union(v.number(), v.null())),
    powerMin: v.optional(v.union(v.number(), v.null())),
    powerMax: v.optional(v.union(v.number(), v.null())),
    powerSum: v.optional(v.number()),
    powerCount: v.optional(v.number()),
    powerLast: v.optional(v.union(v.number(), v.null())),
    voltageMin: v.optional(v.union(v.number(), v.null())),
    voltageMax: v.optional(v.union(v.number(), v.null())),
    voltageSum: v.optional(v.number()),
    voltageCount: v.optional(v.number()),
    voltageLast: v.optional(v.union(v.number(), v.null())),
  })
    .index("by_generator_time", ["generatorId", "bucketStart"])
    .index("by_bucket", ["bucketStart"]),

  /**
   * One row per site. Link counts change when a sample is stored.
   * Gateway / freshness / overall tallies are maintained from deviceHealth
   * transitions so dashboards do not scan devices.
   */
  siteSummaries: defineTable({
    organizationId: v.id("organizations"),
    siteId: v.id("sites"),
    /** Exact registered count. Null only while an old site is still being counted. */
    generators: v.union(v.number(), v.null()),
    reporting: v.number(),
    linkOk: v.number(),
    linkFail: v.number(),
    linkDegraded: v.number(),
    linkOther: v.number(),
    lastTelemetryAt: v.union(v.number(), v.null()),
    gatewayOnline: v.optional(v.number()),
    gatewayOffline: v.optional(v.number()),
    gatewayUnknown: v.optional(v.number()),
    modbusOk: v.optional(v.number()),
    modbusDegraded: v.optional(v.number()),
    modbusFail: v.optional(v.number()),
    modbusUnknown: v.optional(v.number()),
    telemetryFresh: v.optional(v.number()),
    telemetryStale: v.optional(v.number()),
    telemetryMissing: v.optional(v.number()),
    overallHealthy: v.optional(v.number()),
    overallDegraded: v.optional(v.number()),
    overallUnhealthy: v.optional(v.number()),
    overallUnknown: v.optional(v.number()),
    activeCommProblems: v.optional(v.number()),
    devicesTracked: v.optional(v.number()),
    lastGatewayContactAt: v.optional(v.union(v.number(), v.null())),
  })
    .index("by_site", ["siteId"])
    .index("by_org", ["organizationId"]),

  /** One row per organization. Incremental tallies from deviceHealth transitions. */
  orgHealthSummaries: defineTable({
    organizationId: v.id("organizations"),
    devicesTracked: v.number(),
    gatewayOnline: v.number(),
    gatewayOffline: v.number(),
    gatewayUnknown: v.number(),
    modbusOk: v.number(),
    modbusDegraded: v.number(),
    modbusFail: v.number(),
    modbusUnknown: v.number(),
    telemetryFresh: v.number(),
    telemetryStale: v.number(),
    telemetryMissing: v.number(),
    overallHealthy: v.number(),
    overallDegraded: v.number(),
    overallUnhealthy: v.number(),
    overallUnknown: v.number(),
    activeCommProblems: v.number(),
    lastGatewayContactAt: v.union(v.number(), v.null()),
    lastTelemetryAt: v.union(v.number(), v.null()),
    updatedAt: v.number(),
  }).index("by_org", ["organizationId"]),

  /**
   * One row per device. Gateway contact is heartbeat or accepted batch.
   * Modbus comes from the latest accepted sample link. Freshness ages out via sweep.
   */
  deviceHealthCurrent: defineTable({
    organizationId: v.id("organizations"),
    deviceId: v.id("devices"),
    siteId: v.id("sites"),
    generatorId: v.union(v.id("generators"), v.null()),
    lastHeartbeatAt: v.union(v.number(), v.null()),
    lastAcceptedBatchAt: v.union(v.number(), v.null()),
    lastGatewayContactAt: v.union(v.number(), v.null()),
    lastTelemetryAt: v.union(v.number(), v.null()),
    link: v.union(v.string(), v.null()),
    gatewayStatus: v.union(
      v.literal("online"),
      v.literal("offline"),
      v.literal("unknown"),
    ),
    modbusStatus: v.union(
      v.literal("ok"),
      v.literal("degraded"),
      v.literal("fail"),
      v.literal("unknown"),
    ),
    telemetryFreshness: v.union(
      v.literal("fresh"),
      v.literal("stale"),
      v.literal("missing"),
    ),
    overallStatus: v.union(
      v.literal("healthy"),
      v.literal("degraded"),
      v.literal("unhealthy"),
      v.literal("unknown"),
    ),
    gatewayOfflineNotified: v.boolean(),
    telemetryStaleNotified: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_device", ["deviceId"])
    .index("by_org", ["organizationId"])
    .index("by_site", ["siteId"])
    .index("by_org_overall", ["organizationId", "overallStatus"])
    .index("by_org_gateway", ["organizationId", "gatewayStatus"])
    .index("by_gateway_contact", ["gatewayStatus", "lastGatewayContactAt"])
    .index("by_freshness_telemetry", ["telemetryFreshness", "lastTelemetryAt"]),

  deviceHealthEvents: defineTable({
    organizationId: v.id("organizations"),
    deviceId: v.id("devices"),
    siteId: v.id("sites"),
    generatorId: v.union(v.id("generators"), v.null()),
    at: v.number(),
    reason: v.union(
      v.literal("heartbeat"),
      v.literal("ingest"),
      v.literal("sweep"),
      v.literal("reconcile"),
    ),
    gatewayFrom: v.optional(v.string()),
    gatewayTo: v.optional(v.string()),
    modbusFrom: v.optional(v.string()),
    modbusTo: v.optional(v.string()),
    freshnessFrom: v.optional(v.string()),
    freshnessTo: v.optional(v.string()),
    overallFrom: v.optional(v.string()),
    overallTo: v.optional(v.string()),
  })
    .index("by_device_at", ["deviceId", "at"])
    .index("by_org_at", ["organizationId", "at"])
    .index("by_site_at", ["siteId", "at"]),

  alarms: defineTable({
    organizationId: v.id("organizations"),
    siteId: v.id("sites"),
    deviceId: v.id("devices"),
    generatorId: v.union(v.id("generators"), v.null()),
    kind: v.union(v.literal("controller"), v.literal("transport")),
    state: v.union(
      v.literal("active"),
      v.literal("acknowledged"),
      v.literal("cleared"),
      v.literal("resolved"),
    ),
    summary: v.string(),
    detail: v.string(),
    raisedAt: v.number(),
    sourceTime: v.union(v.number(), v.null()),
    acknowledgedAt: v.union(v.number(), v.null()),
    acknowledgedBy: v.union(v.id("users"), v.null()),
    assignedTo: v.union(v.id("users"), v.null()),
    clearedAt: v.union(v.number(), v.null()),
    resolvedAt: v.union(v.number(), v.null()),
    resolvedBy: v.union(v.id("users"), v.null()),
    category: v.optional(
      v.union(v.literal("generator"), v.literal("communication"), v.literal("gateway")),
    ),
    code: v.optional(v.string()),
    severity: v.optional(
      v.union(v.literal("critical"), v.literal("warning"), v.literal("informational")),
    ),
    source: v.optional(v.string()),
    occurrenceCount: v.optional(v.number()),
    firstOccurredAt: v.optional(v.number()),
    lastOccurredAt: v.optional(v.number()),
    evidenceBoot: v.optional(v.number()),
    evidenceSeq: v.optional(v.number()),
  })
    .index("by_org_raised", ["organizationId", "raisedAt"])
    .index("by_org_device", ["organizationId", "deviceId"])
    .index("by_org_site_raised", ["organizationId", "siteId", "raisedAt"])
    .index("by_generator_raised", ["generatorId", "raisedAt"])
    .index("by_generator_code_raised", ["generatorId", "code", "raisedAt"]),

  alarmComments: defineTable({
    organizationId: v.id("organizations"),
    alarmId: v.id("alarms"),
    authorId: v.id("users"),
    body: v.string(),
    at: v.number(),
  }).index("by_alarm", ["alarmId"]),

  alarmEvents: defineTable({
    organizationId: v.id("organizations"),
    alarmId: v.id("alarms"),
    action: v.string(),
    actorToken: v.string(),
    note: v.union(v.string(), v.null()),
    fromState: v.union(v.string(), v.null()),
    toState: v.union(v.string(), v.null()),
    at: v.number(),
  }).index("by_alarm_time", ["alarmId", "at"]),

  modbusRecords: defineTable({
    organizationId: v.id("organizations"),
    deviceId: v.id("devices"),
    recordedAt: v.number(),
    kind: v.union(v.literal("frame"), v.literal("batch")),
    txn: v.union(v.number(), v.null()),
    functionCode: v.union(v.string(), v.null()),
    address: v.union(v.number(), v.null()),
    quantity: v.union(v.number(), v.null()),
    tx: v.union(v.string(), v.null()),
    rx: v.union(v.string(), v.null()),
    rxLength: v.union(v.number(), v.null()),
    receivedCrc: v.union(v.string(), v.null()),
    calculatedCrc: v.union(v.string(), v.null()),
    crcResult: v.union(v.string(), v.null()),
    result: v.union(v.string(), v.null()),
    latencyMs: v.union(v.number(), v.null()),
    retries: v.union(v.number(), v.null()),
    note: v.union(v.string(), v.null()),
  }).index("by_device_time", ["deviceId", "recordedAt"]),

  devicePolls: defineTable({
    organizationId: v.id("organizations"),
    deviceId: v.id("devices"),
    txn: v.union(v.number(), v.null()),
    label: v.string(),
    at: v.union(v.number(), v.null()),
  }).index("by_device", ["deviceId"]),

  audits: defineTable({
    organizationId: v.id("organizations"),
    actorToken: v.string(),
    action: v.string(),
    target: v.string(),
    at: v.number(),
  }).index("by_org_time", ["organizationId", "at"]),

  messages: defineTable({
    organizationId: v.id("organizations"),
    channel: v.union(v.literal("email"), v.literal("sms"), v.literal("push")),
    to: v.string(),
    subject: v.optional(v.string()),
    body: v.string(),
    providerId: v.optional(v.string()),
    status: v.string(),
    attempt: v.number(),
    error: v.optional(v.string()),
    event: v.optional(v.string()),
    createdAt: v.number(),
    userId: v.optional(v.id("users")),
    alarmId: v.optional(v.id("alarms")),
    siteId: v.optional(v.id("sites")),
    generatorId: v.optional(v.id("generators")),
    deviceId: v.optional(v.id("devices")),
    idempotencyKey: v.optional(v.string()),
    lastAttemptAt: v.optional(v.number()),
    nextAttemptAt: v.optional(v.number()),
    /** Increments on every claim. Completions must match or they are ignored. */
    claimGeneration: v.optional(v.number()),
    leaseExpiresAt: v.optional(v.number()),
    failureCategory: v.optional(
      v.union(
        v.literal("rejected"),
        v.literal("uncertain"),
        v.literal("not_configured"),
        v.literal("cancelled"),
        v.literal("suppressed"),
      ),
    ),
    parentMessageId: v.optional(v.id("messages")),
  })
    .index("by_org_created", ["organizationId", "createdAt"])
    .index("by_channel", ["channel"])
    .index("by_org_idempotency", ["organizationId", "idempotencyKey"])
    .index("by_status_lease", ["status", "leaseExpiresAt"]),

  /** One row per org event key so raise/ack/clear emit once. */
  notificationDispatches: defineTable({
    organizationId: v.id("organizations"),
    idempotencyKey: v.string(),
    event: v.string(),
    createdAt: v.number(),
  }).index("by_org_key", ["organizationId", "idempotencyKey"]),

  notificationSettings: defineTable({
    organizationId: v.id("organizations"),
    minSeverity: v.union(
      v.literal("critical"),
      v.literal("warning"),
      v.literal("informational"),
    ),
    escalateAfterMinutes: v.union(v.number(), v.null()),
  }).index("by_org", ["organizationId"]),

  notificationPolicies: defineTable({
    organizationId: v.id("organizations"),
    channel: v.union(
      v.literal("email"),
      v.literal("sms"),
      v.literal("push"),
      v.literal("inapp"),
    ),
    event: v.union(
      v.literal("alarm.raised"),
      v.literal("alarm.acknowledged"),
      v.literal("alarm.cleared"),
      v.literal("device.registered"),
      v.literal("maintenance.recorded"),
      v.literal("health.gateway.offline"),
      v.literal("health.gateway.recovered"),
      v.literal("health.telemetry.stale"),
      v.literal("health.telemetry.recovered"),
    ),
    enabled: v.boolean(),
  }).index("by_org_event", ["organizationId", "event"]),

  notificationPreferences: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    email: v.union(v.string(), v.null()),
    phone: v.union(v.string(), v.null()),
    emailEnabled: v.boolean(),
    smsEnabled: v.boolean(),
    pushEnabled: v.boolean(),
    inAppEnabled: v.optional(v.boolean()),
    minSeverity: v.optional(
      v.union(v.literal("critical"), v.literal("warning"), v.literal("informational")),
    ),
    subscribedSiteIds: v.optional(v.array(v.id("sites"))),
  }).index("by_org_user", ["organizationId", "userId"]),

  userNotifications: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    event: v.string(),
    severity: v.union(
      v.literal("critical"),
      v.literal("warning"),
      v.literal("informational"),
    ),
    title: v.string(),
    body: v.string(),
    alarmId: v.optional(v.id("alarms")),
    generatorId: v.optional(v.id("generators")),
    siteId: v.optional(v.id("sites")),
    deviceId: v.optional(v.id("devices")),
    readAt: v.optional(v.union(v.number(), v.null())),
    createdAt: v.number(),
    idempotencyKey: v.string(),
  })
    .index("by_org_user_created", ["organizationId", "userId", "createdAt"])
    .index("by_org_idempotency", ["organizationId", "idempotencyKey"])
    .index("by_user_created", ["userId", "createdAt"]),

  maintenanceRecords: defineTable({
    organizationId: v.id("organizations"),
    generatorId: v.id("generators"),
    summary: v.string(),
    notes: v.string(),
    performedAt: v.union(v.number(), v.null()),
    recordedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_generator", ["generatorId"]),

  reports: defineTable({
    organizationId: v.id("organizations"),
    requestedBy: v.id("users"),
    kind: v.string(),
    format: v.string(),
    rowCount: v.number(),
    capped: v.boolean(),
    content: v.string(),
    createdAt: v.number(),
  }).index("by_org", ["organizationId"]),

  ingestCursors: defineTable({
    organizationId: v.id("organizations"),
    deviceId: v.id("devices"),
    boot: v.number(),
    seq: v.number(),
    epoch: v.optional(v.number()),
  }).index("by_device", ["deviceId"]),

  /** One row. Prune progress, not a fleet scan. */
  retentionState: defineTable({
    lastDeleted: v.number(),
    backlog: v.boolean(),
    updatedAt: v.number(),
  }),

  /**
   * One row per scheduled/internal job name. Operational visibility only.
   * Never store secrets, tokens, or provider payloads here.
   */
  jobRunState: defineTable({
    jobName: v.string(),
    lastAttemptAt: v.number(),
    lastSuccessAt: v.union(v.number(), v.null()),
    lastErrorAt: v.union(v.number(), v.null()),
    lastError: v.union(v.string(), v.null()),
    processed: v.number(),
    failed: v.number(),
    pendingHint: v.union(v.number(), v.null()),
    durationMs: v.union(v.number(), v.null()),
    status: v.union(
      v.literal("ok"),
      v.literal("partial"),
      v.literal("failed"),
      v.literal("running"),
    ),
    updatedAt: v.number(),
  }).index("by_job", ["jobName"]),

  /**
   * Bounded, resumable backfill progress. Migrations never auto-delete data.
   * dryRun batches must not mutate business tables.
   */
  migrationState: defineTable({
    name: v.string(),
    cursor: v.union(v.string(), v.null()),
    processed: v.number(),
    updated: v.number(),
    skipped: v.number(),
    errors: v.number(),
    dryRun: v.boolean(),
    status: v.union(
      v.literal("idle"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    lastError: v.union(v.string(), v.null()),
    updatedAt: v.number(),
  }).index("by_name", ["name"]),

  files: defineTable({
    organizationId: v.id("organizations"),
    storageId: v.id("_storage"),
    name: v.string(),
    ownerToken: v.string(),
    createdAt: v.number(),
  })
    .index("by_storage", ["storageId"])
    .index("by_org_owner", ["organizationId", "ownerToken"]),
});
