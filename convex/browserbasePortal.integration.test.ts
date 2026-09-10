/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { browserbase, Stagehand } from "@browserbasehq/stagehand";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { ensureRegistrationProviderContext, initializePortalBrowser, registrationLaunchDiagnostic, registrationStartFailureCode } from "./browserbasePortal";
import schema from "./schema";

vi.mock("./integrations/env", () => ({
  envValue: vi.fn((name: string) => name === "BROWSERBASE_API_KEY" ? "test-browserbase-key" : process.env[name]),
}));

const browserbaseSdk = vi.hoisted(() => ({
  contextsCreate: vi.fn(),
  contextsDelete: vi.fn(),
  contextsRetrieve: vi.fn(),
  sessionsUpdate: vi.fn(),
}));

vi.mock("@browserbasehq/sdk", () => ({
  Browserbase: vi.fn(function Browserbase() {
    return {
      contexts: {
        create: browserbaseSdk.contextsCreate,
        delete: browserbaseSdk.contextsDelete,
        retrieve: browserbaseSdk.contextsRetrieve,
      },
      sessions: { update: browserbaseSdk.sessionsUpdate },
    };
  }),
}));

vi.mock("@browserbasehq/stagehand", () => ({
  Stagehand: { create: vi.fn().mockResolvedValue({}) },
  browserbase: {
    connect: vi.fn(),
    launch: vi.fn(),
  },
}));

const modules = import.meta.glob("./**/*.ts");

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CONVEX_CLOUD_URL", "https://perceptive-antelope-445.eu-west-1.convex.cloud");
  vi.stubEnv("CONVEX_SITE_URL", "https://perceptive-antelope-445.eu-west-1.convex.site");
});
afterEach(() => vi.unstubAllEnvs());

it("allows repeated auth, inbox, and recon reservations past the former quotas", async () => {
  const t = convexTest(schema, modules);
  const { ownerId, connectionId } = await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await ctx.db.insert("users", { username: "repeat-auth", role: "musician", createdAt: now, lastSeenAt: now });
    const sourceId = await ctx.db.insert("sources", { slug: "repeat-auth-source", name: "Repeat auth", baseUrl: "https://roomscout.dev", side: "both", status: "active", health: "healthy", accessMode: "authenticated", automationReview: "approved", createdAt: now, updatedAt: now });
    const connectionId = await ctx.db.insert("portalConnections", { ownerId, sourceId, label: "Repeat auth", allowedDomains: ["roomscout.dev"], allowedPaths: ["/sign-in"], status: "needs_auth", policyDecision: "allowed", allowReadOnlyRecon: true, allowInboxPolling: true, pollIntervalMinutes: 30, failureCount: 0, createdAt: now, updatedAt: now });
    return { ownerId, connectionId };
  });
  for (const kind of ["authenticate", "inbox_sync", "recon"] as const) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const runId = await t.mutation(internal.portalConnections.reserveRun, { ownerId, connectionId, kind });
      await t.mutation(internal.portalConnections.finishRun, { runId, status: "failed", errorCode: "PROVIDER_UNAVAILABLE" });
    }
  }
  await expect(t.mutation(internal.portalConnections.reserveRun, { ownerId, connectionId, kind: "authenticate" })).resolves.toBeDefined();
  expect(await t.run((ctx) => ctx.db.get(connectionId))).not.toHaveProperty("circuitOpenUntil");
});

it("allows live browser runs on independent connections while excluding the same connection", async () => {
  const t = convexTest(schema, modules);
  const fixture = await t.run(async (ctx) => {
    const now = Date.now();
    const firstOwnerId = await ctx.db.insert("users", { username: "parallel-one", role: "musician", createdAt: now, lastSeenAt: now });
    const secondOwnerId = await ctx.db.insert("users", { username: "parallel-two", role: "musician", createdAt: now, lastSeenAt: now });
    const sourceId = await ctx.db.insert("sources", { slug: "parallel-source", name: "Parallel source", baseUrl: "https://roomscout.dev", side: "both", status: "active", health: "healthy", accessMode: "authenticated", automationReview: "approved", createdAt: now, updatedAt: now });
    const makeConnection = (ownerId: typeof firstOwnerId, label: string) => ctx.db.insert("portalConnections", { ownerId, sourceId, label, allowedDomains: ["roomscout.dev"], allowedPaths: ["/inbox"], status: "active" as const, policyDecision: "allowed" as const, allowReadOnlyRecon: true, allowInboxPolling: true, pollIntervalMinutes: 30, failureCount: 0, createdAt: now, updatedAt: now });
    return { firstOwnerId, secondOwnerId, firstConnectionId: await makeConnection(firstOwnerId, "First"), secondConnectionId: await makeConnection(secondOwnerId, "Second") };
  });
  await expect(t.mutation(internal.portalConnections.reserveRun, { ownerId: fixture.firstOwnerId, connectionId: fixture.firstConnectionId, kind: "inbox_sync" })).resolves.toBeDefined();
  await expect(t.mutation(internal.portalConnections.reserveRun, { ownerId: fixture.secondOwnerId, connectionId: fixture.secondConnectionId, kind: "inbox_sync" })).resolves.toBeDefined();
  await expect(t.mutation(internal.portalConnections.reserveRun, { ownerId: fixture.firstOwnerId, connectionId: fixture.firstConnectionId, kind: "recon" })).rejects.toThrow("BROWSER_SESSION_BUSY");
});

it("reports only allowlisted registration start stage, SDK name, and HTTP status", () => {
  const error = Object.assign(new Error("raw provider response with secret"), {
    name: "AuthenticationError",
    status: 401,
    error: { apiKey: "must-not-leak" },
  });
  const code = registrationStartFailureCode("context_create", error);
  expect(code).toBe("AGENT_REGISTRATION_CONTEXT_CREATE_AUTHENTICATION_HTTP_401");
  expect(code).not.toContain("secret");
  expect(code).not.toContain("apiKey");
});

it("preserves quota exhaustion as a safe structured launch status", () => {
  expect(registrationStartFailureCode("browser_launch", { status: 402, message: "private billing details" }))
    .toBe("AGENT_REGISTRATION_BROWSER_LAUNCH_HTTP_402");
});

it("fails closed to a fixed stage code for unknown provider errors", () => {
  expect(registrationStartFailureCode("browser_launch", {
    name: "UnexpectedProviderError",
    status: 418,
    message: "arbitrary provider content",
  })).toBe("AGENT_REGISTRATION_BROWSER_LAUNCH_FAILED");
  expect(registrationStartFailureCode("session_validation", new Error("PROVIDER_SESSION_MISSING")))
    .toBe("AGENT_REGISTRATION_SESSION_VALIDATION_FAILED");
});

it("classifies only fixed Stagehand templates and safe cause metadata", () => {
  const cause = Object.assign(new Error("raw API response"), {
    name: "PermissionDeniedError",
    status: 403,
    responseBody: "must not leak",
  });
  const error = new Error("Failed to upload the Stagehand extension to Browserbase", { cause });
  const diagnostic = registrationLaunchDiagnostic(error);
  expect(diagnostic).toEqual({
    errorCode: "STAGEHAND_EXTENSION_UPLOAD_FAILED",
    errorName: "Error",
    causeName: "PermissionDeniedError",
    causeStatus: "HTTP_403",
    ownErrorKeys: ["cause"],
  });
  expect(JSON.stringify(diagnostic)).not.toContain("raw API response");
  expect(JSON.stringify(diagnostic)).not.toContain("must not leak");
});

it("reuses a provider-confirmed registration context", async () => {
  browserbaseSdk.contextsRetrieve.mockResolvedValueOnce({ id: "live-context" });
  await expect(ensureRegistrationProviderContext(
    { contexts: { retrieve: browserbaseSdk.contextsRetrieve, create: browserbaseSdk.contextsCreate } },
    "live-context",
    "run-1",
  )).resolves.toEqual({ providerContextId: "live-context", created: false });
  expect(browserbaseSdk.contextsCreate).not.toHaveBeenCalled();
});

it("replaces a persisted registration context that the provider no longer has", async () => {
  browserbaseSdk.contextsRetrieve.mockRejectedValueOnce({ status: 404 });
  browserbaseSdk.contextsCreate.mockResolvedValueOnce({ id: "replacement-context" });
  await expect(ensureRegistrationProviderContext(
    { contexts: { retrieve: browserbaseSdk.contextsRetrieve, create: browserbaseSdk.contextsCreate } },
    "stale-context",
    "run-2",
  )).resolves.toEqual({ providerContextId: "replacement-context", created: true });
  expect(browserbaseSdk.contextsCreate).toHaveBeenCalledWith({ name: "roomscout-agent-run-2" });
});

it("does not hide non-404 context validation failures", async () => {
  browserbaseSdk.contextsRetrieve.mockRejectedValueOnce({ status: 503 });
  await expect(ensureRegistrationProviderContext(
    { contexts: { retrieve: browserbaseSdk.contextsRetrieve, create: browserbaseSdk.contextsCreate } },
    "unknown-context",
    "run-3",
  )).rejects.toMatchObject({ status: 503 });
  expect(browserbaseSdk.contextsCreate).not.toHaveBeenCalled();
});

async function registrationGuardFixture(options: {
  sourceReviewed: boolean;
  connectionOwnedByActor: boolean;
}) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const actorId = await ctx.db.insert("users", {
      username: "roomscout-backend-proof-actor-a",
      role: "musician",
      controlledProofActorKey: "actor_a",
      createdAt: now,
      lastSeenAt: now,
    });
    await ctx.db.insert("users", {
      username: "roomscout-backend-proof-actor-b",
      role: "musician",
      controlledProofActorKey: "actor_b",
      createdAt: now,
      lastSeenAt: now,
    });
    const otherOwnerId = await ctx.db.insert("users", {
      username: "other-registration-owner",
      role: "musician",
      createdAt: now,
      lastSeenAt: now,
    });
    const platformId = await ctx.db.insert("sourcePlatforms", {
      slug: "controlled-registration-portal",
      name: "Controlled registration portal",
      canonicalDomain: "roomscout.dev",
      kind: "marketplace",
      status: "active",
      firstSeenAt: now,
      lastObservedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    const sourceId = await ctx.db.insert("sources", {
      platformId,
      slug: "roomscout-dev-connected",
      name: "RoomScout controlled portal",
      baseUrl: "https://roomscout.dev",
      side: "both",
      status: "active",
      health: "healthy",
      accessMode: "authenticated",
      automationReview: options.sourceReviewed ? "approved" : "pending",
      adapterKey: "roomscout-dev-v1",
      createdAt: now,
      updatedAt: now,
    });
    const connectionId = await ctx.db.insert("portalConnections", {
      ownerId: options.connectionOwnedByActor ? actorId : otherOwnerId,
      sourceId,
      platformId,
      label: "Controlled registration",
      allowedDomains: ["roomscout.dev"],
      allowedPaths: ["/", "/sign-up", "/sign-in"],
      adapterKey: "roomscout-dev-v1",
      status: "needs_auth",
      policyDecision: "allowed",
      allowReadOnlyRecon: false,
      allowInboxPolling: true,
      pollIntervalMinutes: 30,
      failureCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    return { actorId, connectionId };
  });
  return { t, ...ids };
}

it("clears only a failed controlled registration and invalidates its stale context", async () => {
  const fixture = await registrationGuardFixture({ sourceReviewed: true, connectionOwnedByActor: true });
  const contextId = await fixture.t.run(async (ctx) => {
    await ctx.db.patch(fixture.connectionId, {
      failureCount: 3,
      circuitOpenUntil: Date.now() + 86_400_000,
      lastErrorCode: "AGENT_REGISTRATION_BROWSER_LAUNCH_FAILED",
    });
    return await ctx.db.insert("browserContexts", {
      connectionId: fixture.connectionId,
      ownerId: fixture.actorId,
      providerContextId: "provider-context-that-was-deleted",
      status: "ready",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });
  await expect(fixture.t.mutation(
    internal.portalConnections.resetControlledRegistrationFailure,
    {
      ownerId: fixture.actorId,
      connectionId: fixture.connectionId,
      confirmation: "RESET_CONTROLLED_REGISTRATION_FAILURE",
    },
  )).resolves.toEqual({ contextInvalidated: true });
  expect(await fixture.t.run(async (ctx) => ctx.db.get(fixture.connectionId))).toMatchObject({
    failureCount: 0,
    status: "needs_auth",
  });
  expect(await fixture.t.run(async (ctx) => ctx.db.get(contextId))).toMatchObject({
    status: "failed",
  });
});

async function failedStartupFixture(options: {
  connectionOwnedByActor?: boolean; sourceReviewed?: boolean; providerSessionId?: string;
  errorCode?: string; status?: "failed" | "running";
} = {}) {
  const fixture = await registrationGuardFixture({
    sourceReviewed: options.sourceReviewed ?? true,
    connectionOwnedByActor: options.connectionOwnedByActor ?? true,
  });
  await fixture.t.run(async (ctx) => {
    const connection = (await ctx.db.get(fixture.connectionId))!;
    await ctx.db.insert("browserRuns", {
      ownerId: connection.ownerId, connectionId: connection._id,
      kind: "authenticate", status: options.status ?? "failed",
      errorCode: options.errorCode ?? "AGENT_REGISTRATION_BROWSER_LAUNCH_SESSION",
      ...(options.providerSessionId ? { providerSessionId: options.providerSessionId } : {}),
      expiresAt: Date.now() + 60_000, createdAt: Date.now(), updatedAt: Date.now(),
    });
    await ctx.db.patch(connection._id, { failureCount: 3,
      lastErrorCode: "AGENT_REGISTRATION_BROWSER_LAUNCH_SESSION", circuitOpenUntil: Date.now() + 60_000 });
  });
  return { ...fixture, asOwner: fixture.t.withIdentity({ subject: fixture.actorId }) };
}

it("allows repeated owner startup recovery without registering or activating", async () => {
  const fixture = await failedStartupFixture();
  await expect(fixture.asOwner.mutation(api.portalConnections.recoverFailedRegistration, {
    connectionId: fixture.connectionId,
  })).resolves.toBeNull();
  expect(await fixture.t.run(async (ctx) => ctx.db.get(fixture.connectionId)))
    .toMatchObject({ status: "needs_auth", failureCount: 0 });
  await fixture.t.run(async (ctx) => {
    const now = Date.now();
    await ctx.db.insert("browserRuns", { ownerId: fixture.actorId, connectionId: fixture.connectionId,
      kind: "authenticate", status: "failed", errorCode: "AGENT_REGISTRATION_BROWSER_LAUNCH_SESSION",
      expiresAt: now + 60_000, createdAt: now, updatedAt: now });
  });
  await expect(fixture.asOwner.mutation(api.portalConnections.recoverFailedRegistration, {
    connectionId: fixture.connectionId,
  })).resolves.toBeNull();
  expect(browserbase.launch).not.toHaveBeenCalled();
});

it("rejects recovery by an unauthenticated caller or a different owner", async () => {
  const fixture = await failedStartupFixture({ connectionOwnedByActor: false });
  await expect(fixture.t.mutation(api.portalConnections.recoverFailedRegistration, {
    connectionId: fixture.connectionId,
  })).rejects.toThrow("UNAUTHENTICATED");
  await expect(fixture.asOwner.mutation(api.portalConnections.recoverFailedRegistration, {
    connectionId: fixture.connectionId,
  })).rejects.toThrow("CONNECTION_NOT_FOUND");
});

it.each([
  { providerSessionId: "already-reached-provider" },
  { errorCode: "SIGNUP_PASSWORD_REQUIRES_HUMAN" },
  { status: "running" as const },
  { sourceReviewed: false },
])("refuses recovery for unsafe or unreviewed state: %j", async (options) => {
  const fixture = await failedStartupFixture(options);
  await expect(fixture.asOwner.mutation(api.portalConnections.recoverFailedRegistration, {
    connectionId: fixture.connectionId,
  })).rejects.toThrow("REGISTRATION_RECOVERY_NOT_AVAILABLE");
});

it("never permits owner recovery for a different portal host", async () => {
  const fixture = await failedStartupFixture();
  await fixture.t.run(async (ctx) => {
    const connection = (await ctx.db.get(fixture.connectionId))!;
    await ctx.db.patch(connection.sourceId, { baseUrl: "https://different-portal.example" });
  });
  await expect(fixture.asOwner.mutation(api.portalConnections.recoverFailedRegistration, {
    connectionId: fixture.connectionId,
  })).rejects.toThrow("CONTROLLED_REGISTRATION_RECOVERY_REJECTED");
});

it("rejects a controlled proof actor using another owner's connection before provider work", async () => {
  const fixture = await registrationGuardFixture({ sourceReviewed: true, connectionOwnedByActor: false });
  vi.mocked(browserbase.connect).mockClear();
  vi.mocked(browserbase.launch).mockClear();
  await expect(fixture.t.action(internal.browserbasePortal.startControlledProofAgentRegistration, {
    actorKey: "actor_a",
    connectionId: fixture.connectionId,
  })).rejects.toThrow("PORTAL_CONNECTION_NOT_READY");
  expect(browserbase.connect).not.toHaveBeenCalled();
  expect(browserbase.launch).not.toHaveBeenCalled();
});

it("rejects an unreviewed source for controlled proof registration before provider work", async () => {
  const fixture = await registrationGuardFixture({ sourceReviewed: false, connectionOwnedByActor: true });
  vi.mocked(browserbase.connect).mockClear();
  vi.mocked(browserbase.launch).mockClear();
  await expect(fixture.t.action(internal.browserbasePortal.startControlledProofAgentRegistration, {
    actorKey: "actor_a",
    connectionId: fixture.connectionId,
  })).rejects.toThrow("PORTAL_CONNECTION_NOT_READY");
  expect(browserbase.connect).not.toHaveBeenCalled();
  expect(browserbase.launch).not.toHaveBeenCalled();
});

it("rejects controlled proof registration outside the exact Development deployment", async () => {
  const fixture = await registrationGuardFixture({ sourceReviewed: true, connectionOwnedByActor: true });
  vi.stubEnv("CONVEX_CLOUD_URL", "https://production.example.convex.cloud");
  vi.stubEnv("CONVEX_SITE_URL", "https://production.example.convex.site");
  vi.mocked(browserbase.connect).mockClear();
  vi.mocked(browserbase.launch).mockClear();
  await expect(fixture.t.action(internal.browserbasePortal.startControlledProofAgentRegistration, {
    actorKey: "actor_a",
    connectionId: fixture.connectionId,
  })).rejects.toThrow("CONTROLLED_PROOF_DEVELOPMENT_ONLY");
  expect(browserbase.connect).not.toHaveBeenCalled();
  expect(browserbase.launch).not.toHaveBeenCalled();
});

it("probes the registration launcher without navigation and releases session and context", async () => {
  const fixture = await registrationGuardFixture({ sourceReviewed: true, connectionOwnedByActor: true });
  const close = vi.fn();
  browserbaseSdk.contextsCreate.mockResolvedValueOnce({ id: "probe-context" });
  browserbaseSdk.contextsDelete.mockResolvedValueOnce(undefined);
  browserbaseSdk.sessionsUpdate.mockResolvedValueOnce(undefined);
  vi.mocked(browserbase.launch).mockResolvedValueOnce({
    sessionId: "probe-session",
    close,
  } as unknown as Awaited<ReturnType<typeof browserbase.launch>>);

  await expect(fixture.t.action(internal.browserbasePortal.probeControlledRegistrationLaunch, {
    confirmation: "RUN_CONTROLLED_PERSONAL_INBOX_PROOF_DEVELOPMENT",
  })).resolves.toEqual({ status: "ready" });
  expect(browserbase.launch).toHaveBeenCalledWith(expect.objectContaining({
    apiKey: "test-browserbase-key",
    proxies: false,
    browserSettings: expect.objectContaining({
      allowedDomains: ["roomscout.dev"],
      context: { id: "probe-context", persist: true },
    }),
  }));
  expect(Stagehand.create).toHaveBeenCalledWith(expect.objectContaining({ browser: expect.objectContaining({ sessionId: "probe-session" }) }));
  expect(close).toHaveBeenCalledOnce();
  expect(browserbaseSdk.sessionsUpdate).toHaveBeenCalledWith("probe-session", { status: "REQUEST_RELEASE" });
  expect(browserbaseSdk.contextsDelete).toHaveBeenCalledWith("probe-context");
});

it("initializes v4 browser primitives with implicit model calls disabled", async () => {
  const browser = { close: vi.fn(), sessionId: "context-test" } as unknown as Awaited<ReturnType<typeof browserbase.launch>>;
  await initializePortalBrowser(browser, "test-browserbase-key");
  const options = vi.mocked(Stagehand.create).mock.calls.at(-1)![0];
  const model = options.model;
  if (!model || !("generate" in model)) throw new Error("Expected explicit client model guard");
  await expect(model.generate({ messages: [], tools: [] } as never)).rejects.toThrow("PORTAL_IMPLICIT_MODEL_CALL_DISABLED");
});

it("claims one exact Browserbase write, exposes its session only to the owner, and serializes writes", async () => {
  const t = convexTest(schema, modules);
  const fixture = await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await ctx.db.insert("users", {
      username: "owner",
      role: "musician",
      createdAt: now,
      lastSeenAt: now,
    });
    const otherOwnerId = await ctx.db.insert("users", {
      username: "other",
      role: "musician",
      createdAt: now,
      lastSeenAt: now,
    });
    const platformId = await ctx.db.insert("sourcePlatforms", {
      slug: "fixture-portal",
      name: "Fixture Portal",
      canonicalDomain: "portal.example",
      kind: "community",
      status: "active",
      firstSeenAt: now,
      lastObservedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    const sourceId = await ctx.db.insert("sources", {
      platformId,
      slug: "fixture-source",
      name: "Fixture Portal",
      baseUrl: "https://portal.example",
      side: "both",
      status: "active",
      health: "healthy",
      accessMode: "authenticated",
      automationReview: "approved",
      createdAt: now,
      updatedAt: now,
    });
    const policyId = await ctx.db.insert("sourceFlowPolicies", {
      platformId,
      sourceId,
      scopeKey: `source:${sourceId}`,
      flow: "contact",
      version: 1,
      status: "approved",
      decision: "allowed",
      maxAutomationLevel: "approved_execute",
      userConnectionRequired: true,
      humanPresenceRequired: false,
      accountCreationAllowed: false,
      externalApprovalRequired: true,
      robotsDecision: "allowed",
      termsDecision: "allowed",
      evidenceUrls: ["https://portal.example/terms"],
      createdAt: now,
      updatedAt: now,
    });
    const bindingId = await ctx.db.insert("sourceAdapterBindings", {
      platformId,
      sourceId,
      scopeKey: `source:${sourceId}`,
      flow: "contact",
      adapterKey: "roomscout-fixture-v1",
      adapterVersion: 1,
      status: "active",
      executor: "browserbase",
      config: {
        kind: "browserbase",
        workflowKey: "fixture.platform-message.v1",
        contextRequired: true,
      },
      configFingerprint: "fixture-browserbase-contact-v1",
      policyVersionId: policyId,
      createdAt: now,
      updatedAt: now,
    });
    const connectionId = await ctx.db.insert("portalConnections", {
      ownerId,
      sourceId,
      platformId,
      label: "Fixture account",
      allowedDomains: ["portal.example"],
      allowedPaths: ["/roomscout-fixture/messages"],
      adapterKey: "roomscout-fixture-v1",
      status: "active",
      policyDecision: "allowed",
      allowReadOnlyRecon: true,
      allowInboxPolling: true,
      pollIntervalMinutes: 60,
      failureCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    const otherConnectionId = await ctx.db.insert("portalConnections", {
      ownerId: otherOwnerId, sourceId, platformId, label: "Other fixture account",
      allowedDomains: ["portal.example"], allowedPaths: ["/roomscout-fixture/messages"],
      adapterKey: "roomscout-fixture-v1", status: "active", policyDecision: "allowed",
      allowReadOnlyRecon: true, allowInboxPolling: true, pollIntervalMinutes: 60,
      failureCount: 0, createdAt: now, updatedAt: now,
    });
    const createRequest = async (suffix: string, requestOwnerId = ownerId, requestConnectionId = connectionId) => {
      const payload = {
        kind: "platform_message" as const,
        recipients: ["Robin"],
        subject: "Room inquiry",
        body: `Is the room available? ${suffix}`,
      };
      const requestId = await ctx.db.insert("actionRequests", {
        ownerId: requestOwnerId,
        platformId,
        connectionId: requestConnectionId,
        adapterBindingId: bindingId,
        policyVersionId: policyId,
        automationMode: "exact_once",
        requestedActionType: "send_platform_dm",
        personalDataScopes: [],
        payload,
        contentVersion: 1,
        contentHash: `hash-${suffix}`,
        status: "approved",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("actionApprovals", {
        requestId,
        ownerId: requestOwnerId,
        contentVersion: 1,
        contentHash: `hash-${suffix}`,
        payloadSnapshot: payload,
        policyVersionId: policyId,
        decision: "approved",
        decidedAt: now,
      });
      return requestId;
    };
    return {
      ownerId,
      otherOwnerId,
      firstRequestId: await createRequest("one"),
      secondRequestId: await createRequest("two"),
      independentRequestId: await createRequest("independent", otherOwnerId, otherConnectionId),
    };
  });

  const first = await t.mutation(internal.externalActions.claimForExecutor, {
    ownerId: fixture.ownerId,
    requestId: fixture.firstRequestId,
    executor: "browserbase",
  });

  vi.mocked(browserbase.connect).mockClear();
  vi.mocked(browserbase.launch).mockClear();
  const preSessionRetry = await t.action(
    internal.browserbasePortal.executeApprovedWriteWorker,
    {
      ownerId: fixture.ownerId,
      requestId: fixture.firstRequestId,
    },
  );
  expect(preSessionRetry).toEqual({
    executionId: first.executionId,
    status: "in_progress",
    alreadyCompleted: false,
  });
  expect(browserbase.connect).not.toHaveBeenCalled();
  expect(browserbase.launch).not.toHaveBeenCalled();
  const preSessionExecution = await t.run((ctx) => ctx.db.get(first.executionId));
  expect(preSessionExecution).toMatchObject({ status: "claimed" });
  expect(preSessionExecution).not.toHaveProperty("providerActionId");

  await t.mutation(internal.externalActions.attachProviderExecution, {
    ownerId: fixture.ownerId,
    executionId: first.executionId,
    providerActionId: "provider-session-1",
  });
  const independent = await t.mutation(internal.externalActions.claimForExecutor, {
    ownerId: fixture.otherOwnerId,
    requestId: fixture.independentRequestId,
    executor: "browserbase",
  });
  await expect(t.mutation(internal.externalActions.attachProviderExecution, {
    ownerId: fixture.otherOwnerId,
    executionId: independent.executionId,
    providerActionId: "provider-session-2",
  })).resolves.toBeNull();
  expect(
    await t.query(internal.externalActions.getBrowserExecutionForOwner, {
      ownerId: fixture.ownerId,
      executionId: first.executionId,
    }),
  ).toMatchObject({ providerSessionId: "provider-session-1" });
  expect(
    await t.query(internal.externalActions.getBrowserExecutionForOwner, {
      ownerId: fixture.otherOwnerId,
      executionId: first.executionId,
    }),
  ).toBeNull();

  vi.mocked(browserbase.connect).mockClear();
  vi.mocked(browserbase.launch).mockClear();
  const retry = await t.action(internal.browserbasePortal.executeApprovedWriteWorker, {
    ownerId: fixture.ownerId,
    requestId: fixture.firstRequestId,
  });
  expect(retry).toEqual({
    executionId: first.executionId,
    status: "in_progress",
    alreadyCompleted: false,
  });
  expect(browserbase.connect).not.toHaveBeenCalled();
  expect(browserbase.launch).not.toHaveBeenCalled();

  await expect(
    t.mutation(internal.externalActions.claimForExecutor, {
      ownerId: fixture.ownerId,
      requestId: fixture.secondRequestId,
      executor: "browserbase",
    }),
  ).rejects.toThrow("BROWSER_SESSION_BUSY");
  expect(await t.run((ctx) => ctx.db.query("actionExecutions").withIndex("by_request", (q) =>
    q.eq("requestId", fixture.secondRequestId),
  ).first())).toBeNull();

  await t.mutation(internal.externalActions.confirmHumanExecution, {
    ownerId: fixture.ownerId,
    requestId: fixture.firstRequestId,
    executionId: first.executionId,
    submitted: false,
  });
  const state = await t.run(async (ctx) => ({
    request: await ctx.db.get(fixture.firstRequestId),
    execution: await ctx.db.get(first.executionId),
  }));
  expect(state.request?.status).toBe("cancelled");
  expect(state.execution?.status).toBe("failed");
});
