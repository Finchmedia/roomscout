/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

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

  const second = await t.mutation(internal.externalActions.claimForExecutor, {
    ownerId: fixture.ownerId,
    requestId: fixture.secondRequestId,
    executor: "browserbase",
  });
  await expect(
    t.mutation(internal.externalActions.attachProviderExecution, {
      ownerId: fixture.ownerId,
      executionId: second.executionId,
      providerActionId: "provider-session-2",
    }),
  ).rejects.toThrow();

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
