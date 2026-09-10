"use node";

import { ConvexError, v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalAction, type ActionCtx } from "./_generated/server";
import {
  FirecrawlRoomScoutClient,
  type NativeMonitor,
} from "./components/firecrawlRoomScout/client";
import { requireActionUserId } from "./integrations/authz";
import {
  CONTROLLED_SOURCE_SCHEDULE_MINUTES,
  CONTROLLED_SOURCE_URL,
} from "./integrations/controlledSourceProofConfig";
import { envValue } from "./integrations/env";
import {
  buildDesiredMonitor,
  monitorConfigFingerprint,
  monitorMatchesDesired,
} from "./integrations/monitorReconciliation";

const firecrawl = new FirecrawlRoomScoutClient(components.firecrawlRoomScout);

type MonitorContext = {
  sourceTargetId: Id<"sourceTargets">;
  sourceName: string;
  url: string;
  scheduleMinutes: number;
  providerMonitorId?: string;
  storedFingerprint?: string;
};

type GlobalMonitorProof = {
  providerConfigured: boolean;
  registryReady: boolean;
  providerReachable: boolean;
  providerMonitorId: string | null;
  providerStatus: string | null;
  targetCount: number;
  desiredCadenceMinutes: number;
  desiredScheduleText: string;
  storedConfigMatchesDesired: boolean;
  lastCheckAt: number | null;
  lastCheckStatus: string | null;
  error: string | null;
};

type StoredMonitorProof = {
  lastCheckAt?: number;
  lastCheckStatus?: string;
} | null;

function providerConfig() {
  return {
    apiKey: envValue("FIRECRAWL_API_KEY"),
    webhookUrl: envValue("FIRECRAWL_WEBHOOK_URL"),
    webhookBearer: envValue("FIRECRAWL_MONITOR_WEBHOOK_BEARER"),
  };
}

function desiredMonitor(candidate: MonitorContext) {
  const config = providerConfig();
  if (!config.apiKey || !config.webhookUrl || !config.webhookBearer) {
    throw new ConvexError({ code: "FIRECRAWL_NOT_CONFIGURED" });
  }
  return buildDesiredMonitor({
    candidate: {
      targetId: candidate.sourceTargetId,
      sourceName: candidate.sourceName,
      url: candidate.url,
      mode: "scrape",
      scheduleMinutes: candidate.scheduleMinutes,
      paused: false,
    },
    webhookUrl: config.webhookUrl,
    webhookBearer: config.webhookBearer,
  });
}

async function requireActionOperator(ctx: ActionCtx): Promise<void> {
  const userId = await requireActionUserId(ctx);
  const allowed = await ctx.runQuery(internal.users.isOperatorInternal, {
    userId,
  });
  if (!allowed) throw new ConvexError({ code: "FORBIDDEN" });
}

/**
 * Keeps exactly one first-party Native Monitor definition active. It never
 * invokes a monitor check; Firecrawl remains the sole retrieval scheduler.
 */
export const reconcileGlobalMonitor = internalAction({
  args: {},
  returns: v.object({
    status: v.union(
      v.literal("created"),
      v.literal("updated"),
      v.literal("unchanged"),
      v.literal("unconfigured"),
      v.literal("failed"),
    ),
    providerMonitorId: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (
    ctx,
  ): Promise<{
    status: "created" | "updated" | "unchanged" | "unconfigured" | "failed";
    providerMonitorId?: string;
    error?: string;
  }> => {
    const records: { publicTargetId: Id<"sourceTargets"> } =
      await ctx.runMutation(
        internal.demoSourceBootstrap.ensureGlobalRecords,
        {},
      );
    const config = providerConfig();
    if (!config.apiKey || !config.webhookUrl || !config.webhookBearer) {
      await ctx.runMutation(internal.firecrawl.recordMonitorFailure, {
        sourceTargetId: records.publicTargetId,
        error: "FIRECRAWL_NOT_CONFIGURED",
      });
      return { status: "unconfigured", error: "FIRECRAWL_NOT_CONFIGURED" };
    }

    try {
      const candidate: MonitorContext | null = await ctx.runQuery(
        internal.demoSourceBootstrap.getGlobalMonitorContext,
        {},
      );
      if (!candidate || candidate.url !== CONTROLLED_SOURCE_URL) {
        throw new Error("CONTROLLED_SOURCE_NOT_RUNNABLE");
      }
      const desired = desiredMonitor(candidate);
      const fingerprint = monitorConfigFingerprint(desired, false);
      let providerMonitorId = candidate.providerMonitorId;
      let providerTargetId: string | undefined;
      let status: "created" | "updated" | "unchanged" = "unchanged";
      if (!providerMonitorId) {
        const created = await firecrawl.createMonitor(ctx, desired);
        providerMonitorId = created.id;
        providerTargetId = created.targets[0]?.id;
        status = "created";
      } else {
        const current = await firecrawl.getMonitor(ctx, providerMonitorId);
        providerTargetId = current.targets[0]?.id;
        if (
          !monitorMatchesDesired(
            current,
            fingerprint,
            candidate.storedFingerprint,
            false,
            desired,
          )
        ) {
          const updated = await firecrawl.updateMonitor(
            ctx,
            providerMonitorId,
            {
              name: desired.name,
              status: "active",
              schedule: desired.schedule,
              webhook: desired.webhook,
              targets: desired.targets,
              retentionDays: desired.retentionDays,
              goal: desired.goal,
              judgeEnabled: desired.judgeEnabled,
            },
          );
          providerTargetId = updated.targets[0]?.id;
          status = "updated";
        }
      }
      await ctx.runMutation(internal.firecrawl.saveMonitorReconciliation, {
        sourceTargetId: candidate.sourceTargetId,
        providerMonitorId,
        providerTargetId,
        state: "active",
        configFingerprint: fingerprint,
      });
      return { status, providerMonitorId };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message.slice(0, 500)
          : "MONITOR_RECONCILIATION_FAILED";
      await ctx.runMutation(internal.firecrawl.recordMonitorFailure, {
        sourceTargetId: records.publicTargetId,
        error: message,
      });
      return { status: "failed", error: message };
    }
  },
});

/** Read-only provider-backed proof for operators and local demo diagnostics. */
export const proveGlobalMonitor = action({
  args: {},
  returns: v.object({
    providerConfigured: v.boolean(),
    registryReady: v.boolean(),
    providerReachable: v.boolean(),
    providerMonitorId: v.union(v.string(), v.null()),
    providerStatus: v.union(v.string(), v.null()),
    targetCount: v.number(),
    desiredCadenceMinutes: v.number(),
    desiredScheduleText: v.string(),
    storedConfigMatchesDesired: v.boolean(),
    lastCheckAt: v.union(v.number(), v.null()),
    lastCheckStatus: v.union(v.string(), v.null()),
    error: v.union(v.string(), v.null()),
  }),
  handler: async (ctx): Promise<GlobalMonitorProof> => {
    await requireActionOperator(ctx);
    const candidate: MonitorContext | null = await ctx.runQuery(
      internal.demoSourceBootstrap.getGlobalMonitorContext,
      {},
    );
    const config = providerConfig();
    const providerConfigured = Boolean(
      config.apiKey && config.webhookUrl && config.webhookBearer,
    );
    if (!candidate || !providerConfigured || !candidate.providerMonitorId) {
      return {
        providerConfigured,
        registryReady: Boolean(candidate),
        providerReachable: false,
        providerMonitorId: candidate?.providerMonitorId ?? null,
        providerStatus: null,
        targetCount: 0,
        desiredCadenceMinutes: CONTROLLED_SOURCE_SCHEDULE_MINUTES,
        desiredScheduleText: "daily",
        storedConfigMatchesDesired: false,
        lastCheckAt: null,
        lastCheckStatus: null,
        error: !candidate
          ? "CONTROLLED_SOURCE_NOT_BOOTSTRAPPED"
          : "FIRECRAWL_NOT_CONFIGURED",
      };
    }
    try {
      const desired = desiredMonitor(candidate);
      const fingerprint = monitorConfigFingerprint(desired, false);
      const monitor: NativeMonitor = await firecrawl.getMonitor(
        ctx,
        candidate.providerMonitorId,
      );
      const stored: StoredMonitorProof = await ctx.runQuery(
        internal.demoSourceBootstrap.getStoredMonitorProof,
        {
          sourceTargetId: candidate.sourceTargetId,
        },
      );
      return {
        providerConfigured: true,
        registryReady: true,
        providerReachable: true,
        providerMonitorId: monitor.id,
        providerStatus: monitor.status,
        targetCount: monitor.targets.length,
        desiredCadenceMinutes: CONTROLLED_SOURCE_SCHEDULE_MINUTES,
        desiredScheduleText: desired.schedule.text,
        storedConfigMatchesDesired: candidate.storedFingerprint === fingerprint,
        lastCheckAt: stored?.lastCheckAt ?? null,
        lastCheckStatus: stored?.lastCheckStatus ?? null,
        error: null,
      };
    } catch (error) {
      return {
        providerConfigured: true,
        registryReady: true,
        providerReachable: false,
        providerMonitorId: candidate.providerMonitorId,
        providerStatus: null,
        targetCount: 0,
        desiredCadenceMinutes: CONTROLLED_SOURCE_SCHEDULE_MINUTES,
        desiredScheduleText: "daily",
        storedConfigMatchesDesired: false,
        lastCheckAt: null,
        lastCheckStatus: null,
        error:
          error instanceof Error
            ? error.message.slice(0, 500)
            : "MONITOR_PROOF_FAILED",
      };
    }
  },
});
