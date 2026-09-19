/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { actionPayloadHash } from "./integrations/contentHash";
import { messageSafetyContext } from "./lib/messageSafety";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

const modules = import.meta.glob("./**/*.ts");
afterEach(() => vi.unstubAllEnvs());

async function seedSemanticClearance(ctx: MutationCtx, requestId: Id<"actionRequests">) {
  const request = (await ctx.db.get(requestId))!;
  const input = (await messageSafetyContext(ctx, request))!;
  await ctx.db.insert("messageSafetyAssessments", { requestId, ownerId: request.ownerId, snapshotHash: input.snapshotHash, contentHash: request.contentHash, contentVersion: request.contentVersion,
    assessment: { classification: "non_binding", explanation: "Fixture assessment", personalDataScopes: [], proposedMonthlyPriceEur: null, unsupportedClaims: [] },
    model: "model-double", version: "final-message-v1", createdAt: Date.now() });
}

async function seedStandingClaimFixture(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await ctx.db.insert("users", { username: "owner", firstName: "Mina", actKind: "band", actName: "Night Owls", providerIdentityConfirmedAt: now, role: "musician", createdAt: now, lastSeenAt: now });
    const needId = await ctx.db.insert("savedNeeds", { ownerId, title: "Room", city: "Hamburg", districts: [], arrangement: ["shared"], schedule: [], requirements: [], status: "active", createdAt: now, updatedAt: now });
    const platformId = await ctx.db.insert("sourcePlatforms", { slug: "bandnet", name: "Bandnet", canonicalDomain: "roomscout.dev", kind: "community", status: "active", firstSeenAt: now, lastObservedAt: now, createdAt: now, updatedAt: now });
    const policyId = await ctx.db.insert("sourceFlowPolicies", { platformId, scopeKey: "bandnet:contact", flow: "contact", version: 1, status: "approved", decision: "allowed", maxAutomationLevel: "approved_execute", userConnectionRequired: false, humanPresenceRequired: false, accountCreationAllowed: false, externalApprovalRequired: true, robotsDecision: "allowed", termsDecision: "allowed", evidenceUrls: ["https://roomscout.dev/nutzungsbedingungen"], createdAt: now, updatedAt: now });
    const bindingId = await ctx.db.insert("sourceAdapterBindings", { platformId, scopeKey: "bandnet:contact", flow: "contact", adapterKey: "bandnet_contact_v1", adapterVersion: 1, status: "active", executor: "firecrawl", config: { kind: "firecrawl", extractionProfileKey: "bandnet_contact_v1", monitorDriven: false }, configFingerprint: "binding-hash", policyVersionId: policyId, createdAt: now, updatedAt: now });
    const payload = { kind: "contact_form" as const, targetUrl: "https://roomscout.dev/kontakt/42", fields: [{ name: "message", value: "Is the room still available?", sensitivity: "normal" as const }] };
    const createRequest = async () => {
      const contentHash = await actionPayloadHash(payload);
      const requestId = await ctx.db.insert("actionRequests", { ownerId, savedNeedId: needId, platformId, adapterBindingId: bindingId, policyVersionId: policyId, automationMode: "autopilot" as const, requestedActionType: "submit_webform" as const, personalDataScopes: [], payload, contentVersion: 1, contentHash, status: "approved" as const, expiresAt: now + 86_400_000, createdAt: now, updatedAt: now });
      await ctx.db.insert("actionApprovals", { requestId, ownerId, contentVersion: 1, contentHash, payloadSnapshot: payload, policyVersionId: policyId, decision: "authorized_by_autonomy", autonomyVersion: 0, autonomyHash: "defaults", decidedAt: now });
      await seedSemanticClearance(ctx, requestId);
      return requestId;
    };
    return { ownerId, firstRequestId: await createRequest() };
  });
}

it("binds an exact approval to the owner, version, hash, and payload", async () => {
  const t = convexTest(schema, modules);
  const { userId, otherUserId, needId } = await t.run(async (ctx) => {
    const now = Date.now();
    const userId = await ctx.db.insert("users", { username: "owner", role: "musician", createdAt: now, lastSeenAt: now });
    const otherUserId = await ctx.db.insert("users", { username: "other", role: "musician", createdAt: now, lastSeenAt: now });
    const needId = await ctx.db.insert("savedNeeds", { ownerId: userId, title: "Room", city: "Hamburg", districts: [], arrangement: ["shared"], schedule: [], requirements: [], status: "active", createdAt: now, updatedAt: now });
    return { userId, otherUserId, needId };
  });
  const owner = t.withIdentity({ subject: userId });
  const other = t.withIdentity({ subject: otherUserId });
  const payload = { kind: "email_message" as const, recipientName: "Robin", recipientEmail: "robin@example.com", subject: "Room inquiry", body: "Is the room still available?" };
  const requestId = await owner.mutation(api.externalActions.createDraft, {
    savedNeedId: needId,
    automationMode: "exact_once",
    requestedActionType: "send_email",
    personalDataScopes: [],
    payload,
  });
  await owner.mutation(api.externalActions.submit, { requestId });
  const [request] = await owner.query(api.externalActions.listMine, { limit: 5 });
  await expect(owner.mutation(api.externalActions.decide, {
    requestId,
    decision: "approved",
    expectedContentVersion: request.contentVersion,
    expectedContentHash: request.contentHash,
    expectedPayload: { ...payload, body: "Changed after review" },
  })).rejects.toThrow();
  await owner.mutation(api.externalActions.decide, {
    requestId,
    decision: "approved",
    expectedContentVersion: request.contentVersion,
    expectedContentHash: request.contentHash,
    expectedPayload: payload,
  });
  expect((await owner.query(api.externalActions.listMine, { limit: 5 }))[0]?.status).toBe("approved");
  expect(await other.query(api.externalActions.listMine, { limit: 5 })).toEqual([]);
});

it("rejects a partially specified email reply route", async () => {
  const t = convexTest(schema, modules);
  const { userId, needId } = await t.run(async (ctx) => {
    const now = Date.now();
    const userId = await ctx.db.insert("users", { username: "reply-owner", role: "musician", createdAt: now, lastSeenAt: now });
    const needId = await ctx.db.insert("savedNeeds", { ownerId: userId, title: "Room", city: "Berlin", districts: [], arrangement: ["shared"], schedule: [], requirements: [], status: "active", createdAt: now, updatedAt: now });
    return { userId, needId };
  });
  await expect(t.withIdentity({ subject: userId }).mutation(api.externalActions.createDraft, {
    savedNeedId: needId, automationMode: "exact_once", requestedActionType: "send_email", personalDataScopes: [],
    payload: { kind: "email_message", recipientName: "Provider", recipientEmail: "provider@example.com", subject: "Re: room", body: "Is Tuesday still possible?", parentMessageId: "provider-message" },
  })).rejects.toThrow("INVALID_EMAIL_REPLY_ROUTE");
});

it("will not turn exact approval into an arbitrary Firecrawl form destination", async () => {
  const t = convexTest(schema, modules);
  const { userId, needId, platformId, policyId } = await t.run(async (ctx) => {
    const now = Date.now();
    const userId = await ctx.db.insert("users", { username: "owner", role: "musician", createdAt: now, lastSeenAt: now });
    const needId = await ctx.db.insert("savedNeeds", { ownerId: userId, title: "Room", city: "Hamburg", districts: [], arrangement: ["shared"], schedule: [], requirements: [], status: "active", createdAt: now, updatedAt: now });
    const platformId = await ctx.db.insert("sourcePlatforms", { slug: "bandnet", name: "Bandnet", canonicalDomain: "bandnet.hamburg", kind: "community", status: "active", firstSeenAt: now, lastObservedAt: now, createdAt: now, updatedAt: now });
    const policyId = await ctx.db.insert("sourceFlowPolicies", { platformId, scopeKey: "bandnet:contact", flow: "contact", version: 1, status: "approved", decision: "allowed", maxAutomationLevel: "prepare_only", userConnectionRequired: false, humanPresenceRequired: true, accountCreationAllowed: false, externalApprovalRequired: true, robotsDecision: "allowed", termsDecision: "allowed", evidenceUrls: ["https://bandnet.hamburg/nutzungsbedingungen"], createdAt: now, updatedAt: now });
    return { userId, needId, platformId, policyId };
  });
  const owner = t.withIdentity({ subject: userId });
  await expect(owner.mutation(api.externalActions.createDraft, {
    savedNeedId: needId,
    platformId,
    policyVersionId: policyId,
    automationMode: "exact_once",
    requestedActionType: "submit_webform",
    personalDataScopes: ["reply_email"],
    payload: { kind: "contact_form", targetUrl: "https://evil.example/collect", fields: [{ name: "email", value: "scout@example.com", sensitivity: "personal" }] },
  })).rejects.toThrow();
});

it("blocks an exact human approval in demo mode, while the reviewed non-demo workflow remains available", async () => {
  const t = convexTest(schema, modules);
  const fixture = await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await ctx.db.insert("users", { username: "owner", firstName: "Mina", actKind: "band", actName: "Night Owls", providerIdentityConfirmedAt: now, role: "musician", createdAt: now, lastSeenAt: now });
    const platformId = await ctx.db.insert("sourcePlatforms", { slug: "bandnet", name: "Bandnet", canonicalDomain: "bandnet.hamburg", kind: "community", status: "active", firstSeenAt: now, lastObservedAt: now, createdAt: now, updatedAt: now });
    const policyId = await ctx.db.insert("sourceFlowPolicies", { platformId, scopeKey: "bandnet:contact", flow: "contact", version: 1, status: "approved", decision: "allowed", maxAutomationLevel: "approved_execute", userConnectionRequired: false, humanPresenceRequired: false, accountCreationAllowed: false, externalApprovalRequired: true, robotsDecision: "allowed", termsDecision: "allowed", evidenceUrls: ["https://bandnet.hamburg/nutzungsbedingungen"], createdAt: now, updatedAt: now });
    const bindingId = await ctx.db.insert("sourceAdapterBindings", { platformId, scopeKey: "bandnet:contact", flow: "contact", adapterKey: "bandnet_contact_v1", adapterVersion: 1, status: "active", executor: "firecrawl", config: { kind: "firecrawl", extractionProfileKey: "bandnet_contact_v1", monitorDriven: false }, configFingerprint: "binding-hash", policyVersionId: policyId, createdAt: now, updatedAt: now });
    const payload = { kind: "contact_form" as const, targetUrl: "https://bandnet.hamburg/kontakt/42", fields: [{ name: "message", value: "Hello", sensitivity: "normal" as const }] };
    const requestId = await ctx.db.insert("actionRequests", { ownerId, platformId, adapterBindingId: bindingId, policyVersionId: policyId, automationMode: "exact_once", requestedActionType: "submit_webform", personalDataScopes: [], payload, contentVersion: 1, contentHash: "content-hash", status: "approved", createdAt: now, updatedAt: now });
    await ctx.db.insert("actionApprovals", { requestId, ownerId, contentVersion: 1, contentHash: "content-hash", payloadSnapshot: payload, policyVersionId: policyId, decision: "approved", decidedAt: now });
    return { ownerId, platformId, policyId, bindingId, requestId, payload };
  });

  await expect(t.mutation(internal.externalActions.claimForExecutor, {
    ownerId: fixture.ownerId, requestId: fixture.requestId, executor: "firecrawl",
  })).rejects.toThrow("CONTROLLED_PORTAL_ONLY");
  expect(await t.run((ctx) => ctx.db.query("actionExecutions").collect())).toEqual([]);

  vi.stubEnv("SCOUT_CONTROLLED_PORTAL_ONLY", "false");
  const first = await t.mutation(internal.externalActions.claimForExecutor, { ownerId: fixture.ownerId, requestId: fixture.requestId, executor: "firecrawl" });
  const second = await t.mutation(internal.externalActions.claimForExecutor, { ownerId: fixture.ownerId, requestId: fixture.requestId, executor: "firecrawl" });
  expect(first.alreadyClaimed).toBe(false);
  expect(second.alreadyClaimed).toBe(true);
  expect(second.executionId).toBe(first.executionId);

  const secondRequestId = await t.run(async (ctx) => {
    const now = Date.now();
    const requestId = await ctx.db.insert("actionRequests", { ownerId: fixture.ownerId, platformId: fixture.platformId, adapterBindingId: fixture.bindingId, policyVersionId: fixture.policyId, automationMode: "exact_once", requestedActionType: "submit_webform", personalDataScopes: [], payload: fixture.payload, contentVersion: 1, contentHash: "second-hash", status: "approved", createdAt: now, updatedAt: now });
    await ctx.db.insert("actionApprovals", { requestId, ownerId: fixture.ownerId, contentVersion: 1, contentHash: "second-hash", payloadSnapshot: fixture.payload, policyVersionId: fixture.policyId, decision: "approved", decidedAt: now });
    await ctx.db.patch(fixture.policyId, { maxAutomationLevel: "prepare_only", updatedAt: now });
    return requestId;
  });
  await expect(t.mutation(internal.externalActions.claimForExecutor, { ownerId: fixture.ownerId, requestId: secondRequestId, executor: "firecrawl" })).rejects.toThrow();
});

it("does not execute from a Scout authorization after the user switches contact off", async () => {
  const t = convexTest(schema, modules);
  const fixture = await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await ctx.db.insert("users", { username: "owner", firstName: "Mina", actKind: "band", actName: "Night Owls", providerIdentityConfirmedAt: now, role: "musician", createdAt: now, lastSeenAt: now });
    const needId = await ctx.db.insert("savedNeeds", { ownerId, title: "Room", city: "Hamburg", districts: [], arrangement: ["shared"], schedule: [], requirements: [], status: "active", createdAt: now, updatedAt: now });
    const platformId = await ctx.db.insert("sourcePlatforms", { slug: "bandnet", name: "Bandnet", canonicalDomain: "roomscout.dev", kind: "community", status: "active", firstSeenAt: now, lastObservedAt: now, createdAt: now, updatedAt: now });
    const policyId = await ctx.db.insert("sourceFlowPolicies", { platformId, scopeKey: "bandnet:contact", flow: "contact", version: 1, status: "approved", decision: "allowed", maxAutomationLevel: "approved_execute", userConnectionRequired: false, humanPresenceRequired: false, accountCreationAllowed: false, externalApprovalRequired: true, robotsDecision: "allowed", termsDecision: "allowed", evidenceUrls: ["https://bandnet.hamburg/nutzungsbedingungen"], createdAt: now, updatedAt: now });
    const bindingId = await ctx.db.insert("sourceAdapterBindings", { platformId, scopeKey: "bandnet:contact", flow: "contact", adapterKey: "bandnet_contact_v1", adapterVersion: 1, status: "active", executor: "firecrawl", config: { kind: "firecrawl", extractionProfileKey: "bandnet_contact_v1", monitorDriven: false }, configFingerprint: "binding-hash", policyVersionId: policyId, createdAt: now, updatedAt: now });
    const payload = { kind: "contact_form" as const, targetUrl: "https://roomscout.dev/kontakt/42", fields: [{ name: "message", value: "Hello", sensitivity: "normal" as const }] };
    const contentHash = await actionPayloadHash(payload);
    const requestId = await ctx.db.insert("actionRequests", { ownerId, savedNeedId: needId, platformId, adapterBindingId: bindingId, policyVersionId: policyId, automationMode: "autopilot", requestedActionType: "submit_webform", personalDataScopes: [], payload, contentVersion: 1, contentHash, status: "approved", createdAt: now, updatedAt: now });
    await ctx.db.insert("actionApprovals", { requestId, ownerId, contentVersion: 1, contentHash, payloadSnapshot: payload, policyVersionId: policyId, decision: "authorized_by_autonomy", autonomyVersion: 0, autonomyHash: "defaults", decidedAt: now });
    await seedSemanticClearance(ctx, requestId);
    await ctx.db.insert("scoutAutonomy", { ownerId, mode: "autopilot", contact: false, viewings: true, publishAd: false, shareProfile: true, sharePrivate: false, version: 1, contentHash: "rules-v1", createdAt: now, updatedAt: now });
    return { ownerId, requestId };
  });
  const gate = await t.mutation(internal.externalActions.prepareClaim, { ownerId: fixture.ownerId, requestId: fixture.requestId, executor: "firecrawl" });
  expect(gate).toEqual({ outcome: "stop", reason: "action_not_allowed", detail: "submit_webform" });
  expect(await t.run((ctx) => ctx.db.get(fixture.requestId))).toMatchObject({ status: "blocked", error: "action_not_allowed", gate: { outcome: "stop", reason: "action_not_allowed", autonomyVersion: 1, autonomyHash: "rules-v1" } });
  await expect(t.mutation(internal.externalActions.claimForExecutor, { ownerId: fixture.ownerId, requestId: fixture.requestId, executor: "firecrawl" })).rejects.toThrow("ACTION_NOT_EXECUTABLE");
});

it("resumes one idempotent Scout request through the Freigabeprüfung", async () => {
  const t = convexTest(schema, modules);
  const fixture = await seedStandingClaimFixture(t);
  const claim = async () => {
    const gate = await t.mutation(internal.externalActions.prepareClaim, { ownerId: fixture.ownerId, requestId: fixture.firstRequestId, executor: "firecrawl" });
    expect(gate).toEqual({ outcome: "proceed" });
    return t.mutation(internal.externalActions.claimForExecutor, { ownerId: fixture.ownerId, requestId: fixture.firstRequestId, executor: "firecrawl" });
  };

  const first = await claim();
  const resumed = await claim();

  expect(first.alreadyClaimed).toBe(false);
  expect(resumed).toMatchObject({
    executionId: first.executionId,
    executionStatus: "claimed",
    alreadyClaimed: true,
  });
  expect(await t.run((ctx) => ctx.db.query("actionApprovals").collect())).toHaveLength(1);
  expect(await t.run((ctx) => ctx.db.get(fixture.firstRequestId))).toMatchObject({ status: "executing", gate: { outcome: "proceed" } });
});

it("refuses the transactional claim for a Scout request that never passed the Freigabeprüfung", async () => {
  const t = convexTest(schema, modules);
  const fixture = await seedStandingClaimFixture(t);
  await expect(t.mutation(internal.externalActions.claimForExecutor, {
    ownerId: fixture.ownerId,
    requestId: fixture.firstRequestId,
    executor: "firecrawl",
  })).rejects.toThrow("GATE_NOT_PASSED");
  expect(await t.run((ctx) => ctx.db.query("actionExecutions").collect())).toEqual([]);
});

it("refuses the final outbound claim when the canonical musician profile is incomplete", async () => {
  const t = convexTest(schema, modules);
  const fixture = await seedStandingClaimFixture(t);
  await t.run((ctx) => ctx.db.patch(fixture.ownerId, {
    firstName: undefined,
    actKind: undefined,
    actName: undefined,
    providerIdentityConfirmedAt: undefined,
  }));

  await expect(t.mutation(internal.externalActions.claimForExecutor, {
    ownerId: fixture.ownerId,
    requestId: fixture.firstRequestId,
    executor: "firecrawl",
  })).rejects.toThrow("MUSICIAN_PROFILE_REQUIRED");
  expect(await t.run((ctx) => ctx.db.query("actionExecutions").collect())).toEqual([]);
});

it("rejects an exact approval whose action request expired before claim", async () => {
  const t = convexTest(schema, modules);
  const fixture = await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await ctx.db.insert("users", { username: "owner", firstName: "Mina", actKind: "band", actName: "Night Owls", providerIdentityConfirmedAt: now, role: "musician", createdAt: now, lastSeenAt: now });
    const platformId = await ctx.db.insert("sourcePlatforms", { slug: "bandnet", name: "Bandnet", canonicalDomain: "bandnet.hamburg", kind: "community", status: "active", firstSeenAt: now, lastObservedAt: now, createdAt: now, updatedAt: now });
    const policyId = await ctx.db.insert("sourceFlowPolicies", { platformId, scopeKey: "bandnet:contact", flow: "contact", version: 1, status: "approved", decision: "allowed", maxAutomationLevel: "approved_execute", userConnectionRequired: false, humanPresenceRequired: false, accountCreationAllowed: false, externalApprovalRequired: true, robotsDecision: "allowed", termsDecision: "allowed", evidenceUrls: ["https://bandnet.hamburg/nutzungsbedingungen"], createdAt: now, updatedAt: now });
    const bindingId = await ctx.db.insert("sourceAdapterBindings", { platformId, scopeKey: "bandnet:contact", flow: "contact", adapterKey: "bandnet_contact_v1", adapterVersion: 1, status: "active", executor: "firecrawl", config: { kind: "firecrawl", extractionProfileKey: "bandnet_contact_v1", monitorDriven: false }, configFingerprint: "binding-hash", policyVersionId: policyId, createdAt: now, updatedAt: now });
    const payload = { kind: "contact_form" as const, targetUrl: "https://bandnet.hamburg/kontakt/42", fields: [{ name: "message", value: "Hello", sensitivity: "normal" as const }] };
    const requestId = await ctx.db.insert("actionRequests", { ownerId, platformId, adapterBindingId: bindingId, policyVersionId: policyId, automationMode: "exact_once", requestedActionType: "submit_webform", personalDataScopes: [], payload, contentVersion: 1, contentHash: "content-hash", status: "approved", expiresAt: now - 1, createdAt: now, updatedAt: now });
    await ctx.db.insert("actionApprovals", { requestId, ownerId, contentVersion: 1, contentHash: "content-hash", payloadSnapshot: payload, policyVersionId: policyId, decision: "approved", decidedAt: now });
    return { ownerId, requestId };
  });
  await expect(t.mutation(internal.externalActions.claimForExecutor, { ownerId: fixture.ownerId, requestId: fixture.requestId, executor: "firecrawl" })).rejects.toThrow("ACTION_EXPIRED");
});

it("reaps abandoned claims but treats stale running provider calls as unknown", async () => {
  const t = convexTest(schema, modules);
  const fixture = await t.run(async (ctx) => {
    const old = Date.now() - 60 * 60 * 1_000;
    const ownerId = await ctx.db.insert("users", { username: "owner", role: "musician", createdAt: old, lastSeenAt: old });
    const payload = { kind: "email_message" as const, recipientName: "Test", recipientEmail: "test@example.com", subject: "Room", body: "Available?" };
    const firstRequestId = await ctx.db.insert("actionRequests", { ownerId, automationMode: "exact_once", requestedActionType: "send_email", personalDataScopes: [], payload, contentVersion: 1, contentHash: "one", status: "executing", createdAt: old, updatedAt: old });
    const secondRequestId = await ctx.db.insert("actionRequests", { ownerId, automationMode: "exact_once", requestedActionType: "send_email", personalDataScopes: [], payload, contentVersion: 1, contentHash: "two", status: "executing", createdAt: old, updatedAt: old });
    const firstApprovalId = await ctx.db.insert("actionApprovals", { requestId: firstRequestId, ownerId, contentVersion: 1, contentHash: "one", payloadSnapshot: payload, decision: "approved", decidedAt: old });
    const secondApprovalId = await ctx.db.insert("actionApprovals", { requestId: secondRequestId, ownerId, contentVersion: 1, contentHash: "two", payloadSnapshot: payload, decision: "approved", decidedAt: old });
    const claimedId = await ctx.db.insert("actionExecutions", { requestId: firstRequestId, ownerId, approvalId: firstApprovalId, status: "claimed", idempotencyKey: "one", startedAt: old, createdAt: old, updatedAt: old });
    const runningId = await ctx.db.insert("actionExecutions", { requestId: secondRequestId, ownerId, approvalId: secondApprovalId, status: "running", idempotencyKey: "two", providerActionId: "provider-job", startedAt: old, createdAt: old, updatedAt: old });
    return { claimedId, runningId, firstRequestId, secondRequestId };
  });
  expect(await t.mutation(internal.externalActions.reapStaleExecutions, { olderThanMs: 15 * 60 * 1_000, limit: 10 })).toEqual({ failedBeforeProvider: 1, unknownProviderOutcome: 1 });
  expect(await t.run(async (ctx) => ({
    claimed: (await ctx.db.get(fixture.claimedId))?.status,
    running: (await ctx.db.get(fixture.runningId))?.status,
    firstRequest: (await ctx.db.get(fixture.firstRequestId))?.status,
    secondRequest: (await ctx.db.get(fixture.secondRequestId))?.status,
  }))).toEqual({ claimed: "failed", running: "unknown", firstRequest: "failed", secondRequest: "executing" });
});

it("treats a claimed Firecrawl write lock as possibly dispatched and persists its scrape id before work", async () => {
  vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
  const t = convexTest(schema, modules);
  const f = await t.run(async (ctx) => {
    const old = Date.now() - 60 * 60 * 1_000;
    const ownerId = await ctx.db.insert("users", { username: "firecrawl-crash", role: "musician", createdAt: old, lastSeenAt: old });
    const sourceId = await ctx.db.insert("sources", { slug: "firecrawl-crash", name: "Controlled", baseUrl: "https://roomscout.dev", side: "both", accessMode: "authenticated", automationReview: "approved", status: "active", health: "healthy", createdAt: old, updatedAt: old });
    const connectionId = await ctx.db.insert("portalConnections", { ownerId, sourceId, label: "Controlled", allowedDomains: ["roomscout.dev"], allowedPaths: ["/inbox"], browserProvider: "firecrawl", status: "active", policyDecision: "allowed", allowReadOnlyRecon: true, allowInboxPolling: true, pollIntervalMinutes: 60, failureCount: 0, createdAt: old, updatedAt: old });
    const payload = { kind: "platform_message" as const, recipients: ["Provider"], body: "Exact write" };
    const requestId = await ctx.db.insert("actionRequests", { ownerId, connectionId, automationMode: "exact_once", requestedActionType: "send_platform_dm", personalDataScopes: [], payload, contentVersion: 1, contentHash: "firecrawl-crash", status: "executing", executionIdempotencyKey: "firecrawl-crash", createdAt: old, updatedAt: old });
    const approvalId = await ctx.db.insert("actionApprovals", { requestId, ownerId, contentVersion: 1, contentHash: "firecrawl-crash", payloadSnapshot: payload, decision: "approved", decidedAt: old });
    const executionId = await ctx.db.insert("actionExecutions", { requestId, ownerId, approvalId, connectionId, browserProvider: "firecrawl", status: "claimed", idempotencyKey: "firecrawl-crash", startedAt: old, createdAt: old, updatedAt: old });
    await ctx.db.patch(connectionId, { activeWriteExecutionId: executionId, activeWriteDeadlineAt: old + 1_000 });
    await ctx.db.insert("browserContexts", { connectionId, ownerId, providerContextId: "profile-firecrawl", browserProvider: "firecrawl", status: "creating", writeProofGeneration: 1, pendingWriteExecutionId: executionId, createdAt: old, updatedAt: old });
    await ctx.db.insert("devUserResets", { targetUserId: ownerId, targetUsername: "firecrawl-crash", status: "scheduled", stage: 0, deletedDocumentCount: 0, providerInboxResult: "not_present", providerContextCount: 0, authUsernameReleased: false, createdAt: old, updatedAt: old });
    return { ownerId, requestId, executionId };
  });

  expect(await t.mutation(internal.externalActions.cancelUnstartedForUserReset, { ownerId: f.ownerId, requestId: f.requestId })).toBe(false);
  expect(await t.mutation(internal.externalActions.reapStaleExecutions, { olderThanMs: 15 * 60_000, limit: 10 }))
    .toEqual({ failedBeforeProvider: 0, unknownProviderOutcome: 1 });
  expect(await t.run((ctx) => ctx.db.get(f.executionId))).toMatchObject({ status: "unknown", error: "EXECUTION_STALE_PROVIDER_OUTCOME_UNKNOWN" });

  const attached = await t.run(async (ctx) => {
    const execution = await ctx.db.get(f.executionId);
    await ctx.db.patch(f.executionId, { status: "claimed", providerActionId: undefined, updatedAt: Date.now() });
    return execution;
  });
  expect(attached).not.toBeNull();
  await t.mutation(internal.externalActions.attachProviderExecution, { ownerId: f.ownerId, executionId: f.executionId, providerActionId: "firecrawl-scrape-id" });
  expect(await t.query(internal.externalActions.getBrowserExecutionForOwner, { ownerId: f.ownerId, executionId: f.executionId }))
    .toMatchObject({ providerSessionId: "firecrawl-scrape-id", status: "running", browserProvider: "firecrawl" });
  vi.unstubAllEnvs();
});
