"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalAction, type ActionCtx } from "./_generated/server";
import { requireActionUserId } from "./integrations/authz";
import { envValue } from "./integrations/env";
import {
  FirecrawlSubmissionError,
  prepareFormWithFirecrawl,
  resolveReviewedSubmitWorkflow,
  resumeFirecrawlInteractionPreview,
  stopFirecrawlInteraction,
  submitApprovedFormWithFirecrawl,
} from "./integrations/firecrawlInteractClient";
import { roomScoutRateLimiter } from "./rateLimits";

function firecrawlKey(): string {
  const key = envValue("FIRECRAWL_API_KEY");
  if (!key) throw new ConvexError({ code: "FIRECRAWL_NOT_CONFIGURED" });
  return key;
}

export const prepareApprovedForm = action({
  args: { requestId: v.id("actionRequests") },
  returns: v.object({
    executionId: v.id("actionExecutions"),
    jobId: v.string(),
    liveViewUrl: v.optional(v.string()),
    interactiveLiveViewUrl: v.optional(v.string()),
    filled: v.array(v.string()),
    missing: v.array(v.string()),
    submitted: v.literal(false),
  }),
  handler: async (ctx, args): Promise<{
    executionId: Id<"actionExecutions">;
    jobId: string;
    liveViewUrl?: string;
    interactiveLiveViewUrl?: string;
    filled: string[];
    missing: string[];
    submitted: false;
  }> => {
    const ownerId = await requireActionUserId(ctx);
    await roomScoutRateLimiter.limit(ctx, "firecrawlInteractUser", { key: ownerId, throws: true });
    const form = await ctx.runQuery(internal.externalActions.getApprovedContactForm, { ownerId, requestId: args.requestId });
    if (form === null) throw new ConvexError({ code: "APPROVED_FORM_NOT_FOUND" });
    firecrawlKey();
    const result = await prepareFormWithFirecrawl({
      ctx,
      url: form.targetUrl,
      fields: form.fields.map((field: { name: string; label?: string; value: string }) => ({ key: field.name, value: field.value, aliases: field.label ? [field.label, field.name] : [field.name] })),
    });
    try {
      const executionId: Id<"actionExecutions"> = await ctx.runMutation(internal.externalActions.markPreparing, { ownerId, requestId: args.requestId, providerActionId: result.jobId });
      let filled: string[] = [];
      let missing: string[] = [];
      try {
        const parsed = JSON.parse(result.output) as { filled?: unknown; missing?: unknown };
        if (Array.isArray(parsed.filled)) filled = parsed.filled.filter((item): item is string => typeof item === "string").slice(0, 30);
        if (Array.isArray(parsed.missing)) missing = parsed.missing.filter((item): item is string => typeof item === "string").slice(0, 30);
      } catch { /* Provider output is advisory; live preview remains authoritative. */ }
      return { executionId, jobId: result.jobId, liveViewUrl: result.liveViewUrl, interactiveLiveViewUrl: result.interactiveLiveViewUrl, filled, missing, submitted: false as const };
    } catch (error) {
      await stopFirecrawlInteraction({ ctx, jobId: result.jobId }).catch(() => undefined);
      throw error;
    }
  },
});

export const stopPreparedForm = action({
  args: { requestId: v.id("actionRequests") }, returns: v.null(),
  handler: async (ctx, args) => {
    const ownerId = await requireActionUserId(ctx);
    const interaction = await ctx.runQuery(internal.externalActions.getPreparedInteraction, { ownerId, requestId: args.requestId });
    if (interaction === null) throw new ConvexError({ code: "INTERACTION_NOT_FOUND" });
    firecrawlKey();
    await stopFirecrawlInteraction({ ctx, jobId: interaction.jobId }).catch(() => undefined);
    await ctx.runMutation(internal.externalActions.cancelPreparedInteraction, { ownerId, requestId: args.requestId, error: "USER_STOPPED_INTERACTION" });
    return null;
  },
});

const executionStatus = v.union(
  v.literal("claimed"),
  v.literal("running"),
  v.literal("succeeded"),
  v.literal("failed"),
  v.literal("unknown"),
);

const executeState = v.union(
  v.literal("submitted_verified"),
  v.literal("human_required"),
  v.literal("verification_unknown"),
  v.literal("already_succeeded"),
  v.literal("already_running"),
  v.literal("already_terminal"),
);

const executeReason = v.union(
  v.literal("SUCCESS_SIGNAL_OBSERVED"),
  v.literal("HUMAN_PRESENCE_REQUIRED"),
  v.literal("CAPTCHA_REQUIRED"),
  v.literal("AUTHENTICATION_REQUIRED"),
  v.literal("TERMS_ACCEPTANCE_REQUIRED"),
  v.literal("PAYMENT_OR_CONTRACT_CONTROL_PRESENT"),
  v.literal("MISSING_REQUIRED_FIELDS"),
  v.literal("SUBMIT_CONTROL_MISMATCH"),
  v.literal("SUCCESS_SIGNAL_NOT_OBSERVED"),
  v.literal("EXECUTION_ALREADY_SUCCEEDED"),
  v.literal("EXECUTION_ALREADY_RUNNING"),
  v.literal("EXECUTION_ALREADY_TERMINAL"),
);

type ExecuteApprovedResult = {
  executionId: Id<"actionExecutions">;
  executionStatus: "claimed" | "running" | "succeeded" | "failed" | "unknown";
  state:
    | "submitted_verified"
    | "human_required"
    | "verification_unknown"
    | "already_succeeded"
    | "already_running"
    | "already_terminal";
  reasonCode:
    | "SUCCESS_SIGNAL_OBSERVED"
    | "HUMAN_PRESENCE_REQUIRED"
    | "CAPTCHA_REQUIRED"
    | "AUTHENTICATION_REQUIRED"
    | "TERMS_ACCEPTANCE_REQUIRED"
    | "PAYMENT_OR_CONTRACT_CONTROL_PRESENT"
    | "MISSING_REQUIRED_FIELDS"
    | "SUBMIT_CONTROL_MISMATCH"
    | "SUCCESS_SIGNAL_NOT_OBSERVED"
    | "EXECUTION_ALREADY_SUCCEEDED"
    | "EXECUTION_ALREADY_RUNNING"
    | "EXECUTION_ALREADY_TERMINAL";
  jobId?: string;
  liveViewUrl?: string;
  interactiveLiveViewUrl?: string;
  filled: string[];
  missing: string[];
  blockers: string[];
};

async function executeApprovedForOwner(
  ctx: ActionCtx,
  ownerId: Id<"users">,
  requestId: Id<"actionRequests">,
): Promise<ExecuteApprovedResult> {
  firecrawlKey();
  await roomScoutRateLimiter.limit(ctx, "firecrawlInteractUser", {
    key: ownerId,
    throws: true,
  });
  const claim = await ctx.runMutation(
    internal.externalActions.claimForExecutor,
    { ownerId, requestId, executor: "firecrawl" },
  );

  if (claim.alreadyClaimed) {
    let preview:
      | { liveViewUrl?: string; interactiveLiveViewUrl?: string }
      | undefined;
    if (claim.executionStatus === "running") {
      const interaction = await ctx.runQuery(
        internal.externalActions.getPreparedInteraction,
        { ownerId, requestId },
      );
      if (interaction !== null) {
        preview = await resumeFirecrawlInteractionPreview({
          ctx,
          jobId: interaction.jobId,
        }).catch(() => undefined);
      }
    }
    if (claim.executionStatus === "succeeded") {
      return {
        executionId: claim.executionId,
        executionStatus: claim.executionStatus,
        state: "already_succeeded",
        reasonCode: "EXECUTION_ALREADY_SUCCEEDED",
        filled: [],
        missing: [],
        blockers: [],
      };
    }
    if (
      claim.executionStatus === "running" ||
      claim.executionStatus === "claimed"
    ) {
      return {
        executionId: claim.executionId,
        executionStatus: claim.executionStatus,
        state: "already_running",
        reasonCode: "EXECUTION_ALREADY_RUNNING",
        ...(preview?.liveViewUrl
          ? { liveViewUrl: preview.liveViewUrl }
          : {}),
        ...(preview?.interactiveLiveViewUrl
          ? { interactiveLiveViewUrl: preview.interactiveLiveViewUrl }
          : {}),
        filled: [],
        missing: [],
        blockers: [],
      };
    }
    return {
      executionId: claim.executionId,
      executionStatus: claim.executionStatus,
      state: "already_terminal",
      reasonCode: "EXECUTION_ALREADY_TERMINAL",
      filled: [],
      missing: [],
      blockers: [],
    };
  }

  if (
    claim.requestedActionType !== "submit_webform" ||
    claim.payload.kind !== "contact_form" ||
    claim.adapterConfig.kind !== "firecrawl"
  ) {
    await ctx.runMutation(internal.externalActions.finishExecution, {
      ownerId,
      executionId: claim.executionId,
      status: "failed",
      error: "FIRECRAWL_ACTION_SHAPE_MISMATCH",
    });
    throw new ConvexError({ code: "FIRECRAWL_ACTION_SHAPE_MISMATCH" });
  }

  const workflow = resolveReviewedSubmitWorkflow({
    adapterKey: claim.adapterKey,
    extractionProfileKey: claim.adapterConfig.extractionProfileKey,
  });
  if (workflow === null) {
    await ctx.runMutation(internal.externalActions.finishExecution, {
      ownerId,
      executionId: claim.executionId,
      status: "failed",
      error: "UNREVIEWED_FIRECRAWL_SUBMIT_WORKFLOW",
    });
    throw new ConvexError({ code: "UNREVIEWED_FIRECRAWL_SUBMIT_WORKFLOW" });
  }

  try {
    const result = await submitApprovedFormWithFirecrawl({
      ctx,
      url: claim.payload.targetUrl,
      fields: claim.payload.fields.map((field) => ({
        name: field.name,
        value: field.value,
      })),
      workflow,
      forceHumanPresence: claim.humanPresenceRequired,
      onSessionCreated: async (jobId) => {
        await ctx.runMutation(
          internal.externalActions.attachProviderExecution,
          {
            ownerId,
            executionId: claim.executionId,
            providerActionId: jobId,
          },
        );
      },
    });

    if (result.state === "submitted_verified") {
      await ctx.runMutation(internal.externalActions.finishExecution, {
        ownerId,
        executionId: claim.executionId,
        status: "succeeded",
      });
      return {
        executionId: claim.executionId,
        executionStatus: "succeeded",
        state: result.state,
        reasonCode: result.reasonCode,
        jobId: result.jobId,
        filled: result.filled,
        missing: result.missing,
        blockers: result.blockers,
      };
    }

    if (result.state === "verification_unknown") {
      await ctx.runMutation(internal.externalActions.finishExecution, {
        ownerId,
        executionId: claim.executionId,
        status: "unknown",
        error: result.reasonCode,
      });
    }
    return {
      executionId: claim.executionId,
      executionStatus:
        result.state === "verification_unknown" ? "unknown" : "running",
      state: result.state,
      reasonCode: result.reasonCode,
      jobId: result.jobId,
      ...(result.liveViewUrl ? { liveViewUrl: result.liveViewUrl } : {}),
      ...(result.interactiveLiveViewUrl
        ? { interactiveLiveViewUrl: result.interactiveLiveViewUrl }
        : {}),
      filled: result.filled,
      missing: result.missing,
      blockers: result.blockers,
    };
  } catch (error) {
    const mayHaveSubmitted =
      error instanceof FirecrawlSubmissionError && error.mayHaveSubmitted;
    const errorCode = mayHaveSubmitted
      ? "FIRECRAWL_SUBMISSION_OUTCOME_UNKNOWN"
      : "FIRECRAWL_SUBMISSION_FAILED_BEFORE_EXECUTION";
    await ctx.runMutation(internal.externalActions.finishExecution, {
      ownerId,
      executionId: claim.executionId,
      status: mayHaveSubmitted ? "unknown" : "failed",
      error: errorCode,
    });
    throw new ConvexError({ code: errorCode });
  }
}

/**
 * Executes a reviewed public contact-form workflow after the generic action
 * ledger transactionally rechecks the immutable approval/mandate, current
 * source policy, platform domain, and adapter binding. Live View URLs are only
 * returned to this authenticated caller and are never written to Convex.
 */
export const executeApproved = action({
  args: { requestId: v.id("actionRequests") },
  returns: v.object({
    executionId: v.id("actionExecutions"),
    executionStatus,
    state: executeState,
    reasonCode: executeReason,
    jobId: v.optional(v.string()),
    liveViewUrl: v.optional(v.string()),
    interactiveLiveViewUrl: v.optional(v.string()),
    filled: v.array(v.string()),
    missing: v.array(v.string()),
    blockers: v.array(v.string()),
  }),
  handler: async (ctx, args): Promise<ExecuteApprovedResult> => {
    const ownerId = await requireActionUserId(ctx);
    return await executeApprovedForOwner(ctx, ownerId, args.requestId);
  },
});

/** Trusted scheduler entry point. The final claim still rechecks every gate. */
export const executeApprovedWorker = internalAction({
  args: {
    ownerId: v.id("users"),
    requestId: v.id("actionRequests"),
  },
  returns: v.object({
    executionId: v.id("actionExecutions"),
    executionStatus,
    state: executeState,
    reasonCode: executeReason,
    jobId: v.optional(v.string()),
    liveViewUrl: v.optional(v.string()),
    interactiveLiveViewUrl: v.optional(v.string()),
    filled: v.array(v.string()),
    missing: v.array(v.string()),
    blockers: v.array(v.string()),
  }),
  handler: async (ctx, args): Promise<ExecuteApprovedResult> =>
    await executeApprovedForOwner(ctx, args.ownerId, args.requestId),
});

/**
 * Completes a human-presence boundary and explicitly closes the provider
 * session before recording the user's outcome.
 */
export const completeApprovedHumanStep = action({
  args: {
    requestId: v.id("actionRequests"),
    executionId: v.id("actionExecutions"),
    submitted: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerId = await requireActionUserId(ctx);
    const interaction = await ctx.runQuery(
      internal.externalActions.getPreparedInteraction,
      { ownerId, requestId: args.requestId },
    );
    if (interaction === null || interaction.executionId !== args.executionId) {
      throw new ConvexError({ code: "INTERACTION_NOT_FOUND" });
    }
    firecrawlKey();
    await stopFirecrawlInteraction({
      ctx,
      jobId: interaction.jobId,
    }).catch(() => undefined);
    await ctx.runMutation(internal.externalActions.confirmHumanExecution, {
      ownerId,
      requestId: args.requestId,
      executionId: args.executionId,
      submitted: args.submitted,
    });
    return null;
  },
});
