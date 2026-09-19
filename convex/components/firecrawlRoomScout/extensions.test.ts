/// <reference types="vite/client" />
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api.js";
import { initConvexTest, mockFetch } from "./setup.testSupport.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Native Monitoring extension", () => {
  test("creates a monitor without retrying and unwraps data", async () => {
    const t = initConvexTest();
    const { calls } = mockFetch([
      { body: { success: true, data: { id: "monitor-1" } } },
    ]);

    await expect(
      t.action(api.monitor.create, {
        request: {
          url: "https://example.com/listings",
          frequency: "daily",
        },
      }),
    ).resolves.toEqual({ id: "monitor-1" });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      url: "https://api.firecrawl.dev/v2/monitor",
      method: "POST",
      body: {
        origin: "firecrawl-convex",
        url: "https://example.com/listings",
        frequency: "daily",
      },
    });
  });

  test("encodes monitor/check ids and forwards bounded pagination", async () => {
    const t = initConvexTest();
    const { calls } = mockFetch([
      { body: { success: true, data: { changes: [] } } },
    ]);

    await t.action(api.monitor.getCheck, {
      monitorId: "monitor/one",
      checkId: "check?two",
      limit: 5,
      skip: 10,
    });

    expect(calls[0].url).toBe(
      "https://api.firecrawl.dev/v2/monitor/monitor%2Fone/checks/check%3Ftwo?limit=5&skip=10",
    );
  });

  test("retrieves the exact scrape artifact referenced by a monitor page", async () => {
    const t = initConvexTest();
    const { calls } = mockFetch([
      {
        body: {
          success: true,
          data: { changeTracking: { json: { entries: [] } } },
        },
      },
    ]);

    await expect(
      t.action(api.monitor.getScrape, { scrapeId: "scrape/one" }),
    ).resolves.toEqual({ changeTracking: { json: { entries: [] } } });
    expect(calls[0]).toEqual({
      url: "https://api.firecrawl.dev/v2/scrape/scrape%2Fone",
      method: "GET",
      body: undefined,
    });
  });
});

describe("Interact extension", () => {
  test("sends normalized Interact programs to the scrape job endpoint", async () => {
    const t = initConvexTest();
    const { calls } = mockFetch([
      { body: { success: true, result: { url: "https://example.com/form" } } },
    ]);

    await t.action(api.interact.execute, {
      jobId: "scrape/job",
      code: "  return document.title; ",
      language: "node",
      timeout: 30,
      mutating: false,
    });

    expect(calls[0]).toEqual({
      url: "https://api.firecrawl.dev/v2/scrape/scrape%2Fjob/interact",
      method: "POST",
      body: {
        origin: "firecrawl-convex",
        code: "return document.title;",
        language: "node",
        timeout: 30,
      },
    });
  });

  test("normalizes owned marker output and keeps the provider error channels closed", async () => {
    const t = initConvexTest();
    mockFetch([{ body: {
      success: true, result: "undefined", exitCode: 0,
      stdout: 'provider diagnostic\n__ROOMSCOUT_RESULT__{"stage":"sign_up"}\nmore diagnostics',
      stderr: "sensitive stderr",
      error: "sensitive error",
    } }]);

    const envelope = await t.action(api.interact.execute, {
      jobId: "job-1", code: "return { stage: 'sign_up' };", mutating: false,
    });

    // The marker line is the result; the stdout tail travels with it so the
    // app-layer parser can scan for the marker itself and diagnostics survive.
    expect(envelope).toMatchObject({ success: true, result: '{"stage":"sign_up"}', exitCode: 0 });
    expect(envelope.stdout).toContain("more diagnostics");
    expect(JSON.stringify(envelope)).not.toContain("sensitive");
  });

  test("does not automatically replay a mutating Interact program", async () => {
    const t = initConvexTest();
    const { calls } = mockFetch([
      { status: 429, body: { success: false, error: "rate limited" } },
      { body: { success: true, result: "would be a duplicate submission" } },
    ]);

    const failure = await t.action(api.interact.execute, {
      jobId: "job-1",
      prompt: "Submit the approved form",
      mutating: true,
    }).catch((error: unknown) => error);
    expect(String(failure)).toContain("Firecrawl request failed");
    expect(String(failure)).not.toContain("rate limited");

    expect(calls).toHaveLength(1);
  });

  test("retries a transient 409 while initializing a read-only Interact session", async () => {
    const t = initConvexTest();
    const { calls } = mockFetch([
      { status: 409, body: { success: false, error: "session initializing" } },
      { body: { success: true, result: "{\"ready\":true}", exitCode: 0 } },
    ]);
    await expect(t.action(api.interact.execute, {
      jobId: "job-1", code: "return { ready: true };", mutating: false,
    })).resolves.toMatchObject({ success: true, exitCode: 0 });
    expect(calls).toHaveLength(2);
  });

  test("does not replay a mutating Interact program after a 409", async () => {
    const t = initConvexTest();
    const { calls } = mockFetch([
      { status: 409, body: { success: false, error: "busy" } },
      { body: { success: true, result: "duplicate" } },
    ]);
    await expect(t.action(api.interact.execute, {
      jobId: "job-1", code: "return { submitted: true };", mutating: true,
    })).rejects.toThrow("Firecrawl request failed");
    expect(calls).toHaveLength(1);
  });

  test("treats stop 404 as an idempotent already-stopped result", async () => {
    const t = initConvexTest();
    const { calls } = mockFetch([{ status: 404, body: { success: false, error: "gone" } }]);
    await expect(t.action(api.interact.stop, { jobId: "job-1" }))
      .resolves.toEqual({ success: true, alreadyStopped: true });
    expect(calls).toHaveLength(1);
  });

  test("does not replay a mutating program after a transport failure", async () => {
    const t = initConvexTest();
    const fetch = vi.fn()
      .mockRejectedValueOnce(new Error("synthetic-secret transport detail"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true })));
    vi.stubGlobal("fetch", fetch);

    const failure = await t.action(api.interact.execute, {
      jobId: "job-1",
      code: "return { ok: true };",
      mutating: true,
    }).catch((error: unknown) => error);
    expect(String(failure)).toContain("Firecrawl request failed");
    expect(String(failure)).not.toContain("synthetic-secret");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test("aborts a mutating Interact HTTP request at the millisecond deadline without replay", async () => {
    const t = initConvexTest();
    const fetch = vi.fn((_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }));
    vi.stubGlobal("fetch", fetch);

    const failure = await t.action(api.interact.execute, {
      jobId: "job-1",
      code: "return { ok: true };",
      timeout: 30,
      requestTimeoutMs: 5,
      mutating: true,
    }).catch((error: unknown) => error);

    expect(String(failure)).toContain("Firecrawl request failed");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  test("keeps the HTTP deadline active while consuming the response body", async () => {
    const t = initConvexTest();
    const fetch = vi.fn((_url: string, init?: RequestInit) => Promise.resolve({
      text: () => new Promise<string>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }),
    } as Response));
    vi.stubGlobal("fetch", fetch);

    await expect(t.action(api.interact.execute, {
      jobId: "job-1",
      code: "return { ok: true };",
      requestTimeoutMs: 5,
      mutating: true,
    })).rejects.toThrow("Firecrawl request failed");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test("optionally returns HTTP 200 unsuccessful envelopes for safe parsing", async () => {
    const t = initConvexTest();
    mockFetch([{ body: { success: false, error: "synthetic-secret" } }]);
    await expect(
      t.action(api.interact.execute, {
        jobId: "job-1",
        code: "return { ok: true };",
        mutating: true,
        allowUnsuccessfulBody: true,
      }),
    ).resolves.toEqual({ success: false });
  });
});
