/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import schema from "./schema";
import { internal } from "./_generated/api";

const sdk = vi.hoisted(() => ({
  contextCreate: vi.fn(), contextDelete: vi.fn(), sessionCreate: vi.fn(), sessionUpdate: vi.fn(),
}));
vi.mock("@browserbasehq/sdk", () => ({ Browserbase: class {
  contexts = { create: sdk.contextCreate, delete: sdk.contextDelete };
  sessions = { create: sdk.sessionCreate, update: sdk.sessionUpdate };
} }));
const modules = import.meta.glob("./**/*.ts");
const diagnose = makeFunctionReference<"action", { confirmation: "RUN_CONTROLLED_PERSONAL_INBOX_PROOF_DEVELOPMENT" }, { ready: boolean; status?: number; reason?: string }>("browserbaseSessionProof:diagnose");
const args = { confirmation: "RUN_CONTROLLED_PERSONAL_INBOX_PROOF_DEVELOPMENT" as const };

beforeEach(() => {
  vi.stubEnv("CONVEX_SITE_URL", "https://perceptive-antelope-445.eu-west-1.convex.site");
  vi.stubEnv("CONVEX_CLOUD_URL", "https://perceptive-antelope-445.eu-west-1.convex.cloud");
  vi.stubEnv("BROWSERBASE_API_KEY", "fixture-provider-key");
  sdk.contextCreate.mockResolvedValue({ id: "fixture-context" });
  sdk.contextDelete.mockResolvedValue({});
  sdk.sessionCreate.mockResolvedValue({ id: "fixture-session" });
  sdk.sessionUpdate.mockResolvedValue({});
});
afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });

describe("isolated Browserbase session parameter diagnostic", () => {
  it("never navigates and releases the exact created resources", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.controlledPersonalInboxProof.prepareActors, args);
    expect(await t.action(diagnose, args)).toEqual({ ready: true });
    expect(sdk.sessionCreate).toHaveBeenCalledWith(expect.objectContaining({ proxies: false, browserSettings: expect.objectContaining({ allowedDomains: ["roomscout.dev"], solveCaptchas: false, recordSession: false, logSession: false }) }));
    expect(sdk.sessionUpdate).toHaveBeenCalledWith("fixture-session", { status: "REQUEST_RELEASE" });
    expect(sdk.contextDelete).toHaveBeenCalledWith("fixture-context");
  });
  it("redacts credentials, inboxes and URLs from the bounded provider reason", async () => {
    sdk.sessionCreate.mockRejectedValue(Object.assign(new Error("fixture-provider-key someone@example.test https://private.invalid/path"), { status: 400 }));
    const t = convexTest(schema, modules);
    await t.mutation(internal.controlledPersonalInboxProof.prepareActors, args);
    const result = await t.action(diagnose, args);
    expect(result).toEqual({ ready: false, status: 400, reason: "[credential] [inbox] [url]" });
    expect(sdk.contextDelete).toHaveBeenCalledOnce();
    expect(sdk.sessionUpdate).not.toHaveBeenCalled();
  });
  it("rejects other deployments before any provider call", async () => {
    vi.stubEnv("CONVEX_CLOUD_URL", "https://unrelated.convex.cloud");
    vi.stubEnv("CONVEX_SITE_URL", "https://unrelated.convex.site");
    await expect(convexTest(schema, modules).action(diagnose, args)).rejects.toThrow();
    expect(sdk.contextCreate).not.toHaveBeenCalled();
  });
});
