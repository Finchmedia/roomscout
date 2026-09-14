import { v } from "convex/values";
import { resolveControlledPortal } from "./lib/providerPortal";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { actionPayloadHash, normalizeText } from "./integrations/contentHash";
import { opportunityMatchIsCurrent, signalMatchRevision } from "./lib/matchValidity";

/** Translate a recorded proposal into an exact ledger payload. The model never
 * chooses a URL, recipient, connection or executor; the Freigabeprüfung decides at submit time. */
export const stageReply = internalMutation({
  args: { offerId: v.id("offerRevisions") }, returns: v.union(v.id("actionRequests"), v.null()),
  handler: async (ctx, { offerId }) => {
    const offer = await ctx.db.get(offerId);
    const conversation = offer ? await ctx.db.get(offer.conversationId) : null;
    if (!offer || !conversation || conversation.state === "closed" || conversation.ownerId !== offer.ownerId ||
      conversation.currentOfferId !== offerId || conversation.revision !== offer.revision ||
      !offer.assessment.suggestedReply || !["ask_provider", "decline"].includes(offer.assessment.nextAction)) return null;
    const [need, signal, priorRequests] = await Promise.all([
      ctx.db.get(conversation.savedNeedId), ctx.db.get(conversation.signalId),
      ctx.db.query("actionRequests").withIndex("by_provider_offer", (q) => q.eq("providerOfferId", offerId)).order("desc").take(10),
    ]);
    // A dead request (stopped, expired, rejected) must not block a fresh draft forever.
    const existing = priorRequests.find((row) => !["expired", "blocked", "rejected"].includes(row.status));
    if (existing) return existing._id;
    if (!need || need.ownerId !== offer.ownerId || need.status !== "active" || (need.matchingRevision ?? 0) !== offer.needRevision ||
      !signal || !["published", "stale"].includes(signal.status) || await signalMatchRevision(signal) !== offer.signalRevision) return null;
    if (conversation.mailThreadId) {
      const thread = await ctx.db.get(conversation.mailThreadId);
      const draft = thread ? await ctx.db.get(thread.draftId) : null;
      const mailbox = thread?.mailboxId ? await ctx.db.get(thread.mailboxId) : null;
      const messages = thread ? await ctx.db.query("mailMessages").withIndex("by_thread_and_received_at", (q) => q.eq("threadId", thread._id)).order("desc").take(20) : [];
      const parent = messages.find((message) => message.direction === "inbound");
      const entry = signal.sourceEntryId ? await ctx.db.get(signal.sourceEntryId) : null;
      const source = entry ? await ctx.db.get(entry.sourceId) : null;
      const platform = source?.platformId ? await ctx.db.get(source.platformId) : null;
      const bindings = platform ? await ctx.db.query("sourceAdapterBindings").withIndex("by_platform_and_flow_and_status", (q) => q.eq("platformId", platform._id).eq("flow", "reply").eq("status", "active")).take(2) : [];
      const binding = bindings.length === 1 && bindings[0]?.executor === "agentmail" && bindings[0].config.kind === "agentmail" && bindings[0].config.purpose === "reply" ? bindings[0] : null;
      const policy = binding?.policyVersionId ? await ctx.db.get(binding.policyVersionId) : null;
      if (!thread || thread.ownerId !== offer.ownerId || !draft || draft.ownerId !== offer.ownerId || !mailbox || mailbox.ownerId !== offer.ownerId || mailbox.status !== "active" || !parent || !platform || !binding || !policy || policy.platformId !== platform._id || policy.flow !== "reply" || policy.status !== "approved" || policy.decision !== "allowed" || policy.maxAutomationLevel !== "approved_execute") return null;
      const payload: Doc<"actionRequests">["payload"] = { kind: "email_message", recipientName: parent.from.slice(0, 160), recipientEmail: parent.from.trim().toLowerCase(), subject: normalizeText(offer.assessment.suggestedReply.subject).slice(0, 200), body: normalizeText(offer.assessment.suggestedReply.body).slice(0, 20_000), mailThreadId: thread._id, parentMessageId: parent.providerMessageId };
      const now = Date.now();
      const requestId = await ctx.db.insert("actionRequests", { ownerId: offer.ownerId, savedNeedId: need._id, providerConversationId: conversation._id, providerOfferId: offerId, matchingNeedRevision: offer.needRevision, matchingSignalId: signal._id, matchingSignalRevision: offer.signalRevision, opportunityId: conversation.opportunityId, platformId: platform._id, adapterBindingId: binding._id, policyVersionId: policy._id, automationMode: "autopilot", requestedActionType: "send_email", personalDataScopes: ["reply_email"], payload, contentVersion: 1, contentHash: await actionPayloadHash(payload), status: "drafted", expiresAt: now + 86_400_000, createdAt: now, updatedAt: now });
      await ctx.runMutation(internal.externalActions.submitChecked, { ownerId: offer.ownerId, requestId });
      return requestId;
    }
    const target = await resolveControlledPortal(ctx, conversation, signal, Date.now());
    if (!target) {
      await ctx.db.patch(conversation._id, { state: "needs_attention", lastErrorCode: "PORTAL_CONNECTION_REQUIRED", updatedAt: Date.now() });
      return null;
    }
    const { platform, listingUrl, binding, policy, connection, thread } = target;
    if (!thread) {
      const opportunity = conversation.opportunityId ? await ctx.db.get(conversation.opportunityId) : null;
      if (!opportunity || signal.status !== "published" || !await opportunityMatchIsCurrent(ctx, opportunity, true)) return null;
    } else if (thread.ownerId !== offer.ownerId) return null;
    const payload: Doc<"actionRequests">["payload"] = {
      kind: "platform_message", threadId: thread?._id, targetPath: thread ? undefined : listingUrl.pathname,
      recipients: thread?.participants ?? ["Listing owner"], senderLabel: "RoomScout musician",
      subject: normalizeText(offer.assessment.suggestedReply.subject).slice(0, 200),
      body: normalizeText(offer.assessment.suggestedReply.body).slice(0, 20_000),
    };
    const now = Date.now();
    const requestId = await ctx.db.insert("actionRequests", {
      ownerId: offer.ownerId, savedNeedId: need._id, providerConversationId: conversation._id, providerOfferId: offerId,
      matchingNeedRevision: offer.needRevision, matchingSignalId: signal._id, matchingSignalRevision: offer.signalRevision,
      opportunityId: conversation.opportunityId,
      platformId: platform._id, connectionId: connection._id, adapterBindingId: binding._id, policyVersionId: policy._id,
      automationMode: "autopilot", requestedActionType: "send_platform_dm", personalDataScopes: [],
      payload, contentVersion: 1, contentHash: await actionPayloadHash(payload), status: "drafted",
      expiresAt: now + 86_400_000, createdAt: now, updatedAt: now,
    });
    await ctx.db.insert("auditEvents", {
      eventKey: `provider:${offerId}:draft`, actorType: "system", actorUserId: offer.ownerId,
      entityKey: `action:${requestId}`, eventType: "provider.reply_drafted", actionRequestId: requestId, occurredAt: now,
    });
    await ctx.runMutation(internal.externalActions.submitChecked, { ownerId: offer.ownerId, requestId });
    return requestId;
  },
});
