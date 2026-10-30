import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Tenancy is the organization id on each row.
 * telemetryCurrent is the live document: one per generator, overwritten.
 * telemetryBuckets is history: one per generator per 15-minute window, overwritten.
 * Fleet subscriptions read telemetryCurrent for a single site and stop at 50.
 * They do not read telemetryBuckets.
 * ingestCursors stores the last accepted boot id and sequence for one device.
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
  }).index("by_org", ["organizationId"]),

  devices: defineTable({
    organizationId: v.id("organizations"),
    siteId: v.id("sites"),
    name: v.string(),
    identity: v.string(),
  })
    .index("by_org_site", ["organizationId", "siteId"])
    .index("by_org_identity", ["organizationId", "identity"])
    .index("by_identity", ["identity"]),

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
   * Fresh and stale are not stored here: they change as time passes, and a
   * correct total would require reading every generator.
   */
  siteSummaries: defineTable({
    organizationId: v.id("organizations"),
    siteId: v.id("sites"),
    generators: v.union(v.number(), v.null()),
    reporting: v.number(),
    linkOk: v.number(),
    linkFail: v.number(),
    linkDegraded: v.number(),
    linkOther: v.number(),
    lastTelemetryAt: v.union(v.number(), v.null()),
  })
    .index("by_site", ["siteId"])
    .index("by_org", ["organizationId"]),

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
  })
    .index("by_org_created", ["organizationId", "createdAt"])
    .index("by_channel", ["channel"]),

  notificationPolicies: defineTable({
    organizationId: v.id("organizations"),
    channel: v.union(v.literal("email"), v.literal("sms"), v.literal("push")),
    event: v.union(v.literal("alarm.raised"), v.literal("maintenance.recorded")),
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
  }).index("by_org_user", ["organizationId", "userId"]),

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
  }).index("by_device", ["deviceId"]),

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
