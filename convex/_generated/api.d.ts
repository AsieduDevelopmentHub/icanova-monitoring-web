/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as alarms from "../alarms.js";
import type * as audits from "../audits.js";
import type * as auth from "../auth.js";
import type * as authz from "../authz.js";
import type * as crons from "../crons.js";
import type * as delivery from "../delivery.js";
import type * as devices from "../devices.js";
import type * as diagnostics from "../diagnostics.js";
import type * as formats from "../formats.js";
import type * as generators from "../generators.js";
import type * as http from "../http.js";
import type * as ingest from "../ingest.js";
import type * as ingestAuth from "../ingestAuth.js";
import type * as ingestDecode from "../ingestDecode.js";
import type * as limits from "../limits.js";
import type * as maintenance from "../maintenance.js";
import type * as messages from "../messages.js";
import type * as metrics from "../metrics.js";
import type * as notifications from "../notifications.js";
import type * as notify from "../notify.js";
import type * as notifyEmit from "../notifyEmit.js";
import type * as notifyTemplates from "../notifyTemplates.js";
import type * as order from "../order.js";
import type * as organizations from "../organizations.js";
import type * as permissions from "../permissions.js";
import type * as reports from "../reports.js";
import type * as rollup from "../rollup.js";
import type * as siteSummary from "../siteSummary.js";
import type * as sites from "../sites.js";
import type * as storage from "../storage.js";
import type * as telemetry from "../telemetry.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  alarms: typeof alarms;
  audits: typeof audits;
  auth: typeof auth;
  authz: typeof authz;
  crons: typeof crons;
  delivery: typeof delivery;
  devices: typeof devices;
  diagnostics: typeof diagnostics;
  formats: typeof formats;
  generators: typeof generators;
  http: typeof http;
  ingest: typeof ingest;
  ingestAuth: typeof ingestAuth;
  ingestDecode: typeof ingestDecode;
  limits: typeof limits;
  maintenance: typeof maintenance;
  messages: typeof messages;
  metrics: typeof metrics;
  notifications: typeof notifications;
  notify: typeof notify;
  notifyEmit: typeof notifyEmit;
  notifyTemplates: typeof notifyTemplates;
  order: typeof order;
  organizations: typeof organizations;
  permissions: typeof permissions;
  reports: typeof reports;
  rollup: typeof rollup;
  siteSummary: typeof siteSummary;
  sites: typeof sites;
  storage: typeof storage;
  telemetry: typeof telemetry;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
