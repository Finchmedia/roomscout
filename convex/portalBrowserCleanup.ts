"use node";

import { Browserbase } from "@browserbasehq/sdk";
import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, type ActionCtx } from "./_generated/server";
import { FirecrawlRoomScoutClient } from "./components/firecrawlRoomScout/client";

const MAX_CLEANUP_ATTEMPTS = 5;
const CLEANUP_RETRY_BASE_MS = 2_000;
const CLEANUP_DEADLINE_MS = 120_000;

export type ProviderCleanupInput = {
  ownerId: Id<"users">;
  runId: Id<"browserRuns">;
  provider: "firecrawl" | "browserbase";
  providerSessionId: string;
  attempt: number;
  deadlineAt: number;
};

type ExecutionCleanupInput = Omit<ProviderCleanupInput, "runId"> & { executionId: Id<"actionExecutions"> };
type LeaseCleanupInput = Omit<ProviderCleanupInput, "ownerId" | "runId"> & { cleanupId: Id<"providerCleanupLeases"> };

const retryProviderCleanupRef = makeFunctionReference<"action", ProviderCleanupInput, null>("portalBrowserCleanup:retryProviderCleanup");
const retryExecutionCleanupRef = makeFunctionReference<"action", ExecutionCleanupInput, null>("portalBrowserCleanup:retryExecutionCleanup");
const retryLeaseCleanupRef = makeFunctionReference<"action", LeaseCleanupInput, null>("portalBrowserCleanup:retryLeaseCleanup");

export async function runProviderCleanupAttempt<T extends { provider: "firecrawl" | "browserbase"; providerSessionId: string; attempt: number; deadlineAt: number }>(input: T, deps: {
  now: () => number;
  stop: (provider: ProviderCleanupInput["provider"], providerSessionId: string, remainingMs: number) => Promise<void>;
  schedule: (delayMs: number, next: T) => Promise<void>;
}): Promise<"stopped" | "retry_scheduled" | "exhausted"> {
  const remainingMs = input.deadlineAt - deps.now();
  if (remainingMs <= 0 || input.attempt > MAX_CLEANUP_ATTEMPTS) return "exhausted";
  try {
    await deps.stop(input.provider, input.providerSessionId, remainingMs);
    return "stopped";
  } catch {
    const delayMs = Math.min(CLEANUP_RETRY_BASE_MS * input.attempt, 15_000);
    if (input.attempt >= MAX_CLEANUP_ATTEMPTS || deps.now() + delayMs >= input.deadlineAt) return "exhausted";
    await deps.schedule(delayMs, { ...input, attempt: input.attempt + 1 });
    return "retry_scheduled";
  }
}

async function stopProviderSession(ctx: ActionCtx, provider: ProviderCleanupInput["provider"], providerSessionId: string, remainingMs: number): Promise<void> {
  const requestTimeoutMs = Math.max(1, Math.min(30_000, remainingMs));
  if (provider === "firecrawl") {
    await new FirecrawlRoomScoutClient(components.firecrawlRoomScout).stopInteraction(ctx, providerSessionId, requestTimeoutMs);
    return;
  }
  const apiKey = process.env.BROWSERBASE_API_KEY?.trim();
  if (!apiKey) throw new Error("BROWSERBASE_CLEANUP_UNAVAILABLE");
  const client = new Browserbase({ apiKey, maxRetries: 0, timeout: requestTimeoutMs });
  await client.sessions.update(providerSessionId, { status: "REQUEST_RELEASE" });
  await ctx.runMutation(components.stagehandRoomScout.lib.updateSession, {
    sessionId: providerSessionId, status: "completed", endedAt: Date.now(),
  }).catch(() => undefined);
}

export async function scheduleProviderCleanup(ctx: ActionCtx, input: Omit<ProviderCleanupInput, "attempt" | "deadlineAt">): Promise<void> {
  await ctx.scheduler.runAfter(0, retryProviderCleanupRef, {
    ...input, attempt: 1, deadlineAt: Date.now() + CLEANUP_DEADLINE_MS,
  });
}

export async function scheduleExecutionCleanup(ctx: ActionCtx, input: Omit<ExecutionCleanupInput, "attempt" | "deadlineAt">): Promise<void> {
  await ctx.scheduler.runAfter(0, retryExecutionCleanupRef, { ...input, attempt: 1, deadlineAt: Date.now() + CLEANUP_DEADLINE_MS });
}

export async function scheduleContextCleanup(ctx: ActionCtx, input: {
  ownerId: Id<"users">; connectionId: Id<"portalConnections">; contextId: Id<"browserContexts">;
  provider: "firecrawl" | "browserbase"; providerSessionId: string;
  purpose: "write_proof" | "profile_proof" | "recovery";
}): Promise<void> {
  const deadlineAt = Date.now() + CLEANUP_DEADLINE_MS;
  const lease = await ctx.runMutation(internal.portalConnections.registerProviderCleanupLease, { ...input, deadlineAt });
  await ctx.scheduler.runAfter(0, retryLeaseCleanupRef, {
    cleanupId: lease.cleanupId, provider: input.provider, providerSessionId: input.providerSessionId,
    attempt: 1, deadlineAt,
  });
}

export const retryProviderCleanup = internalAction({
  args: {
    ownerId: v.id("users"), runId: v.id("browserRuns"),
    provider: v.union(v.literal("firecrawl"), v.literal("browserbase")),
    providerSessionId: v.string(), attempt: v.number(), deadlineAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const valid = await ctx.runQuery(internal.portalConnections.validateProviderCleanup, {
      ownerId: args.ownerId, runId: args.runId, provider: args.provider,
      providerSessionId: args.providerSessionId,
    });
    if (!valid) return null;
    await runProviderCleanupAttempt(args, {
      now: Date.now,
      stop: async (provider, providerSessionId, remainingMs) => await stopProviderSession(ctx, provider, providerSessionId, remainingMs),
      schedule: async (delayMs, next) => { await ctx.scheduler.runAfter(delayMs, retryProviderCleanupRef, next); },
    });
    return null;
  },
});

export const retryExecutionCleanup = internalAction({
  args: {
    ownerId: v.id("users"), executionId: v.id("actionExecutions"),
    provider: v.union(v.literal("firecrawl"), v.literal("browserbase")),
    providerSessionId: v.string(), attempt: v.number(), deadlineAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const valid = await ctx.runQuery(internal.portalConnections.validateExecutionProviderCleanup, {
      ownerId: args.ownerId, executionId: args.executionId, provider: args.provider, providerSessionId: args.providerSessionId,
    });
    if (!valid) return null;
    await runProviderCleanupAttempt(args, {
      now: Date.now,
      stop: async (provider, providerSessionId, remainingMs) => await stopProviderSession(ctx, provider, providerSessionId, remainingMs),
      schedule: async (delayMs, next) => {
        await ctx.scheduler.runAfter(delayMs, retryExecutionCleanupRef, {
          ownerId: args.ownerId, executionId: args.executionId, provider: next.provider,
          providerSessionId: next.providerSessionId, attempt: next.attempt, deadlineAt: next.deadlineAt,
        });
      },
    });
    return null;
  },
});

export const retryLeaseCleanup = internalAction({
  args: {
    cleanupId: v.id("providerCleanupLeases"),
    provider: v.union(v.literal("firecrawl"), v.literal("browserbase")),
    providerSessionId: v.string(), attempt: v.number(), deadlineAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const valid = await ctx.runQuery(internal.portalConnections.validateCleanupLease, {
      cleanupId: args.cleanupId, provider: args.provider, providerSessionId: args.providerSessionId, deadlineAt: args.deadlineAt,
    });
    if (!valid) return null;
    const result = await runProviderCleanupAttempt(args, {
      now: Date.now,
      stop: async (provider, providerSessionId, remainingMs) => await stopProviderSession(ctx, provider, providerSessionId, remainingMs),
      schedule: async (delayMs, next) => {
        await ctx.scheduler.runAfter(delayMs, retryLeaseCleanupRef, {
          cleanupId: args.cleanupId, provider: next.provider, providerSessionId: next.providerSessionId,
          attempt: next.attempt, deadlineAt: next.deadlineAt,
        });
      },
    });
    if (result !== "retry_scheduled") await ctx.runMutation(internal.portalConnections.finishCleanupLease, {
      cleanupId: args.cleanupId, provider: args.provider, providerSessionId: args.providerSessionId,
      outcome: result === "stopped" ? "completed" : "exhausted",
    });
    return null;
  },
});
