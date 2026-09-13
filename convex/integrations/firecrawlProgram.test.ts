import { describe, expect, it } from "vitest";
import { buildFirecrawlProgram, parseInteractEnvelope } from "./firecrawlProgram";

describe("Firecrawl program transport", () => {
  it("wraps code in an async IIFE and JSON-encodes values", () => {
    const secretLikeValue = '"; throw new Error("injected") //';
    const code = buildFirecrawlProgram("return { value: vars.value };", {
      value: secretLikeValue,
    });
    expect(code).toMatch(/^\(async \(\) => \{/);
    expect(code).toContain(JSON.stringify(secretLikeValue));
    expect(code).toMatch(/\}\)\(\)$/);
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
