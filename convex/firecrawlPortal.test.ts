import { ConvexError } from "convex/values";
import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  verify: vi.fn(),
  register: vi.fn(),
  send: vi.fn(),
  readBatch: vi.fn(),
}));

vi.mock("./components/firecrawlRoomScout/client", () => ({
  FirecrawlRoomScoutClient: class {},
}));
vi.mock("./integrations/firecrawlPortalRuntime", () => ({
  firecrawlComponentPortalTransport: vi.fn(() => ({})),
  createFirecrawlPortalSession: mocks.createSession,
}));
vi.mock("./integrations/firecrawlPortalEngine", () => ({
  readFirecrawlPortalInboxBatch: mocks.readBatch,
}));
vi.mock("./integrations/stagehandPortalDriver", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./integrations/stagehandPortalDriver")>()),
  verifyControlledPortalContext: mocks.verify,
  ensureControlledPortalRegistration: mocks.register,
  sendControlledPortalMessage: mocks.send,
}));

import { inspectFirecrawlProfileForRecovery, proveFirecrawlProfile, runFirecrawlRegistrationStep, syncInboxForOwner } from "./firecrawlPortal";

function session(id: string) {
  return {
    scrapeId: id,
    profileName: "profile_1",
    openedAt: 1,
    primitives: {},
    stop: vi.fn(async () => undefined),
    liveView: vi.fn(),
    runProgram: vi.fn(),
  };
}

describe("Firecrawl portal orchestration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("closes an OTP session instead of exposing a fake resume", async () => {
    const opened = session("scrape_otp");
    mocks.createSession.mockResolvedValue(opened);
    mocks.register.mockResolvedValue({ outcome: "authenticated" });
    await expect(runFirecrawlRegistrationStep({} as never, {
      baseUrl: "https://roomscout.dev", adapterKey: "roomscout-dev-v1",
      profileName: "profile_1", verificationCode: "123456",
    })).resolves.toEqual({ outcome: "authenticated" });
    expect(opened.stop).toHaveBeenCalledOnce();
    expect(mocks.createSession).toHaveBeenCalledWith(expect.objectContaining({ profileName: "profile_1", saveChanges: true }));
  });

  it("does not begin profile proof when registration session stop fails", async () => {
    const opened = session("scrape_otp");
    opened.stop.mockRejectedValue(new Error("stop failed"));
    mocks.createSession.mockResolvedValue(opened);
    mocks.register.mockResolvedValue({ outcome: "authenticated" });
    await expect(runFirecrawlRegistrationStep({} as never, {
      baseUrl: "https://roomscout.dev", adapterKey: "roomscout-dev-v1",
      profileName: "profile_1", verificationCode: "123456",
    })).rejects.toThrow("stop failed");
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it("proves persistence only in a new read-only session", async () => {
    const probe = session("scrape_probe");
    mocks.createSession.mockResolvedValue(probe);
    mocks.verify.mockResolvedValue(true);
    await expect(proveFirecrawlProfile({} as never, {
      baseUrl: "https://roomscout.dev", adapterKey: "roomscout-dev-v1",
      profileName: "profile_1", now: () => 10,
    })).resolves.toEqual({ verified: true, attempts: 1 });
    expect(mocks.createSession).toHaveBeenCalledWith(expect.objectContaining({ saveChanges: false }));
    expect(probe.stop).toHaveBeenCalledOnce();
  });

  it("inspects the same profile read-only without starting registration", async () => {
    const probe = session("scrape_recovery");
    probe.primitives = { extract: vi.fn(async () => ({ authenticated: false, stage: "verification", blocker: null })) };
    mocks.createSession.mockResolvedValue(probe);
    await expect(inspectFirecrawlProfileForRecovery({} as never, {
      baseUrl: "https://roomscout.dev", adapterKey: "roomscout-dev-v1", profileName: "profile_1",
    })).resolves.toEqual({ outcome: "awaiting_verification" });
    expect(mocks.register).not.toHaveBeenCalled();
    expect(mocks.createSession).toHaveBeenCalledWith(expect.objectContaining({ profileName: "profile_1", saveChanges: false }));
    expect(probe.stop).toHaveBeenCalledOnce();
  });

  it("does not report profile recovery when the read-only session cannot be saved", async () => {
    const probe = session("scrape_recovery");
    probe.primitives = { extract: vi.fn(async () => ({ authenticated: true, stage: "authenticated", blocker: null })) };
    probe.stop.mockRejectedValue(new Error("stop failed"));
    mocks.createSession.mockResolvedValue(probe);
    await expect(inspectFirecrawlProfileForRecovery({} as never, {
      baseUrl: "https://roomscout.dev", adapterKey: "roomscout-dev-v1", profileName: "profile_1",
    })).rejects.toThrow("stop failed");
  });

  it("durably schedules the exact proof scrape when teardown fails", async () => {
    const probe = session("scrape_proof_cleanup");
    probe.stop.mockRejectedValue(new Error("stop failed"));
    mocks.createSession.mockResolvedValue(probe);
    mocks.verify.mockResolvedValue(true);
    const runMutation = vi.fn(async () => ({ cleanupId: "cleanup_1", generation: 1 }));
    const runAfter = vi.fn(async () => undefined);
    let clockReads = 0;
    await expect(proveFirecrawlProfile({ runMutation, scheduler: { runAfter } } as never, {
      baseUrl: "https://roomscout.dev", adapterKey: "roomscout-dev-v1", profileName: "profile_1",
      deadlineAt: 50_000, now: () => clockReads++ === 0 ? 0 : 50_000,
      cleanup: { ownerId: "owner" as never, connectionId: "connection" as never, contextId: "context" as never, purpose: "profile_proof" },
    })).resolves.toMatchObject({ verified: false, attempts: 1 });
    expect(runMutation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      providerSessionId: "scrape_proof_cleanup", provider: "firecrawl", purpose: "profile_proof",
    }));
    expect(runAfter).toHaveBeenCalledWith(0, expect.anything(), expect.objectContaining({
      cleanupId: "cleanup_1", providerSessionId: "scrape_proof_cleanup",
    }));
  });
});

describe("Firecrawl inbox sync resilience", () => {
  const emptyBatch = {
    threads: [], missingThreadIds: [], failedThreadIds: [], bodyTruncatedThreadIds: [], historyTruncatedThreadIds: [],
    discoveredThreadIds: [], truncated: false, timedOut: false, nextOffset: 0,
  };
  const connection = {
    connectionId: "connection_1", baseUrl: "https://roomscout.dev", allowedDomains: ["roomscout.dev"], allowedPaths: ["/inbox"],
    inboxPath: "/inbox", adapterKey: "roomscout-dev-v1", allowReadOnlyRecon: false, allowInboxPolling: true,
    providerContextId: "profile_1", browserProvider: "firecrawl", contextStatus: "ready",
  };
  function ctx() {
    const runMutation = vi.fn(async (ref: unknown) => {
      switch (getFunctionName(ref as never)) {
        case "portalConnections:reserveRun": return "run_1";
        case "portalConnections:attachProviderRun": return { contextId: "context_1" };
        case "platformInbox:upsertReadOnlyBatch": return { threadsCreated: 0, messagesCreated: 0 };
        default: return null;
      }
    });
    const runQuery = vi.fn(async () => connection);
    return { runMutation, runQuery, scheduler: { runAfter: vi.fn(async () => undefined) } };
  }
  function calls(runMutation: ReturnType<typeof vi.fn>, name: string) {
    return runMutation.mock.calls.filter(([ref]) => getFunctionName(ref as never) === name).map(([, args]) => args);
  }

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
    vi.stubEnv("FIRECRAWL_API_KEY", "fc-test");
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("retries the opening Interact call in a new session and binds the run to the surviving one", async () => {
    const first = session("scrape_first");
    const second = session("scrape_second");
    mocks.createSession.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    mocks.readBatch.mockRejectedValueOnce(new Error("FIRECRAWL_PORTAL_INTERACT_REQUEST_REJECTED")).mockResolvedValueOnce(emptyBatch);
    const actionCtx = ctx();
    const pending = syncInboxForOwner(actionCtx as never, "owner" as never, "connection_1" as never);
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toEqual({ runId: "run_1", threadsCreated: 0, messagesCreated: 0 });
    expect(mocks.createSession).toHaveBeenCalledTimes(2);
    expect(first.stop).toHaveBeenCalledOnce();
    expect(second.stop).toHaveBeenCalledOnce();
    expect(calls(actionCtx.runMutation, "portalConnections:attachProviderRun")).toEqual([
      expect.objectContaining({ runId: "run_1", providerSessionId: "scrape_second" }),
    ]);
    expect(calls(actionCtx.runMutation, "portalConnections:finishRun")).toEqual([
      expect.objectContaining({ runId: "run_1", status: "completed" }),
    ]);
  });

  it("fails after three opening attempts and records the inner error code", async () => {
    const sessions = [session("scrape_1"), session("scrape_2"), session("scrape_3")];
    for (const opened of sessions) mocks.createSession.mockResolvedValueOnce(opened);
    mocks.readBatch.mockRejectedValue(new Error("FIRECRAWL_PORTAL_INTERACT_REQUEST_REJECTED"));
    const actionCtx = ctx();
    const pending = syncInboxForOwner(actionCtx as never, "owner" as never, "connection_1" as never);
    pending.catch(() => undefined);
    await vi.runAllTimersAsync();
    await expect(pending).rejects.toSatisfy((error: unknown) =>
      error instanceof ConvexError && (error.data as { code: string; inner: string }).code === "FIRECRAWL_INBOX_SYNC_FAILED" &&
      (error.data as { inner: string }).inner === "FIRECRAWL_PORTAL_INTERACT_REQUEST_REJECTED");
    expect(mocks.createSession).toHaveBeenCalledTimes(3);
    for (const opened of sessions) expect(opened.stop).toHaveBeenCalledOnce();
    expect(calls(actionCtx.runMutation, "portalConnections:attachProviderRun")).toEqual([]);
    expect(calls(actionCtx.runMutation, "portalConnections:finishRun")).toEqual([
      expect.objectContaining({ runId: "run_1", status: "failed", errorCode: "FIRECRAWL_INBOX_SYNC_FAILED:FIRECRAWL_PORTAL_INTERACT_REQUEST_REJECTED" }),
    ]);
  });

  it("does not retry a transport failure on a later batch", async () => {
    const opened = session("scrape_only");
    mocks.createSession.mockResolvedValue(opened);
    mocks.readBatch
      .mockResolvedValueOnce({ ...emptyBatch, truncated: true, nextOffset: 10 })
      .mockRejectedValueOnce(new Error("FIRECRAWL_PORTAL_INTERACT_REQUEST_REJECTED"));
    const actionCtx = ctx();
    const pending = syncInboxForOwner(actionCtx as never, "owner" as never, "connection_1" as never);
    pending.catch(() => undefined);
    await vi.runAllTimersAsync();
    await expect(pending).rejects.toBeInstanceOf(ConvexError);
    expect(mocks.createSession).toHaveBeenCalledOnce();
    expect(opened.stop).toHaveBeenCalledOnce();
    expect(calls(actionCtx.runMutation, "portalConnections:finishRun")).toEqual([
      expect.objectContaining({ status: "failed", errorCode: "FIRECRAWL_INBOX_SYNC_FAILED:FIRECRAWL_PORTAL_INTERACT_REQUEST_REJECTED" }),
    ]);
  });
});
