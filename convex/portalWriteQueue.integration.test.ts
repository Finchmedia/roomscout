/// <reference types="vite/client" />
import workpoolTest from "@convex-dev/workpool/test";
import { convexTest } from "convex-test";
import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { actionPayloadHash } from "./integrations/contentHash";
import { pendingPortalWrites } from "./portalWriteQueue.testSupport";
import schema from "./schema";

const providerSpies = vi.hoisted(() => ({ firecrawlCreateSession: vi.fn() }));
vi.mock("./integrations/firecrawlPortalRuntime", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./integrations/firecrawlPortalRuntime")>()),
  createFirecrawlPortalSession: providerSpies.firecrawlCreateSession,
}));

const modules = import.meta.glob("./**/*.ts");
// Fake timers keep enqueued pool items pending: convex-test runs scheduled
// functions through a real setTimeout, which would execute the workers in the
// background across tests (convex-test creation times stay monotonic).
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllEnvs(); });

/** One approved exact controlled-portal write on a browserbase binding (mirrors firecrawlProviderIsolation). */
async function fixture(provider: "firecrawl" | "browserbase") {
  const t = convexTest(schema, modules);
  workpoolTest.register(t, "browserWorkpool");
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await ctx.db.insert("users", { username: `queue-${provider}`, firstName: "Mina", actKind: "band", actName: "Night Owls", providerIdentityConfirmedAt: now, role: "musician", createdAt: now, lastSeenAt: now });
    const platformId = await ctx.db.insert("sourcePlatforms", { slug: `queue-${provider}`, name: "Controlled portal", canonicalDomain: "roomscout.dev", kind: "community", status: "active", firstSeenAt: now, lastObservedAt: now, createdAt: now, updatedAt: now });
    const sourceId = await ctx.db.insert("sources", { platformId, slug: `queue-${provider}-source`, name: "Controlled portal", baseUrl: "https://roomscout.dev/", side: "both", status: "active", health: "healthy", accessMode: "authenticated", automationReview: "approved", adapterKey: "roomscout-dev-v1", createdAt: now, updatedAt: now });
    const connection = { ownerId, sourceId, platformId, browserProvider: provider, allowedDomains: ["roomscout.dev"], allowedPaths: ["/", "/inbox", "/listings"], inboxPath: "/inbox", adapterKey: "roomscout-dev-v1", status: "active" as const, policyDecision: "allowed" as const, allowReadOnlyRecon: true, allowInboxPolling: true, pollIntervalMinutes: 30, failureCount: 0, createdAt: now, updatedAt: now };
    const connectionId = await ctx.db.insert("portalConnections", { ...connection, label: "Controlled" });
    const otherConnectionId = await ctx.db.insert("portalConnections", { ...connection, label: "Other" });
    const contextId = await ctx.db.insert("browserContexts", { ownerId, connectionId, providerContextId: `${provider}-profile`, browserProvider: provider, status: "ready", lastVerifiedAt: now, createdAt: now, updatedAt: now });
    const policyId = await ctx.db.insert("sourceFlowPolicies", { platformId, sourceId, scopeKey: "controlled:contact", flow: "contact", version: 1, status: "approved", decision: "allowed", maxAutomationLevel: "approved_execute", userConnectionRequired: true, humanPresenceRequired: false, accountCreationAllowed: false, externalApprovalRequired: true, robotsDecision: "allowed", termsDecision: "allowed", evidenceUrls: ["https://roomscout.dev/terms"], createdAt: now, updatedAt: now });
    const bindingId = await ctx.db.insert("sourceAdapterBindings", { platformId, sourceId, scopeKey: "controlled:contact", flow: "contact", adapterKey: "roomscout-dev-v1", adapterVersion: 1, status: "active", executor: "browserbase", config: { kind: "browserbase", workflowKey: "roomscout-dev.platform-message.v1", contextRequired: true }, configFingerprint: "queue", policyVersionId: policyId, createdAt: now, updatedAt: now });
    const payload = { kind: "platform_message" as const, targetPath: "/listings", recipients: ["Owner"], body: "Is the room available?" };
    const contentHash = await actionPayloadHash(payload);
    const requestId = await ctx.db.insert("actionRequests", { ownerId, platformId, connectionId, policyVersionId: policyId, adapterBindingId: bindingId, automationMode: "exact_once", requestedActionType: "send_platform_dm", personalDataScopes: [], payload, contentVersion: 1, contentHash, status: "approved", createdAt: now, updatedAt: now });
    await ctx.db.insert("actionApprovals", { requestId, ownerId, contentVersion: 1, contentHash, payloadSnapshot: payload, policyVersionId: policyId, decision: "approved", decidedAt: now });
    return { ownerId, connectionId, otherConnectionId, contextId, requestId, policyId };
  });
  const prepareClaim = () => t.mutation(internal.externalActions.prepareClaim, { ownerId: ids.ownerId, requestId: ids.requestId, executor: "browserbase" });
  const claim = () => t.mutation(internal.externalActions.claimForExecutor, { ownerId: ids.ownerId, requestId: ids.requestId, executor: "browserbase" });
  const release = (executionId: Id<"actionExecutions">, reason = "BROWSER_CONTEXT_BUSY") =>
    t.mutation(internal.externalActions.releaseUnstartedClaim, { ownerId: ids.ownerId, requestId: ids.requestId, executionId, reason });
  const state = (executionId: Id<"actionExecutions">) => t.run(async (ctx) => ({
    request: await ctx.db.get(ids.requestId), execution: await ctx.db.get(executionId), connection: await ctx.db.get(ids.connectionId),
  }));
  const scheduledNames = async () => (await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect())).map((row) => row.name);
  /** A read running on another connection's row, referenced by this context: invisible to browserSessionBusy, visible to claimWriteSession. */
  const attachForeignRunningRead = () => t.run(async (ctx) => {
    const now = Date.now();
    const runId = await ctx.db.insert("browserRuns", { connectionId: ids.otherConnectionId, ownerId: ids.ownerId, kind: "inbox_sync", status: "running", expiresAt: now + 60_000, createdAt: now, updatedAt: now });
    await ctx.db.patch(ids.contextId, { activeRunId: runId });
  });
  return { t, ...ids, prepareClaim, claim, release, state, scheduledNames, attachForeignRunningRead };
}

describe("approved portal writes enter the shared browser pool", () => {
  it.each(["browserbase", "firecrawl"] as const)("dispatchApproved enqueues exactly one %s write-worker item and nothing on the scheduler", async (provider) => {
    if (provider === "firecrawl") vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
    const f = await fixture(provider);
    await f.t.mutation(internal.externalActions.redispatchApproved, { ownerId: f.ownerId, requestId: f.requestId });
    const worker = provider === "firecrawl" ? internal.firecrawlPortal.executeApprovedWriteWorker : internal.browserbasePortal.executeApprovedWriteWorker;
    const work = await pendingPortalWrites(f.t);
    expect(work).toHaveLength(1);
    expect(work[0]).toMatchObject({ fnName: getFunctionName(worker), fnArgs: { ownerId: f.ownerId, requestId: f.requestId }, attempts: 0 });
    expect(work[0]!.fnArgs).not.toHaveProperty("busyAttempt");
    expect(work[0]!.retryBehavior).toBeUndefined();
    expect(await f.scheduledNames()).not.toContain(getFunctionName(worker));
  });

  it("redispatchApproved passes busyAttempt into the pool item", async () => {
    const f = await fixture("browserbase");
    await f.t.mutation(internal.externalActions.redispatchApproved, { ownerId: f.ownerId, requestId: f.requestId, busyAttempt: 3 });
    expect((await pendingPortalWrites(f.t))[0]?.fnArgs).toEqual({ ownerId: f.ownerId, requestId: f.requestId, busyAttempt: 3 });
  });
});

describe("releaseUnstartedClaim", () => {
  it("returns a stranded fresh claim to the approved ledger exactly once and frees the key for a new claim", async () => {
    const f = await fixture("browserbase");
    const claim = await f.claim();
    expect(claim.alreadyClaimed).toBe(false);
    const before = await f.state(claim.executionId);
    const originalKey = before.request!.executionIdempotencyKey!;
    expect(before.request).toMatchObject({ status: "executing" });
    expect(before.connection).toMatchObject({ activeWriteExecutionId: claim.executionId });

    expect(await f.release(claim.executionId)).toBe(true);
    const after = await f.state(claim.executionId);
    expect(after.request).toMatchObject({ status: "approved", error: "EXECUTION_RELEASED_BEFORE_PROVIDER:BROWSER_CONTEXT_BUSY" });
    expect(after.request?.executionIdempotencyKey).toBeUndefined();
    expect(after.execution).toMatchObject({ status: "failed", error: "EXECUTION_RELEASED_BEFORE_PROVIDER:BROWSER_CONTEXT_BUSY", idempotencyKey: `${originalKey}:released:${claim.executionId}` });
    expect(after.connection?.activeWriteExecutionId).toBeUndefined();
    expect(after.connection?.activeWriteDeadlineAt).toBeUndefined();
    const audit = await f.t.run((ctx) => ctx.db.query("auditEvents").withIndex("by_event_key", (q) => q.eq("eventKey", `action:${f.requestId}:released:${claim.executionId}`)).unique());
    expect(audit).toMatchObject({ eventType: "action.execution_released", actorType: "system", actorUserId: f.ownerId, correlationId: originalKey, executionId: claim.executionId, policyId: f.policyId, summary: "BROWSER_CONTEXT_BUSY" });

    expect(await f.release(claim.executionId)).toBe(false);
    const again = await f.claim();
    expect(again.alreadyClaimed).toBe(false);
    expect(again.executionId).not.toBe(claim.executionId);
    const reclaimed = await f.state(again.executionId);
    expect(reclaimed.request).toMatchObject({ status: "executing", executionIdempotencyKey: originalKey });
    expect(reclaimed.request?.error).toBeUndefined();
    const claimedKeys = (await f.t.run((ctx) => ctx.db.query("auditEvents").withIndex("by_action_request_and_occurred_at", (q) => q.eq("actionRequestId", f.requestId)).collect()))
      .filter((row) => row.eventType === "action.execution_claimed").map((row) => row.eventKey);
    expect(new Set(claimedKeys).size).toBe(2);
  });

  it("refuses once a provider operation is attached", async () => {
    const f = await fixture("browserbase");
    const claim = await f.claim();
    await f.t.run((ctx) => ctx.db.patch(claim.executionId, { providerActionId: "session-1" }));
    expect(await f.release(claim.executionId)).toBe(false);
    expect((await f.state(claim.executionId)).request).toMatchObject({ status: "executing" });
  });

  it("refuses when the newest context carries this execution's write proof generation", async () => {
    const f = await fixture("browserbase");
    const claim = await f.claim();
    await f.t.run((ctx) => ctx.db.insert("browserContexts", { ownerId: f.ownerId, connectionId: f.connectionId, providerContextId: "profile-2", browserProvider: "browserbase", status: "creating", pendingWriteExecutionId: claim.executionId, writeProofGeneration: 1, createdAt: Date.now() + 1, updatedAt: Date.now() + 1 }));
    expect(await f.release(claim.executionId)).toBe(false);
    expect((await f.state(claim.executionId)).execution).toMatchObject({ status: "claimed" });
  });
});

describe("busy checks for writes", () => {
  it("a merely queued inbox lease does not block prepareClaim, claimForExecutor or claimWriteSession", async () => {
    const f = await fixture("browserbase");
    await f.t.run((ctx) => ctx.db.patch(f.connectionId, { inboxSyncActiveGeneration: 1, inboxSyncDeadlineAt: Date.now() + 60_000 }));
    expect(await f.prepareClaim()).toEqual({ outcome: "proceed" });
    const claim = await f.claim();
    expect(claim.alreadyClaimed).toBe(false);
    expect(await f.t.mutation(internal.portalConnections.claimWriteSession, { ownerId: f.ownerId, connectionId: f.connectionId, executionId: claim.executionId, browserProvider: "browserbase" })).toBe(true);
  });

  it("a running read (browserRuns row) still blocks the claim", async () => {
    const f = await fixture("browserbase");
    await f.t.run(async (ctx) => {
      const now = Date.now();
      const runId = await ctx.db.insert("browserRuns", { connectionId: f.connectionId, ownerId: f.ownerId, contextId: f.contextId, kind: "inbox_sync", status: "running", expiresAt: now + 60_000, createdAt: now, updatedAt: now });
      await ctx.db.patch(f.contextId, { activeRunId: runId });
    });
    expect(await f.prepareClaim()).toMatchObject({ outcome: "wait", reason: "browser_busy" });
    await expect(f.claim()).rejects.toThrow("BROWSER_SESSION_BUSY");
  });

  it("a running read referenced by the context still blocks claimWriteSession", async () => {
    const f = await fixture("browserbase");
    const claim = await f.claim();
    await f.attachForeignRunningRead();
    expect(await f.t.mutation(internal.portalConnections.claimWriteSession, { ownerId: f.ownerId, connectionId: f.connectionId, executionId: claim.executionId, browserProvider: "browserbase" })).toBe(false);
  });
});

describe("Firecrawl write worker pre-provider release", () => {
  it("BROWSER_CONTEXT_BUSY after the claim releases it and reports released: true without opening a session", async () => {
    vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
    vi.stubEnv("FIRECRAWL_API_KEY", "firecrawl-test-key");
    const f = await fixture("firecrawl");
    await f.attachForeignRunningRead();
    await expect(f.t.action(internal.firecrawlPortal.executeApprovedWriteForOwner, { ownerId: f.ownerId, requestId: f.requestId }))
      .rejects.toMatchObject({ data: { code: "BROWSER_CONTEXT_BUSY", released: true } });
    const execution = await f.t.run((ctx) => ctx.db.query("actionExecutions").withIndex("by_request", (q) => q.eq("requestId", f.requestId)).unique());
    expect(execution).toMatchObject({ status: "failed", error: "EXECUTION_RELEASED_BEFORE_PROVIDER:BROWSER_CONTEXT_BUSY" });
    const after = await f.state(execution!._id);
    expect(after.request).toMatchObject({ status: "approved", error: "EXECUTION_RELEASED_BEFORE_PROVIDER:BROWSER_CONTEXT_BUSY" });
    expect(after.request?.executionIdempotencyKey).toBeUndefined();
    expect(after.connection?.activeWriteExecutionId).toBeUndefined();
    expect(providerSpies.firecrawlCreateSession).not.toHaveBeenCalled();
  });

  it("a non-busy pre-provider failure releases the claim and parks the request as approved with the reason", async () => {
    vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
    vi.stubEnv("FIRECRAWL_API_KEY", "firecrawl-test-key");
    const f = await fixture("firecrawl");
    // A ready context without a profile id passes the claim but fails connectionForFirecrawl with PORTAL_REAUTH_REQUIRED.
    await f.t.run((ctx) => ctx.db.patch(f.contextId, { providerContextId: "" }));
    await expect(f.t.action(internal.firecrawlPortal.executeApprovedWriteForOwner, { ownerId: f.ownerId, requestId: f.requestId }))
      .rejects.toMatchObject({ data: { code: "PORTAL_REAUTH_REQUIRED" } });
    const execution = await f.t.run((ctx) => ctx.db.query("actionExecutions").withIndex("by_request", (q) => q.eq("requestId", f.requestId)).unique());
    expect(execution).toMatchObject({ status: "failed", error: "EXECUTION_RELEASED_BEFORE_PROVIDER:PORTAL_REAUTH_REQUIRED" });
    const after = await f.state(execution!._id);
    expect(after.request).toMatchObject({ status: "approved", error: "EXECUTION_RELEASED_BEFORE_PROVIDER:PORTAL_REAUTH_REQUIRED" });
    expect(after.connection?.activeWriteExecutionId).toBeUndefined();
    expect(await pendingPortalWrites(f.t)).toHaveLength(0);
    expect(providerSpies.firecrawlCreateSession).not.toHaveBeenCalled();
  });
});
