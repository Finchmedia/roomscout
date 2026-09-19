import { getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";
import { describe, expect, it, vi } from "vitest";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import { runFirecrawlWriteWorker } from "./firecrawlPortal";

const ownerId = "owner" as Id<"users">;
const requestId = "request" as Id<"actionRequests">;
const redispatch = getFunctionName(internal.externalActions.redispatchApproved);

function workerContext() {
  const runAfter = vi.fn(async (..._args: unknown[]) => "scheduled");
  return {
    ctx: { scheduler: { runAfter } } as unknown as ActionCtx,
    runAfter,
    scheduledTarget: () => getFunctionName(runAfter.mock.calls[0]![1] as Parameters<typeof getFunctionName>[0]),
  };
}

describe("Firecrawl approved-write worker contention", () => {
  it("retries bounded pre-claim browser contention through the shared pool", async () => {
    const { ctx, runAfter, scheduledTarget } = workerContext();
    const execute = vi.fn(async () => {
      throw new ConvexError({ code: "BROWSER_SESSION_BUSY" });
    });

    await expect(runFirecrawlWriteWorker(ctx, { ownerId, requestId, busyAttempt: 2 }, execute))
      .rejects.toThrow("BROWSER_SESSION_BUSY");
    expect(runAfter).toHaveBeenCalledOnce();
    expect(runAfter).toHaveBeenCalledWith(8_000, expect.anything(), {
      ownerId, requestId, busyAttempt: 3,
    });
    // The busy chain re-enters the pool via redispatchApproved, never the worker beside it.
    expect(scheduledTarget()).toBe(redispatch);

    runAfter.mockClear();
    await expect(runFirecrawlWriteWorker(ctx, { ownerId, requestId, busyAttempt: 5 }, execute))
      .rejects.toThrow("BROWSER_SESSION_BUSY");
    expect(runAfter).not.toHaveBeenCalled();
  });

  it("retries post-claim context contention only once the claim was released", async () => {
    const { ctx, runAfter, scheduledTarget } = workerContext();
    const execute = vi.fn(async () => {
      throw new ConvexError({ code: "BROWSER_CONTEXT_BUSY", released: true });
    });

    await expect(runFirecrawlWriteWorker(ctx, { ownerId, requestId, busyAttempt: 2 }, execute))
      .rejects.toThrow("BROWSER_CONTEXT_BUSY");
    expect(runAfter).toHaveBeenCalledOnce();
    expect(runAfter).toHaveBeenCalledWith(8_000, expect.anything(), { ownerId, requestId, busyAttempt: 3 });
    expect(scheduledTarget()).toBe(redispatch);
  });

  it("does not retry post-claim context contention whose claim still stands", async () => {
    for (const data of [{ code: "BROWSER_CONTEXT_BUSY", released: false }, { code: "BROWSER_CONTEXT_BUSY" }]) {
      const { ctx, runAfter } = workerContext();
      const execute = vi.fn(async () => {
        throw new ConvexError(data);
      });

      await expect(runFirecrawlWriteWorker(ctx, { ownerId, requestId }, execute))
        .rejects.toThrow("BROWSER_CONTEXT_BUSY");
      expect(runAfter).not.toHaveBeenCalled();
    }
  });

  it("returns post-claim unknown outcomes without scheduling another attempt", async () => {
    const { ctx, runAfter } = workerContext();
    const result = {
      executionId: "execution" as Id<"actionExecutions">,
      status: "unknown" as const,
      alreadyCompleted: true,
    };

    await expect(runFirecrawlWriteWorker(ctx, { ownerId, requestId }, vi.fn(async () => result)))
      .resolves.toEqual(result);
    expect(runAfter).not.toHaveBeenCalled();
  });
});
