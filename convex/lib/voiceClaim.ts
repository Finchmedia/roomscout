import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { savedNeedLocationLabel, savedNeedLocationQuery } from "./savedNeedLocation";

export const voiceClaimValidator = v.object({
  voiceSessionId: v.id("voiceSessions"),
  requestId: v.string(),
  generation: v.number(),
});

export type VoiceClaimRef = {
  voiceSessionId: Id<"voiceSessions">;
  requestId: string;
  generation: number;
};

export function voiceNeedSnapshot(need: Doc<"savedNeeds">): string {
  return JSON.stringify({
    title: need.title,
    locationQuery: savedNeedLocationQuery(need),
    locationLabel: savedNeedLocationLabel(need),
    maxBudgetEur: need.maxBudgetEur,
    arrangement: need.arrangement,
    schedule: need.schedule,
    requirements: need.requirements,
    openToSharing: need.openToSharing,
    radiusKm: need.radiusKm,
    genres: need.genres,
    instruments: need.instruments,
    collaborationOpen: need.collaborationOpen,
    facets: need.facets,
  });
}

/** Transaction-time fence for every mutation a Live Scout tool can execute. */
export async function assertVoiceClaim(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  ref: VoiceClaimRef,
  target?: { savedNeedId?: Id<"savedNeeds">; signalId?: Id<"signals">; decisionId?: Id<"decisions"> },
) {
  const session = await ctx.db.get(ref.voiceSessionId);
  const claim = session?.activeClaim;
  if (
    !session || session.ownerId !== ownerId || !claim ||
    claim.requestId !== ref.requestId || claim.generation !== ref.generation
  ) {
    throw new ConvexError({ code: "VOICE_CLAIM_SUPERSEDED" });
  }
  const context = await ctx.db.query("scoutContexts")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).unique();
  if (
    !context || context.threadId !== session.threadId ||
    context.activeNeedId !== session.activeNeedId ||
    (claim.focusedSignalId !== undefined && context.focusedSignalId !== claim.focusedSignalId) ||
    (target?.savedNeedId !== undefined && context.activeNeedId !== target.savedNeedId) ||
    (target?.signalId !== undefined && context.focusedSignalId !== target.signalId) ||
    (target?.signalId !== undefined && claim.focusedSignalId !== target.signalId) ||
    (target?.decisionId !== undefined && claim.decisionId !== target.decisionId)
  ) {
    throw new ConvexError({ code: "VOICE_TARGET_SUPERSEDED" });
  }
  return { session, claim, context };
}
