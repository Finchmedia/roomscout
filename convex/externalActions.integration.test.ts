/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function seedStandingClaimFixture(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await ctx.db.insert("users", { username: "owner", role: "musician", createdAt: now, lastSeenAt: now });
    const needId = await ctx.db.insert("savedNeeds", { ownerId, title: "Room", city: "Hamburg", districts: [], arrangement: ["shared"], schedule: [], requirements: [], status: "active", createdAt: now, updatedAt: now });
    const platformId = await ctx.db.insert("sourcePlatforms", { slug: "bandnet", name: "Bandnet", canonicalDomain: "bandnet.hamburg", kind: "community", status: "active", firstSeenAt: now, lastObservedAt: now, createdAt: now, updatedAt: now });
    const policyId = await ctx.db.insert("sourceFlowPolicies", { platformId, scopeKey: "bandnet:contact", flow: "contact", version: 1, status: "approved", decision: "allowed", maxAutomationLevel: "approved_execute", userConnectionRequired: false, humanPresenceRequired: false, accountCreationAllowed: false, externalApprovalRequired: true, robotsDecision: "allowed", termsDecision: "allowed", evidenceUrls: ["https://bandnet.hamburg/nutzungsbedingungen"], createdAt: now, updatedAt: now });
    const bindingId = await ctx.db.insert("sourceAdapterBindings", { platformId, scopeKey: "bandnet:contact", flow: "contact", adapterKey: "bandnet_contact_v1", adapterVersion: 1, status: "active", executor: "firecrawl", config: { kind: "firecrawl", extractionProfileKey: "bandnet_contact_v1", monitorDriven: false }, configFingerprint: "binding-hash", policyVersionId: policyId, createdAt: now, updatedAt: now });
    const mandateId = await ctx.db.insert("searchMandates", { ownerId, savedNeedId: needId, version: 1, mode: "outreach_autopilot", status: "active", platformIds: [platformId], allowedActionTypes: ["submit_webform"], allowedPersonalData: [], maxContactsPerDay: 1, maxBrowserMinutesPerDay: 30, expiresAt: now + 86_400_000, stopOnComplaint: true, stopWhenSuitableRoomConfirmed: true, commitmentBoundary: "non_binding_outreach_only", contentHash: "mandate-hash", activatedAt: now, createdAt: now, updatedAt: now });
    const payload = { kind: "contact_form" as const, targetUrl: "https://bandnet.hamburg/kontakt/42", fields: [{ name: "message", value: "Is the room still available?", sensitivity: "normal" as const }] };
    const createRequest = async (contentHash: string) => {
      const requestId = await ctx.db.insert("actionRequests", { ownerId, savedNeedId: needId, mandateId, platformId, adapterBindingId: bindingId, policyVersionId: policyId, automationMode: "standing_mandate" as const, requestedActionType: "submit_webform" as const, personalDataScopes: [], payload, contentVersion: 1, contentHash, status: "approved" as const, expiresAt: now + 86_400_000, createdAt: now, updatedAt: now });
      await ctx.db.insert("actionApprovals", { requestId, ownerId, contentVersion: 1, contentHash, payloadSnapshot: payload, policyVersionId: policyId, decision: "authorized_by_mandate", mandateId, mandateVersion: 1, mandateHash: "mandate-hash", decidedAt: now });
      return requestId;
    };
    return { ownerId, firstRequestId: await createRequest("first-hash") };
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

it("claims an approved provider write once and rechecks the current source policy", async () => {
  const t = convexTest(schema, modules);
  const fixture = await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await ctx.db.insert("users", { username: "owner", role: "musician", createdAt: now, lastSeenAt: now });
    const platformId = await ctx.db.insert("sourcePlatforms", { slug: "bandnet", name: "Bandnet", canonicalDomain: "bandnet.hamburg", kind: "community", status: "active", firstSeenAt: now, lastObservedAt: now, createdAt: now, updatedAt: now });
    const policyId = await ctx.db.insert("sourceFlowPolicies", { platformId, scopeKey: "bandnet:contact", flow: "contact", version: 1, status: "approved", decision: "allowed", maxAutomationLevel: "approved_execute", userConnectionRequired: false, humanPresenceRequired: false, accountCreationAllowed: false, externalApprovalRequired: true, robotsDecision: "allowed", termsDecision: "allowed", evidenceUrls: ["https://bandnet.hamburg/nutzungsbedingungen"], createdAt: now, updatedAt: now });
    const bindingId = await ctx.db.insert("sourceAdapterBindings", { platformId, scopeKey: "bandnet:contact", flow: "contact", adapterKey: "bandnet_contact_v1", adapterVersion: 1, status: "active", executor: "firecrawl", config: { kind: "firecrawl", extractionProfileKey: "bandnet_contact_v1", monitorDriven: false }, configFingerprint: "binding-hash", policyVersionId: policyId, createdAt: now, updatedAt: now });
    const payload = { kind: "contact_form" as const, targetUrl: "https://bandnet.hamburg/kontakt/42", fields: [{ name: "message", value: "Hello", sensitivity: "normal" as const }] };
    const requestId = await ctx.db.insert("actionRequests", { ownerId, platformId, adapterBindingId: bindingId, policyVersionId: policyId, automationMode: "exact_once", requestedActionType: "submit_webform", personalDataScopes: [], payload, contentVersion: 1, contentHash: "content-hash", status: "approved", createdAt: now, updatedAt: now });
    await ctx.db.insert("actionApprovals", { requestId, ownerId, contentVersion: 1, contentHash: "content-hash", payloadSnapshot: payload, policyVersionId: policyId, decision: "approved", decidedAt: now });
    return { ownerId, platformId, policyId, bindingId, requestId, payload };
  });

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

it("does not execute from a standing approval after its mandate is revoked", async () => {
  const t = convexTest(schema, modules);
  const fixture = await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await ctx.db.insert("users", { username: "owner", role: "musician", createdAt: now, lastSeenAt: now });
    const needId = await ctx.db.insert("savedNeeds", { ownerId, title: "Room", city: "Hamburg", districts: [], arrangement: ["shared"], schedule: [], requirements: [], status: "active", createdAt: now, updatedAt: now });
    const platformId = await ctx.db.insert("sourcePlatforms", { slug: "bandnet", name: "Bandnet", canonicalDomain: "bandnet.hamburg", kind: "community", status: "active", firstSeenAt: now, lastObservedAt: now, createdAt: now, updatedAt: now });
    const policyId = await ctx.db.insert("sourceFlowPolicies", { platformId, scopeKey: "bandnet:contact", flow: "contact", version: 1, status: "approved", decision: "allowed", maxAutomationLevel: "approved_execute", userConnectionRequired: false, humanPresenceRequired: false, accountCreationAllowed: false, externalApprovalRequired: true, robotsDecision: "allowed", termsDecision: "allowed", evidenceUrls: ["https://bandnet.hamburg/nutzungsbedingungen"], createdAt: now, updatedAt: now });
    const bindingId = await ctx.db.insert("sourceAdapterBindings", { platformId, scopeKey: "bandnet:contact", flow: "contact", adapterKey: "bandnet_contact_v1", adapterVersion: 1, status: "active", executor: "firecrawl", config: { kind: "firecrawl", extractionProfileKey: "bandnet_contact_v1", monitorDriven: false }, configFingerprint: "binding-hash", policyVersionId: policyId, createdAt: now, updatedAt: now });
    const mandateId = await ctx.db.insert("searchMandates", { ownerId, savedNeedId: needId, version: 1, mode: "outreach_autopilot", status: "active", platformIds: [platformId], allowedActionTypes: ["submit_webform"], allowedPersonalData: [], maxContactsPerDay: 5, maxBrowserMinutesPerDay: 30, expiresAt: now + 86_400_000, stopOnComplaint: true, stopWhenSuitableRoomConfirmed: true, commitmentBoundary: "non_binding_outreach_only", contentHash: "mandate-hash", activatedAt: now, createdAt: now, updatedAt: now });
    const payload = { kind: "contact_form" as const, targetUrl: "https://bandnet.hamburg/kontakt/42", fields: [{ name: "message", value: "Hello", sensitivity: "normal" as const }] };
    const requestId = await ctx.db.insert("actionRequests", { ownerId, savedNeedId: needId, mandateId, platformId, adapterBindingId: bindingId, policyVersionId: policyId, automationMode: "standing_mandate", requestedActionType: "submit_webform", personalDataScopes: [], payload, contentVersion: 1, contentHash: "content-hash", status: "approved", createdAt: now, updatedAt: now });
    await ctx.db.insert("actionApprovals", { requestId, ownerId, contentVersion: 1, contentHash: "content-hash", payloadSnapshot: payload, policyVersionId: policyId, decision: "authorized_by_mandate", mandateId, mandateVersion: 1, mandateHash: "mandate-hash", decidedAt: now });
    await ctx.db.patch(mandateId, { status: "revoked", stoppedAt: now + 1, updatedAt: now + 1 });
    return { ownerId, requestId };
  });
  await expect(t.mutation(internal.externalActions.claimForExecutor, { ownerId: fixture.ownerId, requestId: fixture.requestId, executor: "firecrawl" })).rejects.toThrow();
});

it("resumes one idempotent mandate request without charging its contact slot twice", async () => {
  const t = convexTest(schema, modules);
  const fixture = await seedStandingClaimFixture(t);

  const first = await t.mutation(internal.externalActions.claimForExecutor, {
    ownerId: fixture.ownerId,
    requestId: fixture.firstRequestId,
    executor: "firecrawl",
  });
  const resumed = await t.mutation(internal.externalActions.claimForExecutor, {
    ownerId: fixture.ownerId,
    requestId: fixture.firstRequestId,
    executor: "firecrawl",
  });

  expect(first.alreadyClaimed).toBe(false);
  expect(resumed).toMatchObject({
    executionId: first.executionId,
    executionStatus: "claimed",
    alreadyClaimed: true,
  });

  const secondRequestId = await t.run(async (ctx) => {
    const now = Date.now();
    const firstRequest = await ctx.db.get(fixture.firstRequestId);
    if (firstRequest === null || !firstRequest.savedNeedId || !firstRequest.mandateId || !firstRequest.platformId || !firstRequest.adapterBindingId || !firstRequest.policyVersionId) {
      throw new Error("Standing-action fixture is incomplete");
    }
    const contentHash = "second-hash";
    const requestId = await ctx.db.insert("actionRequests", {
      ownerId: fixture.ownerId,
      savedNeedId: firstRequest.savedNeedId,
      mandateId: firstRequest.mandateId,
      platformId: firstRequest.platformId,
      adapterBindingId: firstRequest.adapterBindingId,
      policyVersionId: firstRequest.policyVersionId,
      automationMode: "standing_mandate",
      requestedActionType: "submit_webform",
      personalDataScopes: [],
      payload: firstRequest.payload,
      contentVersion: 1,
      contentHash,
      status: "approved",
      expiresAt: now + 86_400_000,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("actionApprovals", {
      requestId,
      ownerId: fixture.ownerId,
      contentVersion: 1,
      contentHash,
      payloadSnapshot: firstRequest.payload,
      policyVersionId: firstRequest.policyVersionId,
      decision: "authorized_by_mandate",
      mandateId: firstRequest.mandateId,
      mandateVersion: 1,
      mandateHash: "mandate-hash",
      decidedAt: now,
    });
    return requestId;
  });

  await expect(
    t.mutation(internal.externalActions.claimForExecutor, {
      ownerId: fixture.ownerId,
      requestId: secondRequestId,
      executor: "firecrawl",
    }),
  ).rejects.toThrow("MANDATE_NO_LONGER_AUTHORIZES");
});

it("rejects an exact approval whose action request expired before claim", async () => {
  const t = convexTest(schema, modules);
  const fixture = await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await ctx.db.insert("users", { username: "owner", role: "musician", createdAt: now, lastSeenAt: now });
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
