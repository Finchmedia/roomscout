/// <reference types="vite/client" />
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api.js";
import { initConvexTest, mockFetch, TEST_API_KEY } from "./setup.testSupport.js";
import { withExtra } from "./lib.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("scrape", () => {
  test("posts to /v2/scrape and returns the document", async () => {
    const t = initConvexTest();
    const { calls } = mockFetch([
      { body: { success: true, data: { markdown: "# Hi", metadata: { url: "https://a.com" } } } },
    ]);

    const document = await t.action(api.lib.scrape, {
      url: "https://a.com",
      options: { formats: ["markdown"], onlyMainContent: true },
    });

    expect(document).toEqual({
      markdown: "# Hi",
      metadata: { url: "https://a.com" },
    });
    expect(calls[0].url).toBe("https://api.firecrawl.dev/v2/scrape");
    expect(calls[0].method).toBe("POST");
    expect(calls[0].body).toEqual({
      origin: "firecrawl-convex",
      url: "https://a.com",
      formats: ["markdown"],
      onlyMainContent: true,
    });
  });

  test("sends the API key as a bearer token", async () => {
    const t = initConvexTest();
    const { fetchMock } = mockFetch([{ body: { success: true, data: {} } }]);

    await t.action(api.lib.scrape, { url: "https://a.com" });

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.headers?.Authorization).toBe(`Bearer ${TEST_API_KEY}`);
  });

  test("surfaces fixed API errors with status but not provider content", async () => {
    const t = initConvexTest();
    mockFetch([{ status: 402, body: { success: false, error: "Insufficient credits" } }]);

    const error = await t.action(api.lib.scrape, { url: "https://a.com" })
      .catch((value: unknown) => value);
    expect(String(error)).toContain("firecrawl_request_failed");
    expect(String(error)).toContain("402");
    expect(String(error)).not.toContain("Insufficient credits");
  });

  test("retries a 429 and succeeds", async () => {
    const t = initConvexTest();
    const { calls } = mockFetch([
      { status: 429, body: { success: false, error: "rate limited" } },
      { body: { success: true, data: { markdown: "ok" } } },
    ]);

    const document = await t.action(api.lib.scrape, { url: "https://a.com" });

    expect(document).toEqual({ markdown: "ok" });
    expect(calls).toHaveLength(2);
  });

  test("does not retry a 400", async () => {
    const t = initConvexTest();
    const { calls } = mockFetch([
      { status: 400, body: { success: false, error: "bad url" } },
    ]);

    const error = await t.action(api.lib.scrape, { url: "not-a-url" })
      .catch((value: unknown) => value);
    expect(String(error)).toContain("firecrawl_request_failed");
    expect(String(error)).toContain("400");
    expect(String(error)).not.toContain("bad url");
    expect(calls).toHaveLength(1);
  });
});

describe("map", () => {
  test("normalizes string links into objects", async () => {
    const t = initConvexTest();
    mockFetch([
      {
        body: {
          success: true,
          id: "map-1",
          links: ["https://a.com/one", { url: "https://a.com/two", title: "Two" }],
        },
      },
    ]);

    const result = await t.action(api.lib.map, {
      url: "https://a.com",
      options: { limit: 10 },
    });

    expect(result).toEqual({
      id: "map-1",
      links: [
        { url: "https://a.com/one" },
        { url: "https://a.com/two", title: "Two" },
      ],
    });
  });
});

describe("search", () => {
  test("returns the source-grouped results", async () => {
    const t = initConvexTest();
    const { calls } = mockFetch([
      { body: { success: true, data: { web: [{ url: "https://a.com" }] } } },
    ]);

    const result = await t.action(api.lib.search, {
      query: "firecrawl convex",
      options: { limit: 3, scrapeOptions: { formats: ["markdown"] } },
    });

    expect(result).toEqual({ web: [{ url: "https://a.com" }] });
    expect(calls[0].body).toEqual({
      origin: "firecrawl-convex",
      query: "firecrawl convex",
      limit: 3,
      scrapeOptions: { formats: ["markdown"] },
    });
  });
});

describe("withExtra", () => {
  test("merges extra at the top level and inside scrapeOptions", () => {
    expect(
      withExtra({
        limit: 2,
        extra: { experimentalFlag: true },
        scrapeOptions: { formats: ["markdown"], extra: { newOption: 1 } },
      }),
    ).toEqual({
      limit: 2,
      experimentalFlag: true,
      scrapeOptions: { formats: ["markdown"], newOption: 1 },
    });
  });

  test("returns an empty object for no options", () => {
    expect(withExtra(undefined)).toEqual({});
  });
});

describe("rate-limit windows", () => {
  test("reads the retry window from the header or the 429 body", async () => {
    const { _test } = await import("./api.js");
    expect(_test.retryAfterMsFrom("12", "")).toBe(12_000);
    expect(_test.retryAfterMsFrom(null, "Rate limit exceeded. Consumed (req/min): 11, Remaining (req/min): 0. Upgrade your plan or please retry after 57s, resets at Sun Sep 13 2026")).toBe(57_000);
    expect(_test.retryAfterMsFrom(null, "rate limited")).toBeUndefined();
    expect(_test.retryAfterMsFrom("not-a-number", "nothing here")).toBeUndefined();
  });

  test("carries the announced window on the thrown error without the provider text", async () => {
    const t = initConvexTest();
    mockFetch([
      { status: 429, body: { success: false, error: "Rate limit exceeded ... please retry after 57s, resets at later" } },
    ]);
    const error = await t.action(api.lib.scrape, { url: "https://a.com" })
      .catch((value: unknown) => value);
    expect(String(error)).toContain("firecrawl_request_failed");
    expect(String(error)).toContain("429");
    expect(String(error)).toContain("57000");
    expect(String(error)).not.toContain("Upgrade");
  });
});
