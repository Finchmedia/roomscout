"use node";

import { ConvexError, v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import { FirecrawlRoomScoutClient } from "./components/firecrawlRoomScout/client";
import {
  CONTROLLED_SOURCE_PROOF_CONFIRMATION,
  CONTROLLED_SOURCE_URL,
} from "./integrations/controlledSourceProofConfig";
import { envValue } from "./integrations/env";
import {
  buildDesiredMonitor,
  monitorConfigFingerprint,
  monitorMatchesDesired,
} from "./integrations/monitorReconciliation";

const firecrawl = new FirecrawlRoomScoutClient(components.firecrawlRoomScout);
const confirmation = v.literal(CONTROLLED_SOURCE_PROOF_CONFIRMATION);

/**
 * Creates/reconciles and manually runs exactly one first-party monitor. This
 * intentionally bypasses the global recurring-monitor switch, which remains
 * off while the proof is in progress.
 */
export const runOnce = internalAction({
  args: { confirmation },
  returns: v.object({
    sourceTargetId: v.id("sourceTargets"),
    providerMonitorId: v.string(),
    checkId: v.string(),
    status: v.string(),
  }),
  handler: async (ctx): Promise<{
    sourceTargetId: Id<"sourceTargets">;
    providerMonitorId: string;
    checkId: string;
    status: string;
  }> => {
    if (
      !envValue("FIRECRAWL_API_KEY") ||
      !envValue("FIRECRAWL_WEBHOOK_URL") ||
      !envValue("FIRECRAWL_MONITOR_WEBHOOK_BEARER")
    ) {
      throw new ConvexError({ code: "FIRECRAWL_NOT_CONFIGURED" });
    }
    const prepared: {
      sourceId: Id<"sources">;
      sourceTargetId: Id<"sourceTargets">;
      providerMonitorId?: string;
    } = await ctx.runMutation(
      internal.controlledSourceProof.prepare,
      { confirmation: CONTROLLED_SOURCE_PROOF_CONFIRMATION },
    );
    const candidate: {
      sourceTargetId: Id<"sourceTargets">;
      sourceName: string;
      url: string;
      scheduleMinutes: number;
      providerMonitorId?: string;
      storedFingerprint?: string;
    } | null = await ctx.runQuery(
      internal.controlledSourceProof.getRunContext,
      { sourceTargetId: prepared.sourceTargetId },
    );
    if (!candidate || candidate.url !== CONTROLLED_SOURCE_URL) {
      throw new ConvexError({ code: "CONTROLLED_SOURCE_NOT_RUNNABLE" });
    }

    const desired = buildDesiredMonitor({
      candidate: {
        targetId: candidate.sourceTargetId,
        sourceName: candidate.sourceName,
        url: candidate.url,
        mode: "scrape",
        scheduleMinutes: candidate.scheduleMinutes,
        paused: false,
      },
      webhookUrl: envValue("FIRECRAWL_WEBHOOK_URL")!,
      webhookBearer: envValue("FIRECRAWL_MONITOR_WEBHOOK_BEARER")!,
    });
    const fingerprint = monitorConfigFingerprint(desired, false);
    let providerMonitorId = candidate.providerMonitorId;

    if (!providerMonitorId) {
      const monitor = await firecrawl.createMonitor(ctx, desired);
      providerMonitorId = monitor.id;
      await ctx.runMutation(internal.firecrawl.saveMonitorReconciliation, {
        sourceTargetId: candidate.sourceTargetId,
        providerMonitorId: monitor.id,
        providerTargetId: monitor.targets[0]?.id,
        state: "active",
        configFingerprint: fingerprint,
      });
    } else {
      const current = await firecrawl.getMonitor(ctx, providerMonitorId);
      if (
        !monitorMatchesDesired(
          current,
          fingerprint,
          candidate.storedFingerprint,
          false,
        )
      ) {
        const updated = await firecrawl.updateMonitor(ctx, providerMonitorId, {
          name: desired.name,
          status: "active",
          schedule: desired.schedule,
          webhook: desired.webhook,
          targets: desired.targets,
          retentionDays: desired.retentionDays,
          goal: desired.goal,
          judgeEnabled: desired.judgeEnabled,
        });
        await ctx.runMutation(internal.firecrawl.saveMonitorReconciliation, {
          sourceTargetId: candidate.sourceTargetId,
          providerMonitorId: updated.id,
          providerTargetId: updated.targets[0]?.id,
          state: "active",
          configFingerprint: fingerprint,
        });
      }
    }

    const check = await firecrawl.runMonitor(ctx, providerMonitorId);
    return {
      sourceTargetId: candidate.sourceTargetId,
      providerMonitorId,
      checkId: check.id,
      status: check.status,
    };
  },
});

/** Pauses both the provider monitor and its exact first-party registry row. */
export const pauseAfterProof = internalAction({
  args: { confirmation },
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    const paused: {
      sourceTargetId: Id<"sourceTargets">;
      providerMonitorId?: string;
    } = await ctx.runMutation(
      internal.controlledSourceProof.pause,
      { confirmation: CONTROLLED_SOURCE_PROOF_CONFIRMATION },
    );
    if (paused.providerMonitorId) {
      await firecrawl.updateMonitor(ctx, paused.providerMonitorId, {
        status: "paused",
      });
      await ctx.runMutation(internal.firecrawl.saveMonitorReconciliation, {
        sourceTargetId: paused.sourceTargetId,
        providerMonitorId: paused.providerMonitorId,
        state: "paused",
        configFingerprint: "controlled-proof:paused",
      });
    }
    return null;
  },
});
