/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

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
    const mandateId = await ctx.db.insert("searchMandates", { ownerId, savedNeedId: needId, version: 1, mode: "outreach_autopilot", status: "active", platformIds: [platformId], allowedActionTypes: ["submit_webform"], allowedPersonalData: [], maxContactsPerDay: 5, maxBrowserMinutesPerDay: 30, expiresAt: now + 86_400_000, stopOnComplaint: true, stopWhenSuitableRoomConfirmed: true, contentHash: "mandate-hash", activatedAt: now, createdAt: now, updatedAt: now });
    const payload = { kind: "contact_form" as const, targetUrl: "https://bandnet.hamburg/kontakt/42", fields: [{ name: "message", value: "Hello", sensitivity: "normal" as const }] };
    const requestId = await ctx.db.insert("actionRequests", { ownerId, savedNeedId: needId, mandateId, platformId, adapterBindingId: bindingId, policyVersionId: policyId, automationMode: "standing_mandate", requestedActionType: "submit_webform", personalDataScopes: [], payload, contentVersion: 1, contentHash: "content-hash", status: "approved", createdAt: now, updatedAt: now });
    await ctx.db.insert("actionApprovals", { requestId, ownerId, contentVersion: 1, contentHash: "content-hash", payloadSnapshot: payload, policyVersionId: policyId, decision: "authorized_by_mandate", mandateId, mandateVersion: 1, mandateHash: "mandate-hash", decidedAt: now });
    await ctx.db.patch(mandateId, { status: "revoked", stoppedAt: now + 1, updatedAt: now + 1 });
    return { ownerId, requestId };
  });
  await expect(t.mutation(internal.externalActions.claimForExecutor, { ownerId: fixture.ownerId, requestId: fixture.requestId, executor: "firecrawl" })).rejects.toThrow();
});
