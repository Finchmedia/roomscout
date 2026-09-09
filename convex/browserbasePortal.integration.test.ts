/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { browserbase, Stagehand } from "@browserbasehq/stagehand";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { internal } from "./_generated/api";
import { initializePortalBrowser, registrationLaunchDiagnostic, registrationStartFailureCode } from "./browserbasePortal";
import schema from "./schema";

vi.mock("./integrations/env", () => ({
  envValue: vi.fn((name: string) => name === "BROWSERBASE_API_KEY" ? "test-browserbase-key" : process.env[name]),
}));

const browserbaseSdk = vi.hoisted(() => ({
  contextsCreate: vi.fn(),
  contextsDelete: vi.fn(),
  sessionsUpdate: vi.fn(),
}));

vi.mock("@browserbasehq/sdk", () => ({
  Browserbase: vi.fn(function Browserbase() {
    return {
      contexts: { create: browserbaseSdk.contextsCreate, delete: browserbaseSdk.contextsDelete },
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
  vi.stubEnv("CONVEX_CLOUD_URL", "https://perceptive-antelope-445.eu-west-1.convex.cloud");
  vi.stubEnv("CONVEX_SITE_URL", "https://perceptive-antelope-445.eu-west-1.convex.site");
});
afterEach(() => vi.unstubAllEnvs());

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
    return { connectionId };
  });
  return { t, ...ids };
}

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
    const createRequest = async (suffix: string) => {
      const payload = {
        kind: "platform_message" as const,
        recipients: ["Robin"],
        subject: "Room inquiry",
        body: `Is the room available? ${suffix}`,
      };
      const requestId = await ctx.db.insert("actionRequests", {
        ownerId,
        platformId,
        connectionId,
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
        ownerId,
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
