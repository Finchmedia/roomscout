/// <reference types="vite/client" />
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api.js";
import { initConvexTest, mockFetch } from "./setup.testSupport.js";
import { parseInteractEnvelope } from "../../integrations/firecrawlProgram";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function runInteract(envelope: Record<string, unknown>) {
  const t = initConvexTest();
  mockFetch([{ body: envelope }]);
  return await t.action(api.interact.execute, {
    jobId: "job-1",
    code: "return { ok: true };",
    mutating: false,
  });
}

/**
 * The decoding contract between this component and the app-layer parser. Both
 * layers read the owned marker first; the provider's own `result` field is only
 * a fallback. Getting that order wrong here is what surfaced as EVIDENCE_INVALID
 * in production: the marker fix one layer up never saw a marker.
 */
describe("Interact result decoding", () => {
  test("prefers the owned marker line over an unrelated structured result", async () => {
    const envelope = await runInteract({
      success: true,
      exitCode: 0,
      result: { logs: [], sessionId: "provider-object" },
      stdout: 'diagnostic line\n__ROOMSCOUT_RESULT__{"url":"https://portal.test/inbox/t1","raw":{"ok":true}}\ntrailing diagnostic',
    });

    expect(envelope.result).toBe('{"url":"https://portal.test/inbox/t1","raw":{"ok":true}}');
    expect(parseInteractEnvelope(envelope)).toEqual({
      url: "https://portal.test/inbox/t1",
      raw: { ok: true },
    });
  });

  test("uses the provider result when the program printed no marker", async () => {
    const envelope = await runInteract({
      success: true,
      exitCode: 0,
      result: '{"stage":"sign_up"}',
      stdout: "no marker in this run",
    });

    expect(envelope.result).toBe('{"stage":"sign_up"}');
    expect(parseInteractEnvelope(envelope)).toEqual({ stage: "sign_up" });
  });

  test("reports a missing result when neither a marker nor a result exists", async () => {
    const shapeLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const envelope = await runInteract({
      success: true,
      exitCode: 0,
      stdout: "only diagnostics",
    });

    expect(envelope.result).toBeUndefined();
    expect(() => parseInteractEnvelope(envelope)).toThrow("FIRECRAWL_INTERACT_RESULT_MISSING");
    expect(shapeLog).toHaveBeenCalledWith("FIRECRAWL_INTERACT_RESULT_SHAPE", {
      marker: false,
      type: "undefined",
    });
  });

  test("logs the shape when only an unmarked structured provider result is left", async () => {
    const shapeLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const envelope = await runInteract({
      success: true,
      exitCode: 0,
      result: { logs: [], sessionId: "provider-object" },
      stdout: "only diagnostics",
    });

    // Still forwarded (the provider may hand our own value back parsed), but the
    // shape is on record: after one production run it is clear which variant
    // Firecrawl returns. Shape only, never content.
    expect(envelope.result).toEqual({ logs: [], sessionId: "provider-object" });
    expect(shapeLog).toHaveBeenCalledWith("FIRECRAWL_INTERACT_RESULT_SHAPE", {
      marker: false,
      type: "object",
      keys: ["logs", "sessionId"],
    });
  });

  test("keeps a killed execution killed", async () => {
    const envelope = await runInteract({
      success: true,
      exitCode: 0,
      killed: true,
      stdout: '__ROOMSCOUT_RESULT__{"ok":true}',
    });

    expect(envelope.killed).toBe(true);
    expect(() => parseInteractEnvelope(envelope)).toThrow("FIRECRAWL_INTERACT_KILLED");
  });

  test("forwards bounded output and stdout tails so the parser can scan them itself", async () => {
    const noise = "x".repeat(5_000);
    const envelope = await runInteract({
      success: true,
      exitCode: 0,
      output: `${noise}\n__ROOMSCOUT_RESULT__{"ok":true}`,
      stdout: noise,
      stderr: "provider stderr",
    });

    expect(envelope.output).toHaveLength(2_000);
    expect(envelope.stdout).toHaveLength(2_000);
    expect(envelope.output).toContain('__ROOMSCOUT_RESULT__{"ok":true}');
    // The forwarded tail alone is enough for the app-layer marker scan.
    expect(parseInteractEnvelope({ ...envelope, result: undefined })).toEqual({ ok: true });
    expect(JSON.stringify(envelope)).not.toContain("provider stderr");
  });
});
