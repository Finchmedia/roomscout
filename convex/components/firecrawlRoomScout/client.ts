import type {
  FunctionReference,
  GenericActionCtx,
  GenericDataModel,
} from "convex/server";
import type { ComponentApi } from "./_generated/component.js";
import {
  FirecrawlClient,
  type ScrapeOptions,
} from "./upstreamClient.js";

type ActionCtx = Pick<
  GenericActionCtx<GenericDataModel>,
  "runQuery" | "runMutation" | "runAction"
>;
type InternalAction = FunctionReference<"action", "internal", any, any>;

export type NativeMonitorTarget = {
  id?: string;
  type: "scrape" | "crawl";
  url?: string;
  urls?: string[];
  scrapeOptions?: Record<string, unknown>;
  [key: string]: unknown;
};

export type CreateMonitorRequest = {
  name: string;
  schedule: { text: string; timezone?: string };
  webhook?: {
    url: string;
    headers?: Record<string, string>;
    metadata?: Record<string, unknown>;
    events?: string[];
  };
  targets: NativeMonitorTarget[];
  retentionDays?: number;
  goal?: string;
  judgeEnabled?: boolean;
  [key: string]: unknown;
};

export type NativeMonitor = {
  id: string;
  status: string;
  targets: NativeMonitorTarget[];
  [key: string]: unknown;
};

type RoomScoutExtensions = {
  monitor: {
    create: InternalAction;
    list: InternalAction;
    get: InternalAction;
    update: InternalAction;
    remove: InternalAction;
    run: InternalAction;
    listChecks: InternalAction;
    getCheck: InternalAction;
  };
  interact: {
    execute: InternalAction;
    stop: InternalAction;
  };
};

export type RoomScoutFirecrawlComponentApi = ComponentApi &
  RoomScoutExtensions;

/**
 * Complete upstream Firecrawl client plus RoomScout's Native Monitoring and
 * Interact surfaces. Application auth, ownership, policy checks, approvals,
 * and rate limits stay in the app wrappers before these methods are called.
 */
export class FirecrawlRoomScoutClient extends FirecrawlClient {
  declare component: RoomScoutFirecrawlComponentApi;

  constructor(component: RoomScoutFirecrawlComponentApi) {
    super(component);
    this.component = component;
  }

  async createMonitor(
    ctx: ActionCtx,
    request: CreateMonitorRequest,
  ): Promise<NativeMonitor> {
    return await ctx.runAction(this.component.monitor.create, { request });
  }

  listMonitors(
    ctx: ActionCtx,
    options: { limit?: number; offset?: number } = {},
  ) {
    return ctx.runAction(this.component.monitor.list, options);
  }

  async getMonitor(ctx: ActionCtx, monitorId: string): Promise<NativeMonitor> {
    return await ctx.runAction(this.component.monitor.get, { monitorId });
  }

  updateMonitor(
    ctx: ActionCtx,
    monitorId: string,
    request: Record<string, unknown>,
  ): Promise<NativeMonitor> {
    return ctx.runAction(this.component.monitor.update, { monitorId, request });
  }

  deleteMonitor(ctx: ActionCtx, monitorId: string) {
    return ctx.runAction(this.component.monitor.remove, { monitorId });
  }

  runMonitor(ctx: ActionCtx, monitorId: string) {
    return ctx.runAction(this.component.monitor.run, { monitorId });
  }

  listMonitorChecks(
    ctx: ActionCtx,
    monitorId: string,
    options: { limit?: number; offset?: number } = {},
  ) {
    return ctx.runAction(this.component.monitor.listChecks, {
      monitorId,
      ...options,
    });
  }

  getMonitorCheck(
    ctx: ActionCtx,
    monitorId: string,
    checkId: string,
    options: {
      limit?: number;
      skip?: number;
      status?: "same" | "new" | "changed" | "removed" | "error";
    } = {},
  ) {
    return ctx.runAction(this.component.monitor.getCheck, {
      monitorId,
      checkId,
      ...options,
    });
  }

  /**
   * Run code or a natural-language prompt against an existing Firecrawl
   * scrape job. Set mutating=true for any program that can click, type,
   * submit, or otherwise write; such calls are never automatically retried.
   */
  interact(
    ctx: ActionCtx,
    jobId: string,
    args: {
      code?: string;
      prompt?: string;
      language?: "node" | "python" | "bash";
      timeout?: number;
      mutating: boolean;
    },
  ) {
    return ctx.runAction(this.component.interact.execute, { jobId, ...args });
  }

  stopInteraction(ctx: ActionCtx, jobId: string) {
    return ctx.runAction(this.component.interact.stop, { jobId });
  }

  /** Convenience helper for creating the underlying scrape browser session. */
  startInteractiveScrape(
    ctx: ActionCtx,
    url: string,
    options?: ScrapeOptions,
  ) {
    return this.scrape(ctx, url, options);
  }
}

export * from "./upstreamClient.js";
export default FirecrawlRoomScoutClient;
