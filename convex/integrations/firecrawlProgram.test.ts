import { afterEach, describe, expect, it, vi } from "vitest";
import { buildFirecrawlProgram, parseInteractEnvelope } from "./firecrawlProgram";

afterEach(() => {
  vi.restoreAllMocks();
});

function markerEnvelope(result: unknown) {
  return {
    success: true,
    exitCode: 0,
    killed: false,
    stdout: `__ROOMSCOUT_RESULT__${JSON.stringify(result)}`,
  };
}

describe("Firecrawl program transport", () => {
  it("wraps code in an async IIFE and JSON-encodes values", () => {
    const secretLikeValue = '"; throw new Error("injected") //';
    const code = buildFirecrawlProgram("return { value: vars.value };", {
      value: secretLikeValue,
    });
    expect(code).toMatch(/^await \(async \(\) => \{/);
    expect(code).toContain(JSON.stringify(secretLikeValue));
    expect(code).toContain("__ROOMSCOUT_RESULT__");
    expect(code).toMatch(/\}\)\(\)$/);
  });

  it.each(["output", "stdout"])("accepts only marker-delimited structured %s", (field) => {
    expect(parseInteractEnvelope({
      success: true, exitCode: 0, killed: false,
      [field]: `provider diagnostics\n__ROOMSCOUT_RESULT__{"ok":true}\n`,
    })).toEqual({ ok: true });
    expect(() => parseInteractEnvelope({
      success: true, exitCode: 0, killed: false, [field]: '{"leaked":"diagnostic"}',
    })).toThrow("FIRECRAWL_INTERACT_RESULT_MISSING");
  });

  it("falls back to owned marker output when the provider result is a non-JSON placeholder", () => {
    expect(parseInteractEnvelope({
      success: true, exitCode: 0, killed: false, result: "undefined",
      stdout: '__ROOMSCOUT_RESULT__{"stage":"sign_up"}',
    })).toEqual({ stage: "sign_up" });
  });

  it("prefers the owned marker line over an unrelated structured provider result", () => {
    const envelope = { success: true, exitCode: 0, result: { logs: [] }, stdout: "noise\n__ROOMSCOUT_RESULT__{\"url\":\"https://portal.test/inbox/t1\",\"raw\":{\"ok\":true}}\n" };
    expect(parseInteractEnvelope(envelope)).toEqual({ url: "https://portal.test/inbox/t1", raw: { ok: true } });
  });

  it("wraps the body so a sandbox throw comes back in band with a page diagnosis", () => {
    const code = buildFirecrawlProgram("return { value: vars.value };", { value: 1 });
    expect(code).toContain("__roomscoutError");
    expect(code).toContain("SANDBOX_ERROR");
    expect(code).toContain("__roomscoutDiag");
    expect(code).toContain("clerkLoaded");
    expect(code).toContain("formErrors");
    expect(code).toContain("textSnippet");
    // Exactly one page probe, and only on the failure path.
    expect(code.match(/page\.evaluate\(/g)).toHaveLength(1);
    expect(code.indexOf("catch (error)")).toBeLessThan(code.indexOf("await __roomscoutDiag()"));
  });

  it("surfaces an in-band sandbox failure as a readable execution error", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const envelope = markerEnvelope({
      __roomscoutError: {
        code: "SANDBOX_ERROR",
        message: "locator.fill: Timeout 5000ms exceeded waiting for [data-roomscout-write=body]",
        partial: { navigated: true },
        diag: { url: "https://portal.test/inbox/t1", authenticated: true, formErrors: [] },
      },
    });

    expect(() => parseInteractEnvelope(envelope)).toThrow(
      "FIRECRAWL_INTERACT_EXECUTION_FAILED:locator.fill: Timeout 5000ms exceeded waiting for [data-roomscout-write=body]",
    );
    expect(logged).toHaveBeenCalledWith("FIRECRAWL_INTERACT_SANDBOX_ERROR", {
      code: "SANDBOX_ERROR",
      message: "locator.fill: Timeout 5000ms exceeded waiting for [data-roomscout-write=body]",
      diagKeys: ["url", "authenticated", "formErrors"],
      partialKeys: ["navigated"],
    });
  });

  it("keeps URLs with query strings out of the surfaced failure message", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const envelope = markerEnvelope({
      __roomscoutError: {
        code: "SANDBOX_ERROR",
        message: "page.goto failed for https://portal.test/inbox?__clerk_ticket=synthetic-secret#x\nretrying",
        partial: {},
        diag: {},
      },
    });

    const error = (() => { try { parseInteractEnvelope(envelope); } catch (thrown) { return String(thrown); } return ""; })();
    expect(error).toContain("FIRECRAWL_INTERACT_EXECUTION_FAILED:page.goto failed for <url> retrying");
    expect(error).not.toContain("synthetic-secret");
    expect(error).not.toContain("?");
  });

  it("bounds the surfaced failure message", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const envelope = markerEnvelope({
      __roomscoutError: { code: "SANDBOX_ERROR", message: "e".repeat(400), partial: {}, diag: {} },
    });
    try {
      parseInteractEnvelope(envelope);
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).toBe(`FIRECRAWL_INTERACT_EXECUTION_FAILED:${"e".repeat(120)}`);
    }
  });

  it("returns only a successful structured result", () => {
    expect(
      parseInteractEnvelope({
        success: true,
        result: '{"ok":true}',
        stdout: "ignored diagnostics",
        exitCode: 0,
        killed: false,
      }),
    ).toEqual({ ok: true });
  });

  it.each([
    [{ success: false, result: { leaked: "synthetic-secret" }, exitCode: 0 }, "FIRECRAWL_INTERACT_EXECUTION_FAILED"],
    [{ success: true, result: { partial: true }, exitCode: 1 }, "FIRECRAWL_INTERACT_EXECUTION_FAILED"],
    [{ success: true, result: { partial: true }, exitCode: 0, killed: true }, "FIRECRAWL_INTERACT_KILLED"],
    [{ success: true, result: "not json synthetic-secret", exitCode: 0 }, "FIRECRAWL_INTERACT_RESULT_INVALID"],
  ])("maps failures to fixed codes without diagnostics", (envelope, code) => {
    expect(() => parseInteractEnvelope(envelope)).toThrow(code);
    try {
      parseInteractEnvelope(envelope);
    } catch (error) {
      expect(String(error)).not.toContain("synthetic-secret");
    }
  });
});
