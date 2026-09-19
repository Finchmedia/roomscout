/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { actionPayloadHash } from "./integrations/contentHash";

const providerSpies = vi.hoisted(() => ({
  firecrawlCreateSession: vi.fn(),
  browserbaseLaunch: vi.fn(),
  browserbaseConnect: vi.fn(),
  register: vi.fn(),
  verify: vi.fn(),
  send: vi.fn(),
  signUp: vi.fn(),
  submitCode: vi.fn(),
  pageState: vi.fn(),
}));

vi.mock("./integrations/firecrawlPortalRuntime", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./integrations/firecrawlPortalRuntime")>()),
  createFirecrawlPortalSession: providerSpies.firecrawlCreateSession,
}));

vi.mock("@browserbasehq/stagehand", () => ({
  Stagehand: { create: vi.fn() },
  browserbase: {
    launch: providerSpies.browserbaseLaunch,
    connect: providerSpies.browserbaseConnect,
  },
}));

vi.mock("@browserbasehq/sdk", () => ({
  Browserbase: vi.fn(function Browserbase() {
    return { contexts: {}, sessions: { update: vi.fn() } };
  }),
}));

vi.mock("./integrations/stagehandPortalDriver", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./integrations/stagehandPortalDriver")>()),
  ensureControlledPortalRegistration: providerSpies.register,
  verifyControlledPortalContext: providerSpies.verify,
}));

// The Firecrawl write, registration and page-state paths are program-native:
// what they delegate to lives in the engine, not in the reviewed Browserbase
// driver (which stays mocked above for the Browserbase-selected cases).
vi.mock("./integrations/firecrawlPortalEngine", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./integrations/firecrawlPortalEngine")>()),
  writeFirecrawlPortalMessage: providerSpies.send,
  signUpOnFirecrawlPortal: providerSpies.signUp,
  submitFirecrawlPortalVerification: providerSpies.submitCode,
  readFirecrawlPortalPageState: providerSpies.pageState,
}));

const modules = import.meta.glob("./**/*.ts");

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("FIRECRAWL_API_KEY", "firecrawl-test-key");
  vi.stubEnv("BROWSERBASE_API_KEY", "browserbase-test-key");
  vi.stubEnv("AGENTMAIL_API_KEY", "agentmail-test-key");
  vi.stubEnv("AGENTMAIL_ADDRESS_SALT", "agentmail-test-salt");
});
afterEach(() => vi.unstubAllEnvs());

async function portalFixture(provider: "firecrawl" | "browserbase") {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await ctx.db.insert("users", { username: `isolation-${provider}`, firstName: "Mina", actKind: "band", actName: "Night Owls", providerIdentityConfirmedAt: now, role: "musician", createdAt: now, lastSeenAt: now });
    const platformId = await ctx.db.insert("sourcePlatforms", {
      slug: `isolation-${provider}`, name: "Controlled portal", canonicalDomain: "roomscout.dev",
      kind: "community", status: "active", firstSeenAt: now, lastObservedAt: now, createdAt: now, updatedAt: now,
    });
    const sourceId = await ctx.db.insert("sources", {
      platformId, slug: `isolation-${provider}-source`, name: "Controlled portal", baseUrl: "https://roomscout.dev/",
      side: "both", status: "active", health: "healthy", accessMode: "authenticated", automationReview: "approved",
      adapterKey: "roomscout-dev-v1", createdAt: now, updatedAt: now,
    });
    const connectionId = await ctx.db.insert("portalConnections", {
      ownerId, sourceId, platformId, label: "Controlled identity", browserProvider: provider,
      allowedDomains: ["roomscout.dev"], allowedPaths: ["/", "/inbox", "/listings"], inboxPath: "/inbox",
      adapterKey: "roomscout-dev-v1", status: "active", policyDecision: "allowed", allowReadOnlyRecon: true,
      allowInboxPolling: true, pollIntervalMinutes: 30, failureCount: 0, createdAt: now, updatedAt: now,
    });
    await ctx.db.insert("browserContexts", {
      ownerId, connectionId, providerContextId: `${provider}-profile`, browserProvider: provider,
      status: "ready", lastVerifiedAt: now, createdAt: now, updatedAt: now,
    });
    const savedNeedId = await ctx.db.insert("savedNeeds", {
      ownerId, title: "Isolation need", city: "Berlin", districts: [], arrangement: ["shared"], schedule: [],
      requirements: [], status: "active", createdAt: now, updatedAt: now,
    });
    const policyId = await ctx.db.insert("sourceFlowPolicies", {
      platformId, sourceId, scopeKey: "controlled:contact", flow: "contact", version: 1, status: "approved",
      decision: "allowed", maxAutomationLevel: "approved_execute", userConnectionRequired: true,
      humanPresenceRequired: false, accountCreationAllowed: false, externalApprovalRequired: true,
      robotsDecision: "allowed", termsDecision: "allowed", evidenceUrls: ["https://roomscout.dev/terms"],
      createdAt: now, updatedAt: now,
    });
    const bindingId = await ctx.db.insert("sourceAdapterBindings", {
      platformId, sourceId, scopeKey: "controlled:contact", flow: "contact", adapterKey: "roomscout-dev-v1",
      adapterVersion: 1, status: "active", executor: "browserbase",
      config: { kind: "browserbase", workflowKey: "roomscout-dev.platform-message.v1", contextRequired: true },
      configFingerprint: "isolation", policyVersionId: policyId, createdAt: now, updatedAt: now,
    });
    const payload = { kind: "platform_message" as const, targetPath: "/listings", recipients: ["Owner"], body: "Is the room available?" };
    const contentHash = await actionPayloadHash(payload);
    const requestId = await ctx.db.insert("actionRequests", {
      ownerId, platformId, connectionId, policyVersionId: policyId, adapterBindingId: bindingId,
      automationMode: "exact_once", requestedActionType: "send_platform_dm", personalDataScopes: [], payload,
      contentVersion: 1, contentHash, status: "approved", createdAt: now, updatedAt: now,
    });
    await ctx.db.insert("actionApprovals", {
      requestId, ownerId, contentVersion: 1, contentHash, payloadSnapshot: payload,
      policyVersionId: policyId, decision: "approved", decidedAt: now,
    });
    const mailboxId = await ctx.db.insert("userMailboxes", {
      ownerId, provider: "agentmail", providerInboxId: `${provider}-mailbox`, emailAddress: `${provider}@agentmail.test`,
      clientId: `${provider}-client`, status: "active", createdAt: now, updatedAt: now,
    });
    return { ownerId, savedNeedId, connectionId, requestId, mailboxId };
  });
  return { t, owner: t.withIdentity({ subject: ids.ownerId }), ...ids };
}

describe("exclusive controlled-portal provider isolation", () => {
  it("routes the Browserbase compatibility entrypoint to Firecrawl without touching Browserbase", async () => {
    vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
    const fixture = await portalFixture("firecrawl");
    providerSpies.firecrawlCreateSession.mockRejectedValueOnce(new Error("FIRECRAWL_SENTINEL"));

    await expect(fixture.owner.action(api.browserbasePortal.runRecon, { connectionId: fixture.connectionId }))
      .rejects.toThrow("FIRECRAWL_RECON_FAILED");
    expect(providerSpies.firecrawlCreateSession).toHaveBeenCalledOnce();
    expect(providerSpies.browserbaseLaunch).not.toHaveBeenCalled();
    expect(providerSpies.browserbaseConnect).not.toHaveBeenCalled();
  });

  it("uses Browserbase exclusively when Browserbase is selected", async () => {
    vi.stubEnv("PORTAL_BROWSER_ENGINE", "browserbase");
    const fixture = await portalFixture("browserbase");
    providerSpies.browserbaseLaunch.mockRejectedValueOnce(new Error("BROWSERBASE_SENTINEL"));

    await expect(fixture.owner.action(api.browserbasePortal.runRecon, { connectionId: fixture.connectionId }))
      .rejects.toThrow();
    expect(providerSpies.browserbaseLaunch).toHaveBeenCalledOnce();
    expect(providerSpies.firecrawlCreateSession).not.toHaveBeenCalled();
  });

  it("rejects the direct Firecrawl entrypoint when Browserbase is selected", async () => {
    vi.stubEnv("PORTAL_BROWSER_ENGINE", "browserbase");
    const fixture = await portalFixture("firecrawl");
    await expect(fixture.owner.action(api.firecrawlPortal.runRecon, { connectionId: fixture.connectionId }))
      .rejects.toThrow("PORTAL_BROWSER_PROVIDER_MISMATCH");
    expect(providerSpies.firecrawlCreateSession).not.toHaveBeenCalled();
    expect(providerSpies.browserbaseLaunch).not.toHaveBeenCalled();
  });

  it("does not let an explicit reservation provider override the deployment selector", async () => {
    vi.stubEnv("PORTAL_BROWSER_ENGINE", "browserbase");
    const fixture = await portalFixture("firecrawl");
    await expect(fixture.t.mutation(internal.portalConnections.reserveRun, {
      ownerId: fixture.ownerId, connectionId: fixture.connectionId, kind: "recon", browserProvider: "firecrawl",
    })).rejects.toThrow("PORTAL_BROWSER_PROVIDER_MISMATCH");
    expect(await fixture.t.run((ctx) => ctx.db.query("browserRuns").collect())).toEqual([]);
  });

  it("does not fall back to Firecrawl when selected Browserbase credentials are missing", async () => {
    vi.stubEnv("PORTAL_BROWSER_ENGINE", "browserbase");
    vi.stubEnv("BROWSERBASE_API_KEY", "");
    const fixture = await portalFixture("browserbase");
    await expect(fixture.owner.action(api.browserbasePortal.runRecon, { connectionId: fixture.connectionId }))
      .rejects.toThrow("BROWSERBASE_NOT_CONFIGURED");
    expect(providerSpies.browserbaseLaunch).not.toHaveBeenCalled();
    expect(providerSpies.firecrawlCreateSession).not.toHaveBeenCalled();
  });

  it("rejects a provider switch at the final transactional re-claim", async () => {
    vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
    const fixture = await portalFixture("firecrawl");
    const first = await fixture.t.mutation(internal.externalActions.claimForExecutor, {
      ownerId: fixture.ownerId, requestId: fixture.requestId, executor: "browserbase",
    });
    vi.stubEnv("PORTAL_BROWSER_ENGINE", "browserbase");
    await expect(fixture.t.mutation(internal.externalActions.claimForExecutor, {
      ownerId: fixture.ownerId, requestId: fixture.requestId, executor: "browserbase",
    })).rejects.toThrow("PORTAL_BROWSER_PROVIDER_RECONNECT_REQUIRED");
    expect(await fixture.t.run((ctx) => ctx.db.get(first.executionId))).toMatchObject({
      status: "claimed", browserProvider: "firecrawl",
    });
  });

  it("terminalizes a pre-reserved Firecrawl registration when its selected key is missing", async () => {
    vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
    vi.stubEnv("FIRECRAWL_API_KEY", "");
    const fixture = await portalFixture("firecrawl");
    const runId = await fixture.t.mutation(internal.portalConnections.reserveRun, {
      ownerId: fixture.ownerId, connectionId: fixture.connectionId, kind: "authenticate", browserProvider: "firecrawl",
    });
    await expect(fixture.t.action(internal.firecrawlPortal.runScheduledAgentRegistration, {
      ownerId: fixture.ownerId, savedNeedId: fixture.savedNeedId, connectionId: fixture.connectionId, runId,
    })).resolves.toBeNull();
    expect(await fixture.t.run((ctx) => ctx.db.get(runId))).toMatchObject({
      status: "failed", errorCode: "FIRECRAWL_NOT_CONFIGURED",
    });
    expect(providerSpies.firecrawlCreateSession).not.toHaveBeenCalled();
    expect(providerSpies.browserbaseLaunch).not.toHaveBeenCalled();
  });

  it("does not open another provider session after an unknown Firecrawl outcome", async () => {
    vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
    const fixture = await portalFixture("firecrawl");
    const claim = await fixture.t.mutation(internal.externalActions.claimForExecutor, {
      ownerId: fixture.ownerId, requestId: fixture.requestId, executor: "browserbase",
    });
    await fixture.t.mutation(internal.externalActions.finishExecution, {
      ownerId: fixture.ownerId, executionId: claim.executionId, status: "unknown", error: "SUBMIT_RESULT_UNKNOWN",
    });
    const result = await fixture.t.action(internal.firecrawlPortal.executeApprovedWriteForOwner, {
      ownerId: fixture.ownerId, requestId: fixture.requestId,
    });
    expect(result).toMatchObject({ executionId: claim.executionId, status: "unknown", alreadyCompleted: true });
    expect(providerSpies.firecrawlCreateSession).not.toHaveBeenCalled();
    expect(providerSpies.browserbaseLaunch).not.toHaveBeenCalled();
  });

  it("rejects a cross-origin Firecrawl recon path before allocating a session", async () => {
    vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
    const fixture = await portalFixture("firecrawl");
    await expect(fixture.owner.action(api.firecrawlPortal.runRecon, {
      connectionId: fixture.connectionId, path: "https://attacker.invalid/collect",
    })).rejects.toThrow("DOMAIN_NOT_ALLOWED");
    expect(providerSpies.firecrawlCreateSession).not.toHaveBeenCalled();
  });

  it("closes the writable registration session and opens no second proof session", async () => {
    vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
    const fixture = await portalFixture("firecrawl");
    await fixture.t.run((ctx) => ctx.db.patch(fixture.connectionId, { status: "needs_auth" }));
    const events: string[] = [];
    const registrationSession = {
      scrapeId: "registration", profileName: "profile", openedAt: 1,
      stop: vi.fn(async () => { events.push("registration-stop"); }), liveView: vi.fn(),
      lastErrorCode: vi.fn(() => null), runProgram: vi.fn(),
    };
    providerSpies.firecrawlCreateSession
      .mockImplementationOnce(async () => { events.push("registration-open"); return registrationSession; });
    providerSpies.signUp.mockResolvedValueOnce({ outcome: "authenticated", url: "https://roomscout.dev/" });

    await expect(fixture.owner.action(api.firecrawlPortal.startAgentRegistration, { connectionId: fixture.connectionId }))
      .resolves.toMatchObject({ status: "completed" });
    // The authenticated sign-up program IS the proof; the second session that
    // used to fight the first one for the profile write lock is gone.
    expect(events).toEqual(["registration-open", "registration-stop"]);
    expect(providerSpies.firecrawlCreateSession).toHaveBeenCalledOnce();
    expect(providerSpies.verify).not.toHaveBeenCalled();
  });

  it("dispatches the exported compatibility registration entrypoint through Firecrawl proof", async () => {
    vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
    const fixture = await portalFixture("firecrawl");
    await fixture.t.run((ctx) => ctx.db.patch(fixture.connectionId, { status: "needs_auth" }));
    const registrationSession = {
      scrapeId: "registration-exported", profileName: "profile", openedAt: 1,
      stop: vi.fn(async () => undefined), liveView: vi.fn(),
      lastErrorCode: vi.fn(() => null), runProgram: vi.fn(),
    };
    providerSpies.firecrawlCreateSession.mockResolvedValueOnce(registrationSession);
    providerSpies.signUp.mockResolvedValueOnce({ outcome: "authenticated", url: "https://roomscout.dev/" });

    await expect(fixture.owner.action(api.browserbasePortal.startAgentRegistration, { connectionId: fixture.connectionId }))
      .resolves.toMatchObject({ status: "completed" });
    expect(providerSpies.firecrawlCreateSession).toHaveBeenCalledTimes(1);
    expect(providerSpies.browserbaseLaunch).not.toHaveBeenCalled();
    const { connection, context } = await fixture.t.run(async (ctx) => {
      const [connection, context] = await Promise.all([
        ctx.db.get(fixture.connectionId),
        ctx.db.query("browserContexts").withIndex("by_connection", (q) => q.eq("connectionId", fixture.connectionId)).unique(),
      ]);
      return { connection, context };
    });
    expect(connection).toMatchObject({ status: "active" });
    expect(context).toMatchObject({ status: "ready", probeAttempts: 1 });
    expect(context?.lastVerifiedAt).toEqual(expect.any(Number));
  });

  it("rejects a Browserbase producer attaching to a Firecrawl-stamped run", async () => {
    vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
    const fixture = await portalFixture("firecrawl");
    const runId = await fixture.t.mutation(internal.portalConnections.reserveRun, {
      ownerId: fixture.ownerId, connectionId: fixture.connectionId, kind: "authenticate", browserProvider: "firecrawl",
    });
    await expect(fixture.t.mutation(internal.portalConnections.attachProviderRun, {
      ownerId: fixture.ownerId, runId, providerSessionId: "browserbase-session",
      providerContextId: "browserbase-context", browserProvider: "browserbase", humanRequired: false,
    })).rejects.toThrow("PORTAL_BROWSER_PROVIDER_MISMATCH");
  });

  it("persists a fixed Firecrawl registration phase code without provider diagnostics", async () => {
    vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
    const fixture = await portalFixture("firecrawl");
    await fixture.t.run((ctx) => ctx.db.patch(fixture.connectionId, { status: "needs_auth" }));
    providerSpies.firecrawlCreateSession.mockRejectedValueOnce(new Error("sensitive provider response"));

    await expect(fixture.owner.action(api.browserbasePortal.startAgentRegistration, { connectionId: fixture.connectionId }))
      .rejects.toThrow("FIRECRAWL_REGISTRATION_SESSION_OPEN_FAILED");
    expect(providerSpies.browserbaseLaunch).not.toHaveBeenCalled();
    const run = await fixture.t.run(async (ctx) => ctx.db.query("browserRuns").withIndex("by_connection", (q) => q.eq("connectionId", fixture.connectionId)).order("desc").first());
    expect(run).toMatchObject({ status: "failed", errorCode: "FIRECRAWL_REGISTRATION_SESSION_OPEN_FAILED" });
    expect(JSON.stringify(run)).not.toContain("sensitive provider response");
  });

  it("runs a fresh read-only registration preflight without invoking signup", async () => {
    vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
    const fixture = await portalFixture("firecrawl");
    const preflightSession = {
      scrapeId: "preflight", profileName: "preflight", openedAt: 1,
      stop: vi.fn(async () => undefined), liveView: vi.fn(),
      lastErrorCode: vi.fn(() => null), runProgram: vi.fn(),
    };
    providerSpies.firecrawlCreateSession.mockResolvedValueOnce(preflightSession);
    providerSpies.pageState.mockResolvedValueOnce({
      url: "https://roomscout.dev/sign-up", authenticated: false, stage: "sign_up",
      hasPasswordField: true, hasCodeField: false, captcha: false,
    });
    const preflight = makeFunctionReference<"action">("firecrawlPortal:registrationPreflight");
    await expect(fixture.t.action(preflight, { ownerId: fixture.ownerId, connectionId: fixture.connectionId }))
      .resolves.toEqual({ status: "ready", stage: "sign_up" });
    expect(providerSpies.signUp).not.toHaveBeenCalled();
    expect(providerSpies.firecrawlCreateSession).toHaveBeenCalledWith(expect.objectContaining({ saveChanges: false }));
    expect(providerSpies.pageState).toHaveBeenCalledWith(expect.objectContaining({ path: "/sign-up" }));
    expect(preflightSession.stop).toHaveBeenCalledOnce();
  });

  it("fails a registration preflight whose inspected page cannot be classified", async () => {
    vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
    const fixture = await portalFixture("firecrawl");
    const preflightSession = {
      scrapeId: "preflight-unknown", profileName: "preflight-unknown", openedAt: 1,
      stop: vi.fn(async () => undefined), liveView: vi.fn(),
      lastErrorCode: vi.fn(() => null), runProgram: vi.fn(),
    };
    providerSpies.firecrawlCreateSession.mockResolvedValueOnce(preflightSession);
    providerSpies.pageState.mockResolvedValueOnce({
      url: "https://roomscout.dev/unclassified", authenticated: false, stage: "unknown",
      hasPasswordField: false, hasCodeField: false, captcha: false,
    });
    const preflight = makeFunctionReference<"action">("firecrawlPortal:registrationPreflight");

    await expect(fixture.t.action(preflight, { ownerId: fixture.ownerId, connectionId: fixture.connectionId }))
      .resolves.toEqual({ status: "failed", phase: "inspect", errorCode: "FIRECRAWL_PREFLIGHT_STAGE_UNKNOWN" });
    expect(providerSpies.signUp).not.toHaveBeenCalled();
    expect(preflightSession.stop).toHaveBeenCalledOnce();
  });

  it("keeps a confirmed send succeeded but blocks the profile when the writable profile cannot be safely stopped", async () => {
    vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
    const fixture = await portalFixture("firecrawl");
    const writeSession = {
      scrapeId: "write", profileName: "profile", openedAt: 1,
      stop: vi.fn(async () => { throw new Error("PROFILE_STOP_FAILED"); }), liveView: vi.fn(), runProgram: vi.fn(),
    };
    providerSpies.firecrawlCreateSession.mockResolvedValueOnce(writeSession);
    providerSpies.send.mockImplementationOnce(async ({ beforeSubmit }) => {
      await beforeSubmit();
      return { outcome: "submitted", submitted: true, providerThreadId: "thread-confirmed", providerMessageId: "message-confirmed" };
    });

    const result = await fixture.t.action(internal.firecrawlPortal.executeApprovedWriteForOwner, {
      ownerId: fixture.ownerId, requestId: fixture.requestId,
    });
    expect(result).toMatchObject({ status: "succeeded" });
    const state = await fixture.t.run(async (ctx) => ({
      execution: await ctx.db.query("actionExecutions").withIndex("by_request", (q) => q.eq("requestId", fixture.requestId)).unique(),
      context: await ctx.db.query("browserContexts").withIndex("by_connection", (q) => q.eq("connectionId", fixture.connectionId)).unique(),
    }));
    expect(state.execution).toMatchObject({ status: "succeeded", providerMessageId: "message-confirmed", providerActionId: "write" });
    expect(state.context?.status).not.toBe("ready");
    expect(providerSpies.firecrawlCreateSession).toHaveBeenCalledTimes(1);
  });

  it("persists the Firecrawl scrape before submit and records a lost post-click result as unknown", async () => {
    vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
    const fixture = await portalFixture("firecrawl");
    const writeSession = {
      scrapeId: "write-unknown", profileName: "profile", openedAt: 1,
      stop: vi.fn(async () => undefined), liveView: vi.fn(), runProgram: vi.fn(),
    };
    providerSpies.firecrawlCreateSession.mockResolvedValueOnce(writeSession);
    providerSpies.send.mockImplementationOnce(async ({ beforeSubmit }) => {
      await beforeSubmit();
      throw new Error("connection lost after click");
    });

    await expect(fixture.t.action(internal.firecrawlPortal.executeApprovedWriteForOwner, {
      ownerId: fixture.ownerId, requestId: fixture.requestId,
    })).resolves.toMatchObject({ status: "unknown" });
    const execution = await fixture.t.run(async (ctx) => ctx.db.query("actionExecutions").withIndex("by_request", (q) => q.eq("requestId", fixture.requestId)).unique());
    expect(execution).toMatchObject({ status: "unknown", providerActionId: "write-unknown" });
    const again = await fixture.t.action(internal.firecrawlPortal.executeApprovedWriteForOwner, {
      ownerId: fixture.ownerId, requestId: fixture.requestId,
    });
    expect(again).toMatchObject({ status: "unknown", alreadyCompleted: true });
    // One session for the whole write: the profile proof is the send program's
    // own last navigation, so no second session is opened afterwards.
    expect(providerSpies.firecrawlCreateSession).toHaveBeenCalledTimes(1);
  });

  it("binds post-write readiness proof to the exact execution generation", async () => {
    vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
    const fixture = await portalFixture("firecrawl");
    const claim = await fixture.t.mutation(internal.externalActions.claimForExecutor, {
      ownerId: fixture.ownerId, requestId: fixture.requestId, executor: "browserbase",
    });
    const pending = await fixture.t.mutation(internal.portalConnections.markContextPendingAfterWrite, {
      ownerId: fixture.ownerId, connectionId: fixture.connectionId, executionId: claim.executionId,
      browserProvider: "firecrawl",
    });
    const wrongExecutionId = await fixture.t.run(async (ctx) => {
      const original = await ctx.db.get(claim.executionId);
      if (!original) throw new Error("missing claimed execution");
      const { _id, _creationTime, ...fields } = original;
      void _id;
      void _creationTime;
      const inserted = await ctx.db.insert("actionExecutions", {
        ...fields, idempotencyKey: `${fields.idempotencyKey}:wrong`, createdAt: Date.now(), updatedAt: Date.now(),
      });
      await ctx.db.patch(fixture.connectionId, { activeWriteExecutionId: inserted, activeWriteDeadlineAt: Date.now() + 60_000 });
      return inserted;
    });
    expect(wrongExecutionId).not.toBe(claim.executionId);
    await expect(fixture.t.mutation(internal.externalActions.claimForExecutor, {
      ownerId: fixture.ownerId, requestId: fixture.requestId, executor: "browserbase",
    })).rejects.toThrow("PORTAL_CONTEXT_NOT_READY");
    await fixture.t.run(async (ctx) => {
      await ctx.db.patch(fixture.connectionId, { activeWriteExecutionId: claim.executionId, activeWriteDeadlineAt: Date.now() + 60_000 });
    });
    await expect(fixture.t.mutation(internal.portalConnections.recordWriteContextProbe, {
      ownerId: fixture.ownerId, connectionId: fixture.connectionId, contextId: pending.contextId,
      executionId: claim.executionId, browserProvider: "firecrawl", generation: pending.generation + 1,
      success: true, attempt: 1,
    })).rejects.toThrow("PORTAL_WRITE_PROBE_STALE");
    await fixture.t.mutation(internal.portalConnections.recordWriteContextProbe, {
      ownerId: fixture.ownerId, connectionId: fixture.connectionId, contextId: pending.contextId,
      executionId: claim.executionId, browserProvider: "firecrawl", generation: pending.generation,
      success: false, errorCode: "CONTEXT_PROFILE_NOT_READY", attempt: 1, deadlineAt: Date.now() + 60_000,
    });
    const state = await fixture.t.run(async (ctx) => ({
      execution: await ctx.db.get(claim.executionId), context: await ctx.db.get(pending.contextId),
    }));
    expect(state.execution).toMatchObject({ status: "claimed" });
    expect(state.context).toMatchObject({
      status: "creating", pendingWriteExecutionId: claim.executionId,
      writeProofGeneration: pending.generation, probeErrorCode: "CONTEXT_PROFILE_NOT_READY",
    });
  });

  it("recovers an existing Firecrawl profile read-only without replaying signup", async () => {
    vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
    const fixture = await portalFixture("firecrawl");
    await fixture.t.run(async (ctx) => {
      const context = await ctx.db.query("browserContexts").withIndex("by_connection", (q) => q.eq("connectionId", fixture.connectionId)).unique();
      if (!context) throw new Error("missing context");
      await ctx.db.patch(context._id, { status: "failed", probeErrorCode: "CONTEXT_PROFILE_NOT_READY" });
      await ctx.db.patch(fixture.connectionId, { status: "reauth_required" });
    });
    const recoverySession = {
      scrapeId: "recovery", profileName: "firecrawl-profile", openedAt: 1,
      stop: vi.fn(async () => undefined), liveView: vi.fn(),
      lastErrorCode: vi.fn(() => null), runProgram: vi.fn(),
    };
    providerSpies.firecrawlCreateSession.mockResolvedValueOnce(recoverySession);
    providerSpies.pageState.mockResolvedValueOnce({
      url: "https://roomscout.dev/", authenticated: true, stage: "authenticated",
      hasPasswordField: false, hasCodeField: false, captcha: false,
    });

    await expect(fixture.owner.action(api.firecrawlPortal.recoverProfile, { connectionId: fixture.connectionId }))
      .resolves.toEqual({ status: "completed" });
    expect(providerSpies.signUp).not.toHaveBeenCalled();
    expect(providerSpies.firecrawlCreateSession).toHaveBeenCalledWith(expect.objectContaining({
      profileName: "firecrawl-profile", saveChanges: false,
    }));
    const context = await fixture.t.run(async (ctx) => ctx.db.query("browserContexts").withIndex("by_connection", (q) => q.eq("connectionId", fixture.connectionId)).unique());
    expect(context?.status).toBe("ready");
  });

  it("expires an OTP continuation before any provider or mailbox work", async () => {
    vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
    const fixture = await portalFixture("firecrawl");
    const runId = await fixture.t.run(async (ctx) => ctx.db.insert("browserRuns", {
      ownerId: fixture.ownerId, connectionId: fixture.connectionId, browserProvider: "firecrawl",
      kind: "authenticate", status: "running", expiresAt: Date.now() - 1,
      onboardingStage: "waiting_verification", onboardingMailboxId: fixture.mailboxId,
      verificationRequestedAt: Date.now() - 60_000, createdAt: Date.now() - 60_000, updatedAt: Date.now(),
    }));

    await fixture.t.action(internal.firecrawlPortal.continueAgentRegistration, { ownerId: fixture.ownerId, runId });
    expect(providerSpies.firecrawlCreateSession).not.toHaveBeenCalled();
    const run = await fixture.t.run(async (ctx) => ctx.db.get(runId));
    expect(run).toMatchObject({ status: "failed", errorCode: "VERIFICATION_TIMEOUT" });
  });

  it("records OTP submission progress and terminalizes a failed verification continuation", async () => {
    vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
    const fixture = await portalFixture("firecrawl");
    const now = Date.now();
    const runId = await fixture.t.run(async (ctx) => {
      const id = await ctx.db.insert("browserRuns", {
        ownerId: fixture.ownerId, connectionId: fixture.connectionId, browserProvider: "firecrawl",
        kind: "authenticate", status: "running", expiresAt: now + 60_000,
        onboardingStage: "waiting_verification", onboardingMailboxId: fixture.mailboxId,
        verificationRequestedAt: now - 5_000, createdAt: now - 5_000, updatedAt: now,
      });
      await ctx.db.insert("mailboxMessages", {
        ownerId: fixture.ownerId, mailboxId: fixture.mailboxId,
        providerThreadId: "verification-thread", providerMessageId: "verification-message",
        providerEventId: "verification-event",
        from: "accounts@roomscout.dev", to: ["firecrawl@agentmail.test"],
        subject: "Your RoomScout verification code", body: "Your verification code is 123456",
        kind: "portal_verification", status: "unread", htmlAvailable: false,
        receivedAt: now, createdAt: now, updatedAt: now,
      });
      return id;
    });
    providerSpies.firecrawlCreateSession.mockResolvedValueOnce({
      scrapeId: "otp-session", profileName: "firecrawl-profile", openedAt: now,
      stop: vi.fn(async () => undefined), liveView: vi.fn(),
      lastErrorCode: vi.fn(() => null), runProgram: vi.fn(),
    });
    providerSpies.submitCode.mockRejectedValueOnce(new Error("FIRECRAWL_PORTAL_INTERACT_REQUEST_REJECTED"));

    await fixture.t.action(internal.firecrawlPortal.continueAgentRegistration, { ownerId: fixture.ownerId, runId });

    expect(providerSpies.submitCode).toHaveBeenCalledWith(expect.objectContaining({ code: "123456" }));
    const { run, events } = await fixture.t.run(async (ctx) => ({
      run: await ctx.db.get(runId),
      events: await ctx.db.query("browserRunEvents").withIndex("by_run", (q) => q.eq("runId", runId)).collect(),
    }));
    expect(run).toMatchObject({
      status: "failed", onboardingStage: "failed",
      errorCode: "FIRECRAWL_PORTAL_INTERACT_REQUEST_REJECTED",
    });
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "progress", message: "VERIFICATION_CODE_RECEIVED" }),
    ]));
  });
});
