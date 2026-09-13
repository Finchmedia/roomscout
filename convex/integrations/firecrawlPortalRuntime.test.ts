import { describe, expect, it, vi } from "vitest";
import { createFirecrawlPortalSession, firecrawlComponentPortalTransport, type FirecrawlPortalTransport } from "./firecrawlPortalRuntime";
import type { FirecrawlRoomScoutClient } from "../components/firecrawlRoomScout/client";

function successful(result: unknown, liveViewUrl?: string) {
  return { success: true, exitCode: 0, killed: false, result, ...(liveViewUrl ? { liveViewUrl } : {}) };
}

describe("firecrawlPortalRuntime", () => {
  it("converts a 30000ms runtime budget to 30 Interact seconds at the component boundary", async () => {
    const scrapeOnce = vi.fn(async () => ({ metadata: { scrapeId: "scrape_1" } }));
    const interact = vi.fn(async (_ctx: unknown, _id: string, _options: { code: string }) =>
      {
        void _ctx; void _id; void _options;
        return successful({ url: "https://roomscout.dev/inbox" });
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
    await session.primitives.navigate({ url: "https://roomscout.dev/inbox" });

    expect(scrapeOnce).toHaveBeenCalledWith(expect.anything(), "https://roomscout.dev/inbox", expect.objectContaining({
      timeout: 30_000, maxAge: 0, storeInCache: false,
    }), 30_000);
    expect(interact).toHaveBeenCalledWith(expect.anything(), "scrape_1", expect.objectContaining({
      timeout: 30,
      requestTimeoutMs: 30_000,
      mutating: false,
    }));
    const code = interact.mock.calls[0]?.[2]?.code;
    expect(code).toContain('"timeoutMs":30000');
  });

  it("creates one reviewed scrape with the stable profile and stops idempotently", async () => {
    const transport: FirecrawlPortalTransport = {
      scrape: vi.fn(async () => ({ metadata: { scrapeId: "scrape_1" } })),
      interact: vi.fn(async () => successful({ url: "https://roomscout.dev/inbox" }, "https://liveview.firecrawl.dev/session")),
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

  it("puts a fresh origin assertion inside every fill and click program", async () => {
    const programs: Array<{ code: string; mutating: boolean }> = [];
    const transport: FirecrawlPortalTransport = {
      scrape: async () => ({ metadata: { scrapeId: "scrape_1" } }),
      interact: async (_id, options) => {
        programs.push(options);
        return successful({ ok: true });
      },
      stop: async () => ({}),
    };
    const session = await createFirecrawlPortalSession({
      transport, url: "https://roomscout.dev", profileName: "profile_1", saveChanges: false,
    });
    await session.primitives.fillSelector?.({ selector: "#field", value: "synthetic-secret" });
    await session.primitives.clickSelector?.({ selector: "#submit" });
    expect(programs).toHaveLength(2);
    for (const program of programs) {
      expect(program.mutating).toBe(true);
      expect(program.code.indexOf("await page.url()"))
        .toBeLessThan(program.code.indexOf("page.locator"));
      expect(program.code).toContain('page.locator(vars.selector).');
      expect(program.code).not.toContain('.fill("synthetic-secret")');
    }
  });

  it("coerces protected-page DOM evidence to a boolean auth result", async () => {
    let extractProgram = "";
    const session = await createFirecrawlPortalSession({
      transport: {
        scrape: async () => ({ metadata: { scrapeId: "scrape_1" } }),
        interact: async (_id, options) => {
          extractProgram = options.code;
          return successful({ authenticated: false, stage: "sign_in", blocker: null });
        },
        stop: async () => ({}),
      },
      url: "https://roomscout.dev/sign-in", profileName: "profile_1", saveChanges: false,
    });
    await session.primitives.extract({
      instruction: "classify",
      schema: { parse: (value: unknown) => value } as never,
    });
    expect(extractProgram).toContain("const auth = Boolean(");
    expect(extractProgram).toContain("document.querySelector");
  });

  it("shares one absolute deadline and refuses a later primitive before dispatch", async () => {
    let now = 1_000;
    const interact = vi.fn(async () => successful({ url: "https://roomscout.dev/inbox" }));
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
    await session.primitives.getUrl();
    expect(interact).toHaveBeenCalledTimes(1);
    now = 31_000;
    await expect(session.primitives.getUrl()).rejects.toThrow("FIRECRAWL_PORTAL_DEADLINE_EXCEEDED");
    expect(interact).toHaveBeenCalledTimes(1);
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
