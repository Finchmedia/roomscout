import { v } from "convex/values";
import { action } from "./_generated/server.js";
import { firecrawlRequest } from "./api.js";
import { firecrawlId, queryString } from "./contracts.js";

const requestValidator = v.record(v.string(), v.any());

function data(body: Record<string, any>): any {
  return body.data ?? body;
}

/** Create a Firecrawl Native Monitor. No automatic retry avoids duplicates. */
export const create = action({
  args: { request: requestValidator },
  returns: v.any(),
  handler: async (_ctx, args) =>
    data(await firecrawlRequest("/v2/monitor", {
      method: "POST",
      body: args.request,
      maxRetries: 0,
    })),
});

export const list = action({
  args: { limit: v.optional(v.number()), offset: v.optional(v.number()) },
  returns: v.any(),
  handler: async (_ctx, args) =>
    data(await firecrawlRequest(
      `/v2/monitor${queryString({ limit: args.limit, offset: args.offset })}`,
      { method: "GET" },
    )),
});

export const get = action({
  args: { monitorId: v.string() },
  returns: v.any(),
  handler: async (_ctx, args) =>
    data(await firecrawlRequest(
      `/v2/monitor/${firecrawlId(args.monitorId, "monitor_id")}`,
      { method: "GET" },
    )),
});

/** Update a monitor definition or status without replaying a mutating call. */
export const update = action({
  args: { monitorId: v.string(), request: requestValidator },
  returns: v.any(),
  handler: async (_ctx, args) =>
    data(await firecrawlRequest(
      `/v2/monitor/${firecrawlId(args.monitorId, "monitor_id")}`,
      { method: "PATCH", body: args.request, maxRetries: 0 },
    )),
});

export const remove = action({
  args: { monitorId: v.string() },
  returns: v.boolean(),
  handler: async (_ctx, args) => {
    const body = await firecrawlRequest(
      `/v2/monitor/${firecrawlId(args.monitorId, "monitor_id")}`,
      { method: "DELETE", maxRetries: 0 },
    );
    return body.success !== false;
  },
});

/** Trigger one check. No retry avoids triggering the same check twice. */
export const run = action({
  args: { monitorId: v.string() },
  returns: v.any(),
  handler: async (_ctx, args) =>
    data(await firecrawlRequest(
      `/v2/monitor/${firecrawlId(args.monitorId, "monitor_id")}/run`,
      { method: "POST", body: {}, maxRetries: 0 },
    )),
});

export const listChecks = action({
  args: {
    monitorId: v.string(),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (_ctx, args) =>
    data(await firecrawlRequest(
      `/v2/monitor/${firecrawlId(args.monitorId, "monitor_id")}/checks${queryString({ limit: args.limit, offset: args.offset })}`,
      { method: "GET" },
    )),
});

/**
 * Fetch one page of check results. RoomScout owns bounded pagination and passes
 * `skip` explicitly, so the component never follows an arbitrary absolute URL.
 */
export const getCheck = action({
  args: {
    monitorId: v.string(),
    checkId: v.string(),
    limit: v.optional(v.number()),
    skip: v.optional(v.number()),
    status: v.optional(
      v.union(
        v.literal("same"),
        v.literal("new"),
        v.literal("changed"),
        v.literal("removed"),
        v.literal("error"),
      ),
    ),
  },
  returns: v.any(),
  handler: async (_ctx, args) =>
    data(await firecrawlRequest(
      `/v2/monitor/${firecrawlId(args.monitorId, "monitor_id")}/checks/${firecrawlId(args.checkId, "check_id")}${queryString({ limit: args.limit, skip: args.skip, status: args.status })}`,
      { method: "GET" },
    )),
});
