/**
 * Freigabeprüfung at runtime: gathers the facts for one action request,
 * asks the pure gate (`lib/autonomyGate.ts`) and persists the verdict in ONE
 * place (`recordOutcome`). Reads only `scoutAutonomy` via
 * `loadAutonomyForOwner` (ADR 0001).
 */

import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { loadAutonomyForOwner } from "./autonomy";
import { envValue } from "./integrations/env";
import {
  decideGate,
  type GateFacts,
  type GateOutcome,
  type GateReason,
} from "./lib/autonomyGate";
import type { PersonalDataScope } from "./lib/autonomy";
import { gateDecisionSpec, raiseDecision } from "./lib/decisions";
import { messageSafetyContext } from "./lib/messageSafety";
import { scoutWorkpool } from "./workpools";

export const gateOutcomeValidator = v.object({
  outcome: v.union(v.literal("proceed"), v.literal("wait"), v.literal("ask_user"), v.literal("stop")),
  reason: v.optional(v.string()),
  detail: v.optional(v.string()),
  retryAt: v.optional(v.number()),
});

export type PublicGateOutcome = {
  outcome: GateOutcome["outcome"];
  reason?: GateReason;
  detail?: string;
  retryAt?: number;
};

/** A gate verdict together with the rule version it was decided under. */
export type RecordedOutcome = GateOutcome & {
  phase: "submit" | "claim";
  autonomyVersion: number;
  autonomyHash: string;
  /** Safety-check waits so far; carried over unless the caller bumps it. */
  attempts?: number;
};

export type GateExecutor = "firecrawl" | "browserbase" | "agentmail";

/** Controlled-portal rule: on unless `SCOUT_CONTROLLED_PORTAL_ONLY=false`. */
export function controlledPortalOnly(): boolean {
  return envValue("SCOUT_CONTROLLED_PORTAL_ONLY")?.trim().toLowerCase() !== "false";
}

export function publicOutcome(outcome: GateOutcome): PublicGateOutcome {
  if (outcome.outcome === "proceed") return { outcome: "proceed" };
  return {
    outcome: outcome.outcome,
    reason: outcome.reason,
    ...(outcome.detail !== undefined ? { detail: outcome.detail } : {}),
    ...(outcome.outcome === "wait" && outcome.retryAt !== undefined ? { retryAt: outcome.retryAt } : {}),
  };
}

export async function checkScoutAction(
  ctx: MutationCtx,
  input: {
    ownerId: Id<"users">;
    request: Doc<"actionRequests">;
    phase: "submit" | "claim";
    executor?: GateExecutor;
    userApproved?: boolean;
    browserBusy?: boolean;
  },
): Promise<RecordedOutcome> {
  const { request, ownerId, phase } = input;
  const autonomy = await loadAutonomyForOwner(ctx, ownerId);
  const isPortalAccountOperation = request.payload.kind === "portal_account_operation";
  const isOwnedMailReply = request.payload.kind === "email_message" &&
    request.payload.mailThreadId !== undefined && request.payload.parentMessageId !== undefined;
  const [platform, policy, connection] = await Promise.all([
    request.platformId ? ctx.db.get(request.platformId) : Promise.resolve(null),
    request.policyVersionId ? ctx.db.get(request.policyVersionId) : Promise.resolve(null),
    request.connectionId ? ctx.db.get(request.connectionId) : Promise.resolve(null),
  ]);

  let contextValid = true;
  let verdict: GateFacts["verdict"] = null;
  const detectedScopes: PersonalDataScope[] = [...request.personalDataScopes];
  if (!isPortalAccountOperation) {
    const context = await messageSafetyContext(ctx, request);
    if (context === null) {
      contextValid = false;
    } else {
      const assessment = await ctx.db.query("messageSafetyAssessments").withIndex("by_request_and_snapshot", (q) =>
        q.eq("requestId", request._id).eq("snapshotHash", context.snapshotHash),
      ).unique();
      if (assessment !== null) {
        verdict = {
          classification: assessment.assessment.classification,
          unsupportedClaims: assessment.assessment.unsupportedClaims,
          explanation: assessment.assessment.explanation,
        };
        detectedScopes.push(...assessment.assessment.personalDataScopes);
      }
    }
  }

  const facts: GateFacts = {
    phase,
    actionType: request.requestedActionType,
    isAcceptance: request.providerActionKind === "acceptance",
    isOwnedMailReply,
    isPortalAccountOperation,
    platformDomain: platform?.canonicalDomain ?? null,
    detectedScopes: [...new Set(detectedScopes)],
    verdict,
    verdictAttempts: request.gate?.attempts ?? 0,
    contextValid,
    policyExecutable: policy !== null && policy.status === "approved" &&
      policy.decision === "allowed" && policy.maxAutomationLevel === "approved_execute",
    connectionActive: connection !== null && connection.ownerId === ownerId && connection.status === "active",
    controlledPortalOnly: controlledPortalOnly(),
    browserBusy: input.browserBusy ?? false,
    // A text the musician dictated (Entscheidung "custom") is their approval in both phases.
    userApproved: (input.userApproved ?? false) || request.humanDraft === true,
    now: Date.now(),
  };
  return {
    ...decideGate(autonomy.rules, facts),
    phase,
    autonomyVersion: autonomy.version,
    autonomyHash: autonomy.contentHash,
    attempts: request.gate?.attempts,
  };
}

/**
 * The single place that turns a gate verdict into request state: status,
 * approval ledger, audit trail, scheduling. Returns the new status.
 */
export async function recordOutcome(
  ctx: MutationCtx,
  request: Doc<"actionRequests">,
  outcome: RecordedOutcome,
): Promise<Doc<"actionRequests">["status"]> {
  const now = Date.now();
  const gate: NonNullable<Doc<"actionRequests">["gate"]> = {
    outcome: outcome.outcome,
    ...(outcome.outcome !== "proceed" ? { reason: outcome.reason } : {}),
    ...(outcome.outcome !== "proceed" && outcome.detail !== undefined ? { detail: outcome.detail } : {}),
    ...(outcome.outcome === "wait" && outcome.retryAt !== undefined ? { retryAt: outcome.retryAt } : {}),
    ...(outcome.attempts !== undefined ? { attempts: outcome.attempts } : {}),
    autonomyVersion: outcome.autonomyVersion,
    autonomyHash: outcome.autonomyHash,
    decidedAt: now,
  };
  const ownerId = request.ownerId;

  if (outcome.outcome === "proceed") {
    const existing = await ctx.db.query("actionApprovals").withIndex("by_request_and_content_version", (q) =>
      q.eq("requestId", request._id).eq("contentVersion", request.contentVersion),
    ).unique();
    if (existing !== null && (existing.ownerId !== ownerId || existing.contentHash !== request.contentHash)) {
      throw new ConvexError({ code: "APPROVAL_MISMATCH" });
    }
    if (existing === null) {
      await ctx.db.insert("actionApprovals", {
        requestId: request._id, ownerId, contentVersion: request.contentVersion,
        contentHash: request.contentHash, payloadSnapshot: request.payload,
        policyVersionId: request.policyVersionId, decision: "authorized_by_autonomy",
        autonomyVersion: outcome.autonomyVersion, autonomyHash: outcome.autonomyHash,
        decidedAt: now,
      });
      await ctx.db.insert("auditEvents", {
        eventKey: `action:${request._id}:autonomy_authorized:${request.contentVersion}`,
        actorType: "system", actorUserId: ownerId, entityKey: `action:${request._id}`,
        eventType: "action.authorized_by_autonomy", actionRequestId: request._id,
        policyId: request.policyVersionId, afterHash: request.contentHash,
        summary: `Handlungsspielraum v${outcome.autonomyVersion}`, occurredAt: now,
      });
    }
    await ctx.db.patch(request._id, { status: "approved", error: undefined, gate, updatedAt: now });
    return "approved";
  }

  if (outcome.outcome === "wait") {
    if (outcome.reason === "safety_pending" && outcome.retryAt === undefined) {
      await ctx.db.patch(request._id, { status: "queued", error: undefined, gate, updatedAt: now });
      await scoutWorkpool.enqueueAction(ctx, internal.messageSafety.assessAndAuthorize, { requestId: request._id }, {
        onComplete: internal.messageSafety.assessmentCompleted,
        context: { requestId: request._id, contentVersion: request.contentVersion },
      });
      return "queued";
    }
    const retryAt = outcome.retryAt ?? now;
    const delay = Math.max(0, retryAt - now);
    if (outcome.phase === "claim" && request.status === "approved") {
      // The approval stands; only the world has to catch up. Re-dispatch later.
      await ctx.db.patch(request._id, { error: undefined, gate, updatedAt: now });
      await ctx.scheduler.runAfter(delay, internal.externalActions.redispatchApproved, { ownerId, requestId: request._id });
      return "approved";
    }
    await ctx.db.patch(request._id, { status: "queued", error: undefined, gate, updatedAt: now });
    await ctx.scheduler.runAfter(delay, internal.externalActions.submitChecked, { ownerId, requestId: request._id, dispatch: true });
    return "queued";
  }

  if (outcome.outcome === "ask_user") {
    await ctx.db.patch(request._id, { status: "awaiting_approval", error: undefined, gate, updatedAt: now });
    await ctx.db.insert("auditEvents", {
      eventKey: `action:${request._id}:approval_requested:${request.contentVersion}:${outcome.reason}`,
      actorType: "system", actorUserId: ownerId, entityKey: `action:${request._id}`,
      eventType: "action.approval_requested", actionRequestId: request._id,
      policyId: request.policyVersionId, afterHash: request.contentHash,
      summary: outcome.reason, occurredAt: now,
    });
    // ADR 0002: an ask_user is an Entscheidung with the finished text, never a silent stop.
    const spec = gateDecisionSpec(request, outcome);
    if (spec !== null) {
      await raiseDecision(ctx, {
        ownerId, savedNeedId: request.savedNeedId, conversationId: request.providerConversationId,
        kind: spec.kind, question: spec.question, detail: spec.detail, options: spec.options,
        refs: { requestId: request._id, ...(request.providerOfferId ? { offerId: request.providerOfferId } : {}) },
      });
    }
    return "awaiting_approval";
  }

  const status = outcome.reason === "context_changed" ? "expired" : "blocked";
  await ctx.db.patch(request._id, { status, error: outcome.reason, gate, updatedAt: now });
  await ctx.db.insert("auditEvents", {
    eventKey: `action:${request._id}:stopped:${request.contentVersion}:${outcome.reason}`,
    actorType: "system", actorUserId: ownerId, entityKey: `action:${request._id}`,
    eventType: "action.stopped_by_gate", actionRequestId: request._id,
    policyId: request.policyVersionId, afterHash: request.contentHash,
    summary: outcome.reason, occurredAt: now,
  });
  return status;
}
