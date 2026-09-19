import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireUserId } from "./integrations/authz";
import { actionPayloadHash } from "./integrations/contentHash";
import { answerOpenDecisions } from "./lib/decisions";
import { messageSafetyContext } from "./lib/messageSafety";
import { acceptanceMessage, assertAcceptanceCurrent, currentAcceptableOffer } from "./lib/offerAcceptance";
import { portalDestinationHash, resolveControlledPortal } from "./lib/providerPortal";
import { providerAssessmentValidator } from "./lib/providerAssessment";
import { resolvePortalBrowserProvider, storedPortalBrowserProvider } from "./integrations/portalBrowserEngine";
import { resolveProviderIdentity } from "./lib/musicianIdentity";
import { enqueueApprovedPortalWrite } from "./portalWriteQueue";

export const prepare = mutation({
  args: { offerId: v.id("offerRevisions"), expectedOfferHash: v.string() }, returns: v.id("actionRequests"),
  handler: async (ctx, args): Promise<Id<"actionRequests">> => {
    const ownerId = await requireUserId(ctx);
    const { offer, conversation, need, signal } = await currentAcceptableOffer(ctx, ownerId, args.offerId);
    const owner = await ctx.db.get(ownerId);
    const identity = owner ? resolveProviderIdentity(owner) : { complete: false as const };
    if (!identity.complete) throw new ConvexError({ code: "MUSICIAN_PROFILE_REQUIRED" });
    if (offer.contentHash !== args.expectedOfferHash) throw new ConvexError({ code: "OFFER_CHANGED" });
    const now = Date.now();
    const target = await resolveControlledPortal(ctx, conversation, signal, now);
    if (!target?.thread) throw new ConvexError({ code: "CONTROLLED_PORTAL_THREAD_REQUIRED" });
    const payload: Doc<"actionRequests">["payload"] = {
      kind: "platform_message", threadId: target.thread._id, recipients: target.thread.participants,
      senderLabel: identity.providerDisplayName, ...acceptanceMessage(offer, signal.title),
    };
    const [payloadHash, destinationHash] = await Promise.all([
      actionPayloadHash(payload),
      portalDestinationHash(target),
    ]);
    // The musician opened the offer review: the "Angebot prüfen" Entscheidung is answered.
    await answerOpenDecisions(ctx, ownerId, (row) => row.kind === "offer_ready" && row.refs.offerId === offer._id, { choice: "review" });
    // A dictated reply may share the offer with the acceptance; only an acceptance row is "existing" here.
    const offerRequests = await ctx.db.query("actionRequests").withIndex("by_provider_offer", (q) => q.eq("providerOfferId", offer._id)).order("desc").take(10);
    const existing = offerRequests.find((row) => row.providerActionKind === "acceptance") ?? null;
    if (existing) {
      if (existing.ownerId !== ownerId) throw new ConvexError({ code: "OFFER_ACTION_CONFLICT" });
      if (["approved", "queued", "executing", "executed"].includes(existing.status)) return existing._id;
      let refreshable = ["rejected", "cancelled", "expired"].includes(existing.status);
      if (existing.status === "awaiting_approval") {
        if ((existing.expiresAt ?? 0) <= now) {
          refreshable = true;
        } else {
          try {
            await assertAcceptanceCurrent(ctx, existing);
            return existing._id;
          } catch {
            refreshable = true;
          }
        }
      }
      if (existing.status === "failed") refreshable = true;
      if (refreshable) {
        const execution = await ctx.db.query("actionExecutions").withIndex("by_request", (q) => q.eq("requestId", existing._id)).order("desc").first();
        // A failed execution never submitted: the write path reports "unknown" whenever a submission may have
        // happened, and the provider session id is attached at session open, before anything is sent.
        refreshable = !execution || execution.status === "failed";
      }
      if (!refreshable) return existing._id;
      const contentVersion = existing.contentVersion + 1;
      await ctx.db.patch(existing._id, {
        providerOfferHash: offer.contentHash, matchingNeedRevision: offer.needRevision,
        matchingSignalId: signal._id, matchingSignalRevision: offer.signalRevision,
        opportunityId: conversation.opportunityId, platformId: target.platform._id,
        connectionId: target.connection._id, adapterBindingId: target.binding._id,
        policyVersionId: target.policy._id, personalDataScopes: identity.dataFields,
        payload, contentVersion, contentHash: payloadHash,
        reviewContextHash: undefined, reviewDestinationHash: destinationHash,
        status: "awaiting_approval", executionIdempotencyKey: undefined,
        expiresAt: now + 30 * 60_000, error: undefined, updatedAt: now,
      });
      const refreshed = await ctx.db.get(existing._id);
      const context = refreshed ? await messageSafetyContext(ctx, refreshed) : null;
      if (!context) throw new ConvexError({ code: "OFFER_CHANGED" });
      await ctx.db.patch(existing._id, { reviewContextHash: context.snapshotHash });
      await ctx.db.patch(conversation._id, { acceptanceRequestId: existing._id });
      await ctx.db.insert("auditEvents", { eventKey: `acceptance:${existing._id}:prepared:v${contentVersion}`, actorType: "user", actorUserId: ownerId,
        entityKey: `action:${existing._id}`, eventType: "offer.acceptance_prepared", actionRequestId: existing._id, afterHash: offer.contentHash, occurredAt: now });
      return existing._id;
    }
    const requestId = await ctx.db.insert("actionRequests", {
      ownerId, savedNeedId: need._id, providerConversationId: conversation._id, providerOfferId: offer._id,
      providerActionKind: "acceptance", providerOfferHash: offer.contentHash,
      matchingNeedRevision: offer.needRevision, matchingSignalId: signal._id, matchingSignalRevision: offer.signalRevision,
      opportunityId: conversation.opportunityId, platformId: target.platform._id, connectionId: target.connection._id,
      adapterBindingId: target.binding._id, policyVersionId: target.policy._id,
      automationMode: "exact_once", requestedActionType: "send_platform_dm", personalDataScopes: identity.dataFields,
      payload, contentVersion: 1, contentHash: payloadHash, reviewDestinationHash: destinationHash, status: "awaiting_approval",
      expiresAt: now + 30 * 60_000, createdAt: now, updatedAt: now,
    });
    const context = await messageSafetyContext(ctx, (await ctx.db.get(requestId))!);
    if (!context) throw new ConvexError({ code: "OFFER_CHANGED" });
    await ctx.db.patch(requestId, { reviewContextHash: context.snapshotHash });
    await ctx.db.patch(conversation._id, { acceptanceRequestId: requestId });
    await ctx.db.insert("auditEvents", { eventKey: `acceptance:${requestId}:prepared`, actorType: "user", actorUserId: ownerId,
      entityKey: `action:${requestId}`, eventType: "offer.acceptance_prepared", actionRequestId: requestId, afterHash: offer.contentHash, occurredAt: now });
    return requestId;
  },
});

export const getMine = query({
  args: { requestId: v.id("actionRequests") },
  returns: v.union(v.object({
    requestId: v.id("actionRequests"), offerId: v.id("offerRevisions"), offerHash: v.string(), offerRevision: v.number(),
    contentVersion: v.number(), contentHash: v.string(), reviewContextHash: v.string(), status: v.string(), current: v.boolean(),
    expiresAt: v.number(), destination: v.string(), actingAs: v.string(), subject: v.string(), body: v.string(),
    assessment: providerAssessmentValidator,
  }), v.null()),
  handler: async (ctx, { requestId }) => {
    const ownerId = await requireUserId(ctx);
    const request = await ctx.db.get(requestId);
    if (!request || request.ownerId !== ownerId || request.providerActionKind !== "acceptance" || !request.providerOfferId ||
      !request.providerOfferHash || !request.reviewContextHash || request.payload.kind !== "platform_message") return null;
    const offer = await ctx.db.get(request.providerOfferId);
    if (!offer || offer.ownerId !== ownerId) return null;
    let current = true;
    try { await assertAcceptanceCurrent(ctx, request); } catch { current = false; }
    return {
      requestId, offerId: offer._id, offerHash: request.providerOfferHash, offerRevision: offer.revision,
      contentVersion: request.contentVersion, contentHash: request.contentHash, reviewContextHash: request.reviewContextHash,
      status: request.status, current, expiresAt: request.expiresAt ?? 0,
      destination: `roomscout.dev · ${request.payload.recipients.join(", ") || "Existing provider thread"}`,
      actingAs: request.payload.senderLabel ?? "Connected portal account", subject: request.payload.subject ?? "", body: request.payload.body,
      assessment: offer.assessment,
    };
  },
});

export const approveAndSend = mutation({
  args: { requestId: v.id("actionRequests"), offerId: v.id("offerRevisions"), expectedOfferHash: v.string(),
    expectedContentVersion: v.number(), expectedContentHash: v.string(), expectedContextHash: v.string(), acknowledged: v.literal(true) },
  returns: v.object({ requestId: v.id("actionRequests"), status: v.string() }),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const request = await ctx.db.get(args.requestId);
    if (!request || request.ownerId !== ownerId || request.providerActionKind !== "acceptance") throw new ConvexError({ code: "ACTION_NOT_FOUND" });
    if (request.providerOfferId !== args.offerId || request.providerOfferHash !== args.expectedOfferHash ||
      request.contentVersion !== args.expectedContentVersion || request.contentHash !== args.expectedContentHash ||
      request.reviewContextHash !== args.expectedContextHash || await actionPayloadHash(request.payload) !== args.expectedContentHash) throw new ConvexError({ code: "ACCEPTANCE_CONTENT_CHANGED" });
    const prior = await ctx.db.query("actionApprovals").withIndex("by_request_and_content_version", (q) => q.eq("requestId", request._id).eq("contentVersion", request.contentVersion)).unique();
    if (prior?.decision === "approved" && prior.ownerId === ownerId && prior.providerOfferId === args.offerId &&
      prior.providerOfferHash === args.expectedOfferHash && prior.reviewContextHash === args.expectedContextHash &&
      ["approved", "executing", "executed"].includes(request.status)) return { requestId: request._id, status: request.status };
    if (request.status !== "awaiting_approval" || prior) throw new ConvexError({ code: "ACCEPTANCE_NOT_REVIEWABLE" });
    const now = Date.now();
    if (!request.expiresAt || request.expiresAt <= now) throw new ConvexError({ code: "ACCEPTANCE_EXPIRED" });
    const { need, conversation, signal } = await assertAcceptanceCurrent(ctx, request);
    const target = await resolveControlledPortal(ctx, conversation, signal, now);
    if (!target || target.connection._id !== request.connectionId || target.thread?._id !== (request.payload.kind === "platform_message" ? request.payload.threadId : undefined) ||
      target.binding._id !== request.adapterBindingId || target.policy._id !== request.policyVersionId) throw new ConvexError({ code: "ACCEPTANCE_DESTINATION_CHANGED" });
    if (need.acceptanceRequestId && need.acceptanceRequestId !== request._id) {
      const other = await ctx.db.get(need.acceptanceRequestId);
      if (other && ["approved", "executing", "executed"].includes(other.status)) throw new ConvexError({ code: "ANOTHER_ACCEPTANCE_IN_PROGRESS" });
    }
    await ctx.db.insert("actionApprovals", {
      requestId: request._id, ownerId, contentVersion: request.contentVersion, contentHash: request.contentHash,
      payloadSnapshot: request.payload, providerOfferId: args.offerId, providerOfferHash: args.expectedOfferHash,
      reviewContextHash: args.expectedContextHash, reviewDestinationHash: request.reviewDestinationHash,
      policyVersionId: request.policyVersionId, decision: "approved", decidedAt: now,
    });
    await ctx.db.patch(request._id, { status: "approved", updatedAt: now });
    await ctx.db.patch(need._id, { acceptanceRequestId: request._id });
    await ctx.db.insert("auditEvents", { eventKey: `acceptance:${request._id}:approved`, actorType: "user", actorUserId: ownerId,
      entityKey: `action:${request._id}`, eventType: "offer.acceptance_approved", actionRequestId: request._id, afterHash: request.contentHash, occurredAt: now });
    const browserProvider = resolvePortalBrowserProvider();
    if (storedPortalBrowserProvider(target.connection.browserProvider) !== browserProvider) {
      throw new ConvexError({ code: "PORTAL_BROWSER_PROVIDER_RECONNECT_REQUIRED" });
    }
    await enqueueApprovedPortalWrite(ctx, { ownerId, requestId: request._id, browserProvider });
    return { requestId: request._id, status: "approved" };
  },
});
