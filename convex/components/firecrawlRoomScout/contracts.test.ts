import { describe, expect, test } from "vitest";
import {
  firecrawlId,
  normalizeInteractArgs,
  queryString,
} from "./contracts.js";

describe("Firecrawl extension contracts", () => {
  test("encodes provider ids before composing API paths", () => {
    expect(firecrawlId("../job?admin=true", "job_id")).toBe(
      "..%2Fjob%3Fadmin%3Dtrue",
    );
  });

  test("rejects empty and unreasonably large ids", () => {
    expect(() => firecrawlId("   ", "job_id")).toThrow(
      "INVALID_FIRECRAWL_JOB_ID",
    );
    expect(() => firecrawlId("x".repeat(301), "monitor_id")).toThrow(
      "INVALID_FIRECRAWL_MONITOR_ID",
    );
  });

  test("serializes only defined pagination fields", () => {
    expect(queryString({ limit: 20, skip: undefined, active: false })).toBe(
      "?limit=20&active=false",
    );
    expect(queryString({ limit: undefined })).toBe("");
  });

  test("normalizes code/prompt, language, and timeout", () => {
    expect(
      normalizeInteractArgs({
        code: "  return 1;  ",
        prompt: " ",
        timeout: 999,
      }),
    ).toEqual({
      code: "return 1;",
      language: "node",
      timeout: 300,
    });

    expect(
      normalizeInteractArgs({
        prompt: " inspect the form ",
        language: "python",
        timeout: 0,
      }),
    ).toEqual({
      prompt: "inspect the form",
      language: "python",
      timeout: 1,
    });
  });

  test("requires exactly one of code or prompt", () => {
    expect(() => normalizeInteractArgs({ code: " ", prompt: "" })).toThrow(
      "FIRECRAWL_INTERACT_REQUIRES_EXACTLY_ONE_INPUT",
    );
    expect(() =>
      normalizeInteractArgs({ code: "return 1", prompt: "click" }),
    ).toThrow(
      "FIRECRAWL_INTERACT_REQUIRES_EXACTLY_ONE_INPUT",
    );
  });
});
