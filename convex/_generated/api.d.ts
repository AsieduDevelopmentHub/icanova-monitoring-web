/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";
import type * as alarms from "../alarms.js";
import type * as audits from "../audits.js";
import type * as authz from "../authz.js";
import type * as devices from "../devices.js";
import type * as diagnostics from "../diagnostics.js";
import type * as generators from "../generators.js";
import type * as ingest from "../ingest.js";
import type * as maintenance from "../maintenance.js";
import type * as messages from "../messages.js";
import type * as notifications from "../notifications.js";
import type * as notify from "../notify.js";
import type * as organizations from "../organizations.js";
import type * as reports from "../reports.js";
import type * as sites from "../sites.js";
import type * as storage from "../storage.js";
import type * as telemetry from "../telemetry.js";
import type * as users from "../users.js";

declare const fullApi: ApiFromModules<{
  alarms: typeof alarms;
  audits: typeof audits;
  authz: typeof authz;
  devices: typeof devices;
  diagnostics: typeof diagnostics;
  generators: typeof generators;
  ingest: typeof ingest;
  maintenance: typeof maintenance;
  messages: typeof messages;
  notifications: typeof notifications;
  notify: typeof notify;
  organizations: typeof organizations;
  reports: typeof reports;
  sites: typeof sites;
  storage: typeof storage;
  telemetry: typeof telemetry;
  users: typeof users;
}>;
export declare const api: FilterApi<typeof fullApi, FunctionReference<any, "public">>;
export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">>;
