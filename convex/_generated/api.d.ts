/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agentmail from "../agentmail.js";
import type * as ai from "../ai.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as firecrawl from "../firecrawl.js";
import type * as health from "../health.js";
import type * as http from "../http.js";
import type * as inbox from "../inbox.js";
import type * as ingestion from "../ingestion.js";
import type * as integrations_auth from "../integrations/auth.js";
import type * as integrations_authz from "../integrations/authz.js";
import type * as integrations_contentHash from "../integrations/contentHash.js";
import type * as integrations_env from "../integrations/env.js";
import type * as integrations_fingerprints from "../integrations/fingerprints.js";
import type * as integrations_structuredConvexGateway from "../integrations/structuredConvexGateway.js";
import type * as integrations_svix from "../integrations/svix.js";
import type * as memory from "../memory.js";
import type * as openaiEmbeddings from "../openaiEmbeddings.js";
import type * as outreach from "../outreach.js";
import type * as savedNeeds from "../savedNeeds.js";
import type * as scout from "../scout.js";
import type * as scoutCaseCards from "../scoutCaseCards.js";
import type * as signals from "../signals.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agentmail: typeof agentmail;
  ai: typeof ai;
  auth: typeof auth;
  crons: typeof crons;
  firecrawl: typeof firecrawl;
  health: typeof health;
  http: typeof http;
  inbox: typeof inbox;
  ingestion: typeof ingestion;
  "integrations/auth": typeof integrations_auth;
  "integrations/authz": typeof integrations_authz;
  "integrations/contentHash": typeof integrations_contentHash;
  "integrations/env": typeof integrations_env;
  "integrations/fingerprints": typeof integrations_fingerprints;
  "integrations/structuredConvexGateway": typeof integrations_structuredConvexGateway;
  "integrations/svix": typeof integrations_svix;
  memory: typeof memory;
  openaiEmbeddings: typeof openaiEmbeddings;
  outreach: typeof outreach;
  savedNeeds: typeof savedNeeds;
  scout: typeof scout;
  scoutCaseCards: typeof scoutCaseCards;
  signals: typeof signals;
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

export declare const components: {
  auth: import("@convex-dev/auth/core/_generated/component.js").ComponentApi<"auth">;
  authUsername: import("@convex-dev/auth/username/_generated/component.js").ComponentApi<"authUsername">;
  authPasswordProvider: import("@convex-dev/auth/providers/password/_generated/component.js").ComponentApi<"authPasswordProvider">;
  agent: import("@convex-dev/agent/_generated/component.js").ComponentApi<"agent">;
  staticHosting: import("@convex-dev/static-hosting/_generated/component.js").ComponentApi<"staticHosting">;
};
