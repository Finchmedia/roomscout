import { describe, expect, it, vi } from "vitest";
import {
  createFirecrawlPortalSession,
  firecrawlComponentPortalTransport,
  FIRECRAWL_PORTAL_URL_PROGRAM,
  type FirecrawlPortalTransport,
} from "./firecrawlPortalRuntime";
import type { FirecrawlRoomScoutClient } from "../components/firecrawlRoomScout/client";

function successful(code: string, result: unknown, liveViewUrl?: string) {
  const completionKey = code.match(/__roomscoutRun_[A-Za-z0-9_-]+/)?.[0];
  const completed = completionKey === undefined ? result : {
    __roomscoutCompletion: { id: completionKey, state: "done", value: result },
  };
  return { success: true, exitCode: 0, killed: false, result: completed, ...(liveViewUrl ? { liveViewUrl } : {}) };
}

describe("firecrawlPortalRuntime", () => {
  it("converts a 30000ms runtime budget to 30 Interact seconds at the component boundary", async () => {
    const scrapeOnce = vi.fn(async () => ({ metadata: { scrapeId: "scrape_1" } }));
    const interact = vi.fn(async (_ctx: unknown, _id: string, _options: { code: string }) =>
      {
        void _ctx; void _id; void _options;
        return successful(_options.code, { url: "https://roomscout.dev/inbox" });
      });
    const stopInteraction = vi.fn(async () => ({}));
    const transport = firecrawlComponentPortalTransport({
      ctx: {} as never,
      client: { scrapeOnce, interact, stopInteraction } as unknown as FirecrawlRoomScoutClient,
    });
    const session = await createFirecrawlPortalSession({
      transport,
      url: "https://roomscout.dev/inbox",
      profileName: "profile_1",
      saveChanges: true,
      timeoutMs: 30_000,
      now: () => 1_000,
    });
    await session.runProgram("return { url: await page.url() };", { path: "/inbox" }, false);

    expect(scrapeOnce).toHaveBeenCalledWith(expect.anything(), "https://roomscout.dev/inbox", expect.objectContaining({
      timeout: 30_000, maxAge: 0, storeInCache: false,
    }), 30_000);
    expect(interact).toHaveBeenCalledWith(expect.anything(), "scrape_1", expect.objectContaining({
      timeout: 30,
      requestTimeoutMs: 30_000,
      mutating: false,
    }));
    const code = interact.mock.calls[0]?.[2]?.code;
    expect(code).toContain('"path":"/inbox"');
  });

  it("creates one reviewed scrape with the stable profile and stops idempotently", async () => {
    const transport: FirecrawlPortalTransport = {
      scrape: vi.fn(async () => ({ metadata: { scrapeId: "scrape_1" } })),
      interact: vi.fn(async (_id, options) => successful(options.code, { url: "https://roomscout.dev/inbox" }, "https://liveview.firecrawl.dev/session")),
      stop: vi.fn(async () => ({})),
    };
    const session = await createFirecrawlPortalSession({
      transport, url: "https://roomscout.dev/inbox", profileName: "profile_1",
      saveChanges: true, timeoutMs: 10_000, now: () => 42,
    });
    expect(session).toMatchObject({ scrapeId: "scrape_1", profileName: "profile_1", openedAt: 42 });
    expect(transport.scrape).toHaveBeenCalledWith({
      url: "https://roomscout.dev/inbox", profileName: "profile_1",
      saveChanges: true, timeoutMs: 10_000,
    });
    await expect(session.liveView()).resolves.toBe("https://liveview.firecrawl.dev/session");
    await Promise.all([session.stop(), session.stop()]);
    expect(transport.stop).toHaveBeenCalledOnce();
  });

  it("keeps exact values out of the program text and inside the injected variables", async () => {
    const programs: Array<{ code: string; mutating: boolean }> = [];
    const transport: FirecrawlPortalTransport = {
      scrape: async () => ({ metadata: { scrapeId: "scrape_1" } }),
      interact: async (_id, options) => {
        programs.push(options);
        return successful(options.code, { ok: true });
      },
      stop: async () => ({}),
    };
    const session = await createFirecrawlPortalSession({
      transport, url: "https://roomscout.dev", profileName: "profile_1", saveChanges: false,
    });
    await session.runProgram(
      "await page.locator(vars.selector).fill(vars.value);\n    return { ok: true };",
      { selector: "#field", value: "synthetic-secret" },
      true,
    );
    expect(programs).toHaveLength(1);
    const [program] = programs;
    expect(program!.mutating).toBe(true);
    expect(program!.code).toContain("page.locator(vars.selector).fill(vars.value)");
    expect(program!.code).not.toContain('.fill("synthetic-secret")');
    // The value travels once, as a JSON variable of the wrapper.
    expect(program!.code).toContain('"value":"synthetic-secret"');
  });

  it("gives every program its own sandbox budget and the request thirty seconds more", async () => {
    const dispatched: unknown[] = [];
    const interact = vi.fn(async (_scrapeId: string, options: { code: string }) => {
      dispatched.push(options);
      return successful(options.code, { ok: true });
    });
    const session = await createFirecrawlPortalSession({
      transport: { scrape: async () => ({ metadata: { scrapeId: "scrape_1" } }), interact, stop: async () => ({}) },
      url: "https://roomscout.dev", profileName: "profile_1", saveChanges: false,
      timeoutMs: 420_000, now: () => 1_000,
    });
    await session.runProgram("return { ok: true };", {}, false, 60_000);
    await session.runProgram("return { ok: true };", {}, true, 90_000);
    expect(dispatched).toEqual([
      expect.objectContaining({ timeout: 60, requestTimeoutMs: 90_000, mutating: false }),
      expect.objectContaining({ timeout: 90, requestTimeoutMs: 120_000, mutating: true }),
    ]);
  });

  it("caps one program at two minutes even inside a long registration session", async () => {
    const interact = vi.fn(async (_id: string, options: { code: string }) => successful(options.code, { ok: true }));
    const session = await createFirecrawlPortalSession({
      transport: { scrape: async () => ({ metadata: { scrapeId: "scrape_1" } }), interact, stop: async () => ({}) },
      url: "https://roomscout.dev", profileName: "profile_1", saveChanges: true,
      timeoutMs: 420_000, now: () => 1_000,
    });
    await session.runProgram("return { ok: true };", {}, false);
    expect(interact).toHaveBeenCalledWith("scrape_1", expect.objectContaining({ timeout: 120 }));
    await expect(session.runProgram("return { ok: true };", {}, false, 300_000))
      .rejects.toThrow("FIRECRAWL_PORTAL_TIMEOUT_INVALID");
  });

  it("refuses a session budget beyond ten minutes", async () => {
    const scrape = vi.fn(async () => ({ metadata: { scrapeId: "unused" } }));
    await expect(createFirecrawlPortalSession({
      transport: { scrape, interact: vi.fn(), stop: vi.fn() },
      url: "https://roomscout.dev", profileName: "profile_1", saveChanges: false, timeoutMs: 900_000,
    })).rejects.toThrow("FIRECRAWL_PORTAL_TIMEOUT_INVALID");
    expect(scrape).not.toHaveBeenCalled();
  });

  it("shares one absolute deadline and refuses a later program before dispatch", async () => {
    let now = 1_000;
    const interact = vi.fn(async (_id: string, options: { code: string }) => successful(options.code, { url: "https://roomscout.dev/inbox" }));
    const session = await createFirecrawlPortalSession({
      transport: {
        scrape: async () => ({ metadata: { scrapeId: "scrape_1" } }),
        interact,
        stop: async () => ({}),
      },
      url: "https://roomscout.dev/inbox",
      profileName: "profile_1",
      saveChanges: false,
      timeoutMs: 30_000,
      now: () => now,
    });
    await session.runProgram(FIRECRAWL_PORTAL_URL_PROGRAM, {}, false);
    expect(interact).toHaveBeenCalledTimes(1);
    now = 31_000;
    await expect(session.runProgram(FIRECRAWL_PORTAL_URL_PROGRAM, {}, false)).rejects.toThrow("FIRECRAWL_PORTAL_DEADLINE_EXCEEDED");
    expect(interact).toHaveBeenCalledTimes(1);
  });

  it("still stops the provider session after the run budget is exhausted", async () => {
    let now = 1_000;
    const stop = vi.fn(async () => ({}));
    const session = await createFirecrawlPortalSession({
      transport: { scrape: async () => ({ metadata: { scrapeId: "scrape_1" } }), interact: vi.fn(), stop },
      url: "https://roomscout.dev", profileName: "profile_1", saveChanges: true, timeoutMs: 10_000, now: () => now,
    });
    now = 50_000;
    await expect(session.stop()).resolves.toBeUndefined();
    expect(stop).toHaveBeenCalledWith("scrape_1", 20_000);
  });

  it("spaces Interact requests by the configured minimum interval", async () => {
    const dispatchedAt: number[] = [];
    const session = await createFirecrawlPortalSession({
      transport: {
        scrape: async () => ({ metadata: { scrapeId: "scrape_1" } }),
        interact: async (_id, options) => { dispatchedAt.push(Date.now()); return successful(options.code, { ok: true }); },
        stop: async () => ({}),
      },
      url: "https://roomscout.dev", profileName: "profile_1", saveChanges: false, timeoutMs: 30_000,
      pacing: { minIntervalMs: 60 },
    });
    await session.runProgram("return { ok: true };", {}, true);
    await session.runProgram("return { ok: true };", {}, true);
    expect(dispatchedAt).toHaveLength(2);
    for (let index = 1; index < dispatchedAt.length; index += 1) {
      expect(dispatchedAt[index]! - dispatchedAt[index - 1]!).toBeGreaterThanOrEqual(55);
    }
  });

  it("polls one correlated completion without repeating a mutating program", async () => {
    const calls: Array<{ code: string; mutating: boolean }> = [];
    let poll = 0;
    const session = await createFirecrawlPortalSession({
      transport: {
        scrape: async () => ({ metadata: { scrapeId: "scrape_1" } }),
        interact: async (_id, options) => {
          calls.push({ code: options.code, mutating: options.mutating });
          const key = options.code.match(/__roomscoutRun_[A-Za-z0-9_-]+/)?.[0];
          if (options.mutating) return { success: true, exitCode: 0, killed: false, result: "1", stdout: "" };
          poll += 1;
          if (poll === 1) {
            return { success: true, exitCode: 0, killed: false, result: {
              __roomscoutCompletion: { id: "__roomscoutRun_stale", state: "done", value: { stale: true } },
            } };
          }
          if (poll === 2) {
            return { success: true, exitCode: 0, killed: false, result: {
              __roomscoutCompletion: { id: key, state: "pending" },
            } };
          }
          return { success: true, exitCode: 0, killed: false, result: {
            __roomscoutCompletion: { id: key, state: "done", value: { receipt: "sent" } },
          } };
        },
        stop: async () => ({}),
      },
      url: "https://roomscout.dev",
      profileName: "profile_1",
      saveChanges: false,
      timeoutMs: 5_000,
    });

    await expect(session.runProgram("return { receipt: 'sent' };", {}, true, 2_000))
      .resolves.toEqual({ receipt: "sent" });
    expect(calls.filter((call) => call.mutating)).toHaveLength(1);
    expect(calls.filter((call) => call.code.includes("return { receipt: 'sent' };"))).toHaveLength(1);
    expect(calls.filter((call) => !call.mutating && !call.code.includes("delete globalThis"))).toHaveLength(3);
    expect(calls.at(-1)?.code).not.toContain("return { receipt: 'sent' };");
  });

  it("bounds a missing completion by the original program deadline", async () => {
    let now = 0;
    const session = await createFirecrawlPortalSession({
      transport: {
        scrape: async () => ({ metadata: { scrapeId: "scrape_1" } }),
        interact: async () => {
          now = 3_000;
          return { success: true, exitCode: 0, killed: false, result: "1", stdout: "" };
        },
        stop: async () => ({}),
      },
      url: "https://roomscout.dev",
      profileName: "profile_1",
      saveChanges: false,
      timeoutMs: 5_000,
      now: () => now,
    });

    await expect(session.runProgram("return { ok: true };", {}, false, 2_000))
      .rejects.toThrow("FIRECRAWL_PORTAL_COMPLETION_TIMEOUT");
    expect(session.lastErrorCode()).toBe("FIRECRAWL_PORTAL_COMPLETION_TIMEOUT");
  });

  it("names a profile write lock instead of a generic rejection", async () => {
    const busy = Object.assign(new Error("Firecrawl request failed."), { data: { code: "firecrawl_request_failed", status: 409 } });
    const session = await createFirecrawlPortalSession({
      transport: { scrape: async () => ({ metadata: { scrapeId: "scrape_1" } }), interact: async () => { throw busy; }, stop: async () => ({}) },
      url: "https://roomscout.dev", profileName: "profile_1", saveChanges: true,
    });
    await expect(session.runProgram(FIRECRAWL_PORTAL_URL_PROGRAM, {}, false))
      .rejects.toThrow("FIRECRAWL_PORTAL_INTERACT_PROFILE_BUSY");
    expect(session.lastErrorCode()).toBe("FIRECRAWL_PORTAL_INTERACT_PROFILE_BUSY");
  });

  it("rejects other origins before allocating a scrape", async () => {
    const scrape = vi.fn(async () => ({ metadata: { scrapeId: "unused" } }));
    await expect(createFirecrawlPortalSession({
      transport: { scrape, interact: vi.fn(), stop: vi.fn() },
      url: "https://evil.example", profileName: "profile_1", saveChanges: false,
    })).rejects.toThrow("PORTAL_URL_NOT_ALLOWED");
    expect(scrape).not.toHaveBeenCalled();
  });

  it("does not expose transport error details", async () => {
    await expect(createFirecrawlPortalSession({
      transport: {
        scrape: async () => { throw new Error("synthetic-secret-provider-body"); },
        interact: vi.fn(), stop: vi.fn(),
      },
      url: "https://roomscout.dev", profileName: "profile_1", saveChanges: false,
    })).rejects.toThrow("FIRECRAWL_PORTAL_SCRAPE_TRANSPORT_FAILED");
  });
});
