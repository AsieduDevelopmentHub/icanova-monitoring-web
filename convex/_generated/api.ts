/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `pnpm convex:dev`.
 * @module
 */
import {
  anyApi,
  type ApiFromModules,
  type FilterApi,
  type FunctionReference,
} from "convex/server";
import type * as alarms from "../alarms.js";
import type * as audits from "../audits.js";
import type * as authz from "../authz.js";
import type * as devices from "../devices.js";
import type * as diagnostics from "../diagnostics.js";
import type * as generators from "../generators.js";
import type * as messages from "../messages.js";
import type * as notify from "../notify.js";
import type * as organizations from "../organizations.js";
import type * as sites from "../sites.js";
import type * as storage from "../storage.js";
import type * as telemetry from "../telemetry.js";
import type * as users from "../users.js";

const fullApi: ApiFromModules<{
  alarms: typeof alarms;
  audits: typeof audits;
  authz: typeof authz;
  devices: typeof devices;
  diagnostics: typeof diagnostics;
  generators: typeof generators;
  messages: typeof messages;
  notify: typeof notify;
  organizations: typeof organizations;
  sites: typeof sites;
  storage: typeof storage;
  telemetry: typeof telemetry;
  users: typeof users;
}> = anyApi as any;

export const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
> = anyApi as any;

export const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
> = anyApi as any;
