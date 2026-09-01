/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as api_ from "../api.js";
import type * as client from "../client.js";
import type * as contracts from "../contracts.js";
import type * as crawl from "../crawl.js";
import type * as http from "../http.js";
import type * as interact from "../interact.js";
import type * as lib from "../lib.js";
import type * as monitor from "../monitor.js";
import type * as signature from "../signature.js";
import type * as upstreamClient from "../upstreamClient.js";
import type * as validators from "../validators.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import { anyApi, componentsGeneric } from "convex/server";

const fullApi: ApiFromModules<{
  api: typeof api_;
  client: typeof client;
  contracts: typeof contracts;
  crawl: typeof crawl;
  http: typeof http;
  interact: typeof interact;
  lib: typeof lib;
  monitor: typeof monitor;
  signature: typeof signature;
  upstreamClient: typeof upstreamClient;
  validators: typeof validators;
}> = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
> = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
> = anyApi as any;

export const components = componentsGeneric() as unknown as {};
