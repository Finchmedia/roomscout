/// <reference types="vite/client" />
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api.js";
import { initConvexTest, mockFetch } from "./setup.test.js";

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

  test("does not automatically replay a mutating Interact program", async () => {
    const t = initConvexTest();
    const { calls } = mockFetch([
      { status: 429, body: { success: false, error: "rate limited" } },
      { body: { success: true, result: "would be a duplicate submission" } },
    ]);

    await expect(
      t.action(api.interact.execute, {
        jobId: "job-1",
        prompt: "Submit the approved form",
        mutating: true,
      }),
    ).rejects.toThrow();

    expect(calls).toHaveLength(1);
  });
});

