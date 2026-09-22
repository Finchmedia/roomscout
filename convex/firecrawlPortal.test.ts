import { ConvexError } from "convex/values";
import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  pageState: vi.fn(),
  signUp: vi.fn(),
  verify: vi.fn(),
  send: vi.fn(),
  readBatch: vi.fn(),
}));

vi.mock("./components/firecrawlRoomScout/client", () => ({
  FirecrawlRoomScoutClient: class {},
}));
vi.mock("./integrations/firecrawlPortalRuntime", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./integrations/firecrawlPortalRuntime")>()),
  firecrawlComponentPortalTransport: vi.fn(() => ({})),
  createFirecrawlPortalSession: mocks.createSession,
}));
vi.mock("./integrations/firecrawlPortalEngine", () => ({
  readFirecrawlPortalInboxBatch: mocks.readBatch,
  writeFirecrawlPortalMessage: mocks.send,
  readFirecrawlPortalPageState: mocks.pageState,
  signUpOnFirecrawlPortal: mocks.signUp,
  submitFirecrawlPortalVerification: mocks.verify,
}));

import { executeFirecrawlApprovedWrite, inspectFirecrawlProfileForRecovery, runFirecrawlRegistrationStep, syncInboxForOwner } from "./firecrawlPortal";

function session(id: string) {
  return {
    scrapeId: id,
    profileName: "profile_1",
    openedAt: 1,
    stop: vi.fn(async () => undefined),
    liveView: vi.fn(),
    lastErrorCode: vi.fn(() => null),
    runProgram: vi.fn(),
  };
}

function pageState(overrides: Record<string, unknown> = {}) {
  return {
    url: "https://roomscout.dev/",
    authenticated: false,
    stage: "sign_in",
    hasPasswordField: true,
    hasCodeField: false,
    captcha: false,
    ...overrides,
  };
}

describe("Firecrawl portal orchestration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("closes an OTP session instead of exposing a fake resume", async () => {
    const opened = session("scrape_otp");
    mocks.createSession.mockResolvedValue(opened);
    mocks.verify.mockResolvedValue({ authenticated: true, url: "https://roomscout.dev/" });
    await expect(runFirecrawlRegistrationStep({} as never, {
      baseUrl: "https://roomscout.dev", adapterKey: "roomscout-dev-v1",
      profileName: "profile_1", verificationCode: "123456",
    })).resolves.toEqual({ outcome: "authenticated" });
    expect(opened.stop).toHaveBeenCalledOnce();
    expect(mocks.verify).toHaveBeenCalledWith(expect.objectContaining({ session: opened, code: "123456" }));
    expect(mocks.createSession).toHaveBeenCalledWith(expect.objectContaining({ profileName: "profile_1", saveChanges: true }));
  });

  it("reports an unverified continuation as a human stop instead of a saved login", async () => {
    const opened = session("scrape_otp_failed");
    mocks.createSession.mockResolvedValue(opened);
    mocks.verify.mockResolvedValue({ authenticated: false, url: "https://roomscout.dev/sign-up" });
    await expect(runFirecrawlRegistrationStep({} as never, {
      baseUrl: "https://roomscout.dev", adapterKey: "roomscout-dev-v1",
      profileName: "profile_1", verificationCode: "123456",
    })).resolves.toEqual({ outcome: "human_required", blocker: "policy_human_presence" });
    expect(opened.stop).toHaveBeenCalledOnce();
  });

  it("surfaces a failed session stop instead of reporting a saved profile", async () => {
    const opened = session("scrape_otp");
    opened.stop.mockRejectedValue(new Error("stop failed"));
    mocks.createSession.mockResolvedValue(opened);
    mocks.verify.mockResolvedValue({ authenticated: true, url: "https://roomscout.dev/" });
    await expect(runFirecrawlRegistrationStep({} as never, {
      baseUrl: "https://roomscout.dev", adapterKey: "roomscout-dev-v1",
      profileName: "profile_1", verificationCode: "123456",
    })).rejects.toThrow("stop failed");
  });

  it("inspects the same profile read-only without starting registration", async () => {
    const probe = session("scrape_recovery");
    mocks.createSession.mockResolvedValue(probe);
    mocks.pageState.mockResolvedValue(pageState({ stage: "verification", hasCodeField: true }));
    await expect(inspectFirecrawlProfileForRecovery({} as never, {
      baseUrl: "https://roomscout.dev", adapterKey: "roomscout-dev-v1", profileName: "profile_1",
    })).resolves.toEqual({ outcome: "awaiting_verification" });
    expect(mocks.signUp).not.toHaveBeenCalled();
    // A page that already waits for a code is not looked up a second time.
    expect(mocks.pageState).toHaveBeenCalledOnce();
    expect(mocks.pageState).toHaveBeenCalledWith(expect.objectContaining({ session: probe, path: "/" }));
    expect(mocks.createSession).toHaveBeenCalledWith(expect.objectContaining({ profileName: "profile_1", saveChanges: false }));
    expect(probe.stop).toHaveBeenCalledOnce();
  });

  it("looks at the sign-up route only when the home page is neither signed in nor blocked", async () => {
    const probe = session("scrape_recovery_signup");
    mocks.createSession.mockResolvedValue(probe);
    mocks.pageState
      .mockResolvedValueOnce(pageState({ stage: "sign_in" }))
      .mockResolvedValueOnce(pageState({ url: "https://roomscout.dev/sign-up", stage: "sign_up", hasPasswordField: false }));
    await expect(inspectFirecrawlProfileForRecovery({} as never, {
      baseUrl: "https://roomscout.dev", adapterKey: "roomscout-dev-v1", profileName: "profile_1",
    })).resolves.toEqual({ outcome: "auth_needed" });
    expect(mocks.pageState.mock.calls.map(([call]) => (call as { path: string }).path)).toEqual(["/", "/sign-up"]);
  });

  it("does not report profile recovery when the read-only session cannot be saved", async () => {
    const probe = session("scrape_recovery");
    probe.stop.mockRejectedValue(new Error("stop failed"));
    mocks.createSession.mockResolvedValue(probe);
    mocks.pageState.mockResolvedValue(pageState({ authenticated: true, stage: "authenticated", hasPasswordField: false }));
    await expect(inspectFirecrawlProfileForRecovery({} as never, {
      baseUrl: "https://roomscout.dev", adapterKey: "roomscout-dev-v1", profileName: "profile_1",
    })).rejects.toThrow("stop failed");
  });

  it("durably schedules the exact recovery scrape when teardown fails", async () => {
    const probe = session("scrape_recovery_cleanup");
    probe.stop.mockRejectedValue(new Error("stop failed"));
    mocks.createSession.mockResolvedValue(probe);
    mocks.pageState.mockRejectedValue(new Error("FIRECRAWL_PORTAL_PAGE_STATE_INVALID"));
    const runMutation = vi.fn(async () => ({ cleanupId: "cleanup_1", generation: 1 }));
    const runAfter = vi.fn(async () => undefined);
    await expect(inspectFirecrawlProfileForRecovery({ runMutation, scheduler: { runAfter } } as never, {
      baseUrl: "https://roomscout.dev", adapterKey: "roomscout-dev-v1", profileName: "profile_1",
      cleanup: { ownerId: "owner" as never, connectionId: "connection" as never, contextId: "context" as never },
    })).rejects.toThrow("FIRECRAWL_PORTAL_PAGE_STATE_INVALID");
    expect(runMutation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      providerSessionId: "scrape_recovery_cleanup", provider: "firecrawl", purpose: "recovery",
    }));
    expect(runAfter).toHaveBeenCalledWith(0, expect.anything(), expect.objectContaining({
      cleanupId: "cleanup_1", providerSessionId: "scrape_recovery_cleanup",
    }));
  });
});

describe("Firecrawl write failure reporting", () => {
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

  it("reports a rejected final claim as an unsent failure and preserves its code", async () => {
    const opened = session("write_rejected");
    mocks.createSession.mockResolvedValue(opened);
    const click = vi.fn();
    mocks.send.mockImplementation(async (input: { beforeSubmit: () => Promise<void> }) => {
      await input.beforeSubmit();
      click();
    });
    const beforeSubmit = vi.fn(async () => {
      throw new ConvexError({ code: "ACTION_SEARCH_CHANGED" });
    });
    await expect(executeFirecrawlApprovedWrite({} as never, {
      baseUrl: "https://roomscout.dev", adapterKey: "roomscout-dev-v1", profileName: "profile_1",
      body: "Hallo", providerThreadId: "thread_1", beforeSubmit,
    })).rejects.toThrow("FIRECRAWL_PORTAL_WRITE_FAILED:ACTION_SEARCH_CHANGED");
    expect(click).not.toHaveBeenCalled();
    expect(mocks.createSession).toHaveBeenCalledOnce();
    expect(opened.stop).toHaveBeenCalledOnce();
  });

  it("keeps a failure after the final claim uncertain without repeating the send", async () => {
    const opened = session("write_unconfirmed");
    mocks.createSession.mockResolvedValue(opened);
    mocks.send.mockImplementation(async (input: { beforeSubmit: () => Promise<void> }) => {
      await input.beforeSubmit();
      throw new Error("FIRECRAWL_INTERACT_RESULT_INVALID");
    });
    const beforeSubmit = vi.fn(async () => undefined);
    await expect(executeFirecrawlApprovedWrite({} as never, {
      baseUrl: "https://roomscout.dev", adapterKey: "roomscout-dev-v1", profileName: "profile_1",
      body: "Hallo", providerThreadId: "thread_1", beforeSubmit,
    })).resolves.toMatchObject({ outcome: "unknown", submitted: true, errorCode: "SUBMIT_RESULT_UNKNOWN" });
    expect(beforeSubmit).toHaveBeenCalledOnce();
    expect(mocks.send).toHaveBeenCalledOnce();
    expect(opened.stop).toHaveBeenCalledOnce();
  });

  it("carries the sandbox reason into the thrown write failure", async () => {
    const sessions = [session("write_1"), session("write_2"), session("write_3")];
    for (const opened of sessions) mocks.createSession.mockResolvedValueOnce(opened);
    // The in-band sandbox failure arrives as code plus a sanitised detail; the
    // retry ladder still classifies it by its code alone.
    mocks.send.mockRejectedValue(new Error("FIRECRAWL_INTERACT_EXECUTION_FAILED:locator.fill: Timeout 5000ms exceeded"));
    const beforeSubmit = vi.fn(async () => undefined);
    const pending = executeFirecrawlApprovedWrite({} as never, {
      baseUrl: "https://roomscout.dev", adapterKey: "roomscout-dev-v1", profileName: "profile_1",
      body: "Hallo", providerThreadId: "thread_1", beforeSubmit,
    });
    pending.catch(() => undefined);
    await vi.runAllTimersAsync();

    await expect(pending).rejects.toThrow(
      "FIRECRAWL_PORTAL_WRITE_FAILED:FIRECRAWL_INTERACT_EXECUTION_FAILED:locator.fill: Timeout 5000ms exceeded",
    );
    expect(mocks.createSession).toHaveBeenCalledTimes(3);
    expect(beforeSubmit).not.toHaveBeenCalled();
    for (const opened of sessions) expect(opened.stop).toHaveBeenCalledOnce();
  });

  it("opens the write profile read-only unless the save switch is set", async () => {
    mocks.createSession.mockResolvedValue(session("write_save"));
    mocks.send.mockResolvedValue({
      outcome: "succeeded", submitted: true, providerThreadId: "thread_1",
      providerMessageId: "message_1", profileAuthenticated: true,
    });
    const write = async () => await executeFirecrawlApprovedWrite({} as never, {
      baseUrl: "https://roomscout.dev", adapterKey: "roomscout-dev-v1", profileName: "profile_1",
      body: "Hallo", providerThreadId: "thread_1", beforeSubmit: async () => undefined,
    });
    await expect(write()).resolves.toMatchObject({ outcome: "succeeded", profileStopFailed: false });
    expect(mocks.createSession).toHaveBeenLastCalledWith(expect.objectContaining({ saveChanges: false }));
    vi.stubEnv("FIRECRAWL_WRITE_SAVE_CHANGES", "true");
    await write();
    expect(mocks.createSession).toHaveBeenLastCalledWith(expect.objectContaining({ saveChanges: true }));
  });

  it("retries a preparation mismatch in a fresh session instead of reporting a human stop", async () => {
    const sessions = [session("write_mismatch"), session("write_retry")];
    for (const opened of sessions) mocks.createSession.mockResolvedValueOnce(opened);
    mocks.send
      .mockRejectedValueOnce(new Error("FIRECRAWL_WRITE_PREPARE_MISMATCH"))
      .mockResolvedValueOnce({
        outcome: "succeeded", submitted: true, providerThreadId: "thread_1",
        providerMessageId: "message_1", profileAuthenticated: true,
      });
    const pending = executeFirecrawlApprovedWrite({} as never, {
      baseUrl: "https://roomscout.dev", adapterKey: "roomscout-dev-v1", profileName: "profile_1",
      body: "Hallo", providerThreadId: "thread_1", beforeSubmit: async () => undefined,
    });
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toMatchObject({ outcome: "succeeded", providerMessageId: "message_1" });
    expect(mocks.createSession).toHaveBeenCalledTimes(2);
    for (const opened of sessions) expect(opened.stop).toHaveBeenCalledOnce();
  });

  it("does not put an unrecognised provider message into the failure", async () => {
    const opened = session("write_only");
    mocks.createSession.mockResolvedValue(opened);
    mocks.send.mockRejectedValue(new Error("Firecrawl says: synthetic-secret"));
    const pending = executeFirecrawlApprovedWrite({} as never, {
      baseUrl: "https://roomscout.dev", adapterKey: "roomscout-dev-v1", profileName: "profile_1",
      body: "Hallo", providerThreadId: "thread_1", beforeSubmit: async () => undefined,
    });
    pending.catch(() => undefined);
    await vi.runAllTimersAsync();

    const thrown = await pending.catch((error: unknown) => String(error));
    expect(thrown).toContain("FIRECRAWL_PORTAL_WRITE_FAILED:UNKNOWN");
    expect(thrown).not.toContain("synthetic-secret");
    expect(mocks.createSession).toHaveBeenCalledOnce();
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
