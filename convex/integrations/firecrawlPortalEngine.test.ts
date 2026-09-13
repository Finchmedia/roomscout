import { describe, expect, it, vi } from "vitest";
import { readFirecrawlPortalInboxBatch } from "./firecrawlPortalEngine";
import type { FirecrawlPortalSession } from "./firecrawlPortalRuntime";

describe("firecrawlPortalEngine", () => {
  it("runs one bounded program and returns explicit partial state", async () => {
    const runProgram = vi.fn(async (...args: Parameters<FirecrawlPortalSession["runProgram"]>) => {
      void args;
      return ({
      threads: [{
        providerThreadId: "thread_1", subject: "Room", participants: ["Owner"],
        lastMessageAt: 42,
        messages: [{ providerMessageId: "message_1", direction: "inbound", bodyText: "Available", sentAt: 42 }],
      }],
      missingThreadIds: ["thread_2"], failedThreadIds: ["thread_3"],
      bodyTruncatedThreadIds: [],
      historyTruncatedThreadIds: [],
      discoveredThreadIds: ["thread_1", "thread_2", "thread_3"],
      truncated: true, timedOut: false, nextOffset: 0,
      });
    });
    const result = await readFirecrawlPortalInboxBatch({
      session: { runProgram } as unknown as FirecrawlPortalSession,
      requestedThreadIds: ["thread_3", "thread_3"], startOffset: 2,
      maxThreads: 3, navigationTimeoutMs: 5_000, overallTimeoutMs: 20_000,
    });
    expect(result).toMatchObject({ truncated: true, failedThreadIds: ["thread_3"] });
    expect(runProgram).toHaveBeenCalledOnce();
    const [body, vars, mutating, timeout] = runProgram.mock.calls[0]!;
    expect(body).toContain('timeout: vars.limits.navigationTimeoutMs');
    expect(body).toContain('new URL(await page.url()).origin');
    expect(vars.requestedThreadIds).toEqual(["thread_3"]);
    expect(mutating).toBe(false);
    expect(timeout).toBe(20_000);
  });

  it("reads the latest bounded message window and reports omitted history", async () => {
    const runProgram = vi.fn(async (...args: Parameters<FirecrawlPortalSession["runProgram"]>) => {
      void args;
      return ({
      threads: [], missingThreadIds: [], failedThreadIds: [], bodyTruncatedThreadIds: [],
      historyTruncatedThreadIds: ["thread_1"], discoveredThreadIds: ["thread_1"],
      truncated: true, timedOut: false, nextOffset: 0,
      });
    });
    const result = await readFirecrawlPortalInboxBatch({ session: { runProgram } as unknown as FirecrawlPortalSession });
    const [body] = runProgram.mock.calls[0]!;
    expect(body).toContain("allMessageRows.slice(-maxMessages)");
    expect(body).toContain("allMessageRows.length > maxMessages");
    expect(result).toMatchObject({ historyTruncatedThreadIds: ["thread_1"], truncated: true });
  });

  it("rejects malformed ids before browser execution", async () => {
    const runProgram = vi.fn();
    await expect(readFirecrawlPortalInboxBatch({
      session: { runProgram } as unknown as FirecrawlPortalSession,
      requestedThreadIds: ["../escape"],
    })).rejects.toThrow();
    expect(runProgram).not.toHaveBeenCalled();
  });

  it("maps malformed provider output to one safe error", async () => {
    const runProgram = vi.fn(async () => ({ threads: "secret provider body" }));
    await expect(readFirecrawlPortalInboxBatch({
      session: { runProgram } as unknown as FirecrawlPortalSession,
    })).rejects.toThrow("FIRECRAWL_PORTAL_READ_RESULT_INVALID");
  });
});
