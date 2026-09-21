import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { projectSignal } from "./signals";
import { listCandidatesForOwner } from "./matches";
import { canonicalizeUrl } from "./integrations/urlCanonicalization";
import { signalMatchRevision } from "./lib/matchValidity";
import { assertVoiceClaim, syncVoiceSessionFocus, voiceClaimValidator } from "./lib/voiceClaim";
import { conversationProgress, latestProviderReplyExcerpt } from "./lib/conversationProgress";
import { delimitUntrustedData } from "./lib/privacy";

async function ownedNeed(ctx: QueryCtx, ownerId: Id<"users">, savedNeedId: Id<"savedNeeds">) {
  const need = await ctx.db.get(savedNeedId);
  if (!need || need.ownerId !== ownerId) throw new ConvexError({ code: "NEED_NOT_FOUND" });
  return need;
}

/** Index lookup only. A supplied URL is never fetched and cannot run browser actions. */
export const inspect = internalQuery({
  args: { ownerId: v.id("users"), savedNeedId: v.id("savedNeeds"), signalId: v.optional(v.id("signals")), url: v.optional(v.string()) },
  returns: v.string(),
  handler: async (ctx, args) => {
    const need = await ownedNeed(ctx, args.ownerId, args.savedNeedId);
    let signalId = args.signalId;
    if (args.url) {
      const canonicalUrl = canonicalizeUrl(args.url);
      if (!canonicalUrl || args.url.length > 2048) return JSON.stringify({ status: "invalid_url" });
      const entry = await ctx.db.query("sourceEntries").withIndex("by_canonical_url", q => q.eq("canonicalUrl", canonicalUrl)).first();
      if (!entry) return JSON.stringify({ status: "not_indexed", fetched: false });
      signalId = entry.signalId ?? (await ctx.db.query("signals").withIndex("by_source_entry", q => q.eq("sourceEntryId", entry._id)).first())?._id;
      if (!signalId) return JSON.stringify({ status: "not_indexed", fetched: false });
    }
    if (!signalId) {
      const [candidates, conversationRows] = await Promise.all([
        listCandidatesForOwner(ctx, { ownerId: args.ownerId, savedNeedId: args.savedNeedId, limit: 20 }),
        ctx.db.query("providerConversations").withIndex("by_need_and_updated_at", (q) =>
          q.eq("savedNeedId", args.savedNeedId)).order("desc").take(20),
      ]);
      const conversations = (await Promise.all(conversationRows.map(async (conversation) => {
        if (conversation.ownerId !== args.ownerId) return null;
        const [signal, requests] = await Promise.all([
          ctx.db.get(conversation.signalId),
          ctx.db.query("actionRequests").withIndex("by_provider_conversation_and_updated_at", (q) =>
            q.eq("providerConversationId", conversation._id)).order("desc").take(20),
        ]);
        const excerpt = await latestProviderReplyExcerpt(ctx, conversation);
        return {
          conversationId: conversation._id,
          signalId: conversation.signalId,
          title: signal?.title ?? "",
          state: conversation.state,
          ...await conversationProgress(ctx, conversation, requests),
          latestProviderReplyExcerpt: excerpt === null ? null : delimitUntrustedData("provider_reply_excerpt", excerpt),
        };
      }))).filter((row): row is NonNullable<typeof row> => row !== null);
      return JSON.stringify({ status: "indexed_candidates", candidates, conversations, manualContact: "candidate_panel_only" });
    }
    const signal = await ctx.db.get(signalId);
    if (!signal || !["published", "stale"].includes(signal.status)) return JSON.stringify({ status: "not_found" });
    const match = await ctx.db.query("signalMatches").withIndex("by_saved_need_and_signal", q => q.eq("savedNeedId", need._id).eq("signalId", signalId!)).unique();
    const current = match?.ownerId === args.ownerId && match.needRevision === (need.matchingRevision ?? 0) && match.signalRevision === await signalMatchRevision(signal);
    const conversation = await ctx.db.query("providerConversations").withIndex("by_need_and_signal", q => q.eq("savedNeedId", need._id).eq("signalId", signalId!)).order("desc").first();
    const ownedConversation = conversation?.ownerId === args.ownerId ? conversation : null;
    const requests = ownedConversation ? await ctx.db.query("actionRequests").withIndex("by_provider_conversation_and_updated_at", q => q.eq("providerConversationId", ownedConversation._id)).order("desc").take(20) : [];
    const excerpt = ownedConversation ? await latestProviderReplyExcerpt(ctx, ownedConversation) : null;
    return JSON.stringify({
      status: "indexed", signal: projectSignal(signal),
      match: current ? { eligible: match.eligible, contactEligible: match.contactEligible, reasons: match.reasons, uncertainties: match.uncertainties, dismissed: match.status === "dismissed" } : null,
      conversation: ownedConversation ? {
        conversationId: ownedConversation._id,
        ...await conversationProgress(ctx, ownedConversation, requests),
        latestProviderReplyExcerpt: excerpt === null ? null : delimitUntrustedData("provider_reply_excerpt", excerpt),
      } : null,
      manualContact: "candidate_panel_only", source: "public_index",
    });
  },
});

/** Navigation only: opening never queues an assessment, creates an inquiry or sends text. */
export const open = internalMutation({
  args: { ownerId: v.id("users"), threadId: v.string(), savedNeedId: v.id("savedNeeds"), signalId: v.id("signals"), voiceClaim: v.optional(voiceClaimValidator) },
  returns: v.object({ opened: v.boolean(), signalId: v.id("signals"), reason: v.optional(v.string()), sent: v.literal(false) }),
  handler: async (ctx, args) => {
    const need = await ownedNeed(ctx, args.ownerId, args.savedNeedId);
    const context = await ctx.db.query("scoutContexts").withIndex("by_thread_id", q => q.eq("threadId", args.threadId)).unique();
    if (!context || context.ownerId !== args.ownerId || context.activeNeedId !== need._id) throw new ConvexError({ code: "THREAD_NOT_FOUND" });
    const voice = args.voiceClaim ? await assertVoiceClaim(ctx, args.ownerId, args.voiceClaim, { savedNeedId: need._id }) : undefined;
    const signal = await ctx.db.get(args.signalId);
    const match = await ctx.db.query("signalMatches").withIndex("by_saved_need_and_signal", q => q.eq("savedNeedId", need._id).eq("signalId", args.signalId)).unique();
    const conversation = await ctx.db.query("providerConversations").withIndex("by_need_and_signal", q => q.eq("savedNeedId", need._id).eq("signalId", args.signalId)).first();
    const openableMatch = match?.eligibility === "fit"
      ? match.eligible === true
      : match?.eligibility === "near_budget"
        ? match.eligible !== true && (match.budgetDeltaEur ?? 0) > 0
        : match?.eligibility === undefined && match?.eligible === true;
    const current = need.status === "active" && signal?.status === "published" && match?.ownerId === args.ownerId && match.status !== "dismissed" &&
      openableMatch && match.needRevision === (need.matchingRevision ?? 0) && match.signalRevision === await signalMatchRevision(signal);
    if (!signal || !["published", "stale"].includes(signal.status) || (!current && conversation?.ownerId !== args.ownerId)) {
      return { opened: false, signalId: args.signalId, reason: "not_current_candidate", sent: false as const };
    }
    const now = Date.now();
    await ctx.db.patch(context._id, { mode: "signal_advisor", focusedSignalId: args.signalId, updatedAt: now });
    // Same transaction as the focus change: otherwise the Live session still
    // points at the old room, finishRequest marks this very turn superseded and
    // every later claim is refused until the musician clicks a room.
    await syncVoiceSessionFocus(ctx, { ownerId: args.ownerId, threadId: args.threadId, activeNeedId: need._id, focusedSignalId: args.signalId, now });
    if (voice) {
      // The claim itself moved the focus, so its own fence follows the new room.
      await ctx.db.patch(voice.session._id, {
        focusedSignalId: args.signalId,
        activeClaim: { ...voice.claim, focusedSignalId: args.signalId },
        updatedAt: now,
      });
    }
    return { opened: true, signalId: args.signalId, sent: false as const };
  },
});
