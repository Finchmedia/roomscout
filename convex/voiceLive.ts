import { createTool, saveMessage } from "@convex-dev/agent";
import { ConvexError, v } from "convex/values";
import { z } from "zod";
import type { ToolSet } from "ai";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  action,
  env,
  httpAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { requireActionUserId, requireUserId } from "./integrations/authz";
import { setNeedStatus } from "./lib/needLifecycle";
import {
  getSavedNeedActivationReadiness,
  savedNeedActivationClarificationQuestion,
} from "./lib/savedNeedLocation";
import { activateNeed } from "./savedNeeds";
import { assertVoiceClaim, voiceNeedSnapshot } from "./lib/voiceClaim";
import {
  buildScoutTools,
  briefReadinessFor,
  createMarkSearchBriefReadyTool,
  createSearchDraftTool,
} from "./scout";
import { runScoutTurn, scoutAgent } from "./scoutRuntime";
import { liveInstructions, scoutVoiceInstructions, type ConversationLocale } from "./prompts/roomScoutLive";
import { voiceEndFarewell, type VoiceEndReason } from "./lib/voiceEndIntent";
import { buildLiveDiscoveryContext } from "./lib/liveDiscoveryContext";

const MAX_SESSION_MS = 15 * 60 * 1_000;
const MAX_REQUESTS_PER_SESSION = 64;
const MAX_RECENT_RESULTS = 8;
const MAX_FRAGMENTS = 1_024;
const MAX_FRAGMENT_CHARS = 2_000;
const MAX_PROMPT_CHARS = 64_000;
const MAX_REQUEST_ID_CHARS = 160;
const MAX_EVENT_ID_CHARS = 240;
const MAX_TRANSCRIPT_SEGMENT_CHARS = 8_000;
const MAX_TRANSCRIPT_SOURCE_EVENTS = 1_024;
const DEFAULT_MODEL = "gpt-live-1";
const DEFAULT_VOICE = "marin";

const localeValidator = v.union(v.literal("en"), v.literal("de"));
const activationMissingFieldValidator = v.union(v.literal("location"), v.literal("radiusKm"));
const sourceValidator = v.union(v.literal("voice"), v.literal("text"));
const sessionStatusValidator = v.union(
  v.literal("connecting"),
  v.literal("active"),
  v.literal("ended"),
  v.literal("error"),
);
const terminalStatusValidator = v.union(
  v.literal("completed"),
  v.literal("needs_clarification"),
  v.literal("superseded"),
  v.literal("failed"),
  v.literal("outcome_unknown"),
);
const delegateStatusValidator = v.union(
  v.literal("in_progress"),
  v.literal("busy"),
  terminalStatusValidator,
);
const fragmentValidator = v.object({
  eventId: v.string(),
  role: v.union(v.literal("user"), v.literal("assistant")),
  text: v.string(),
  startMs: v.number(),
  endMs: v.number(),
});
const delegateResultValidator = v.object({
  status: delegateStatusValidator,
  requestId: v.string(),
  resolvedEventIds: v.array(v.string()),
  delivery: v.optional(v.union(v.literal("silent"), v.literal("spoken"))),
  spokenSummary: v.optional(v.string()),
  locale: localeValidator,
  revision: v.optional(v.number()),
  promptMessageId: v.optional(v.string()),
  assistantMessageId: v.optional(v.string()),
  changedFields: v.optional(v.array(v.string())),
  verifiedFacts: v.optional(v.array(v.string())),
  endCall: v.optional(v.object({
    reason: v.union(v.literal("user_request"), v.literal("farewell")),
    farewell: v.string(),
  })),
});

type TerminalStatus = "completed" | "needs_clarification" | "superseded" | "failed" | "outcome_unknown";
type DelegateResult = {
  status: "in_progress" | "busy" | TerminalStatus;
  requestId: string;
  resolvedEventIds: string[];
  delivery?: "silent" | "spoken";
  spokenSummary?: string;
  locale: ConversationLocale;
  revision?: number;
  promptMessageId?: string;
  assistantMessageId?: string;
  changedFields?: string[];
  verifiedFacts?: string[];
  endCall?: { reason: VoiceEndReason; farewell: string };
};

type LiveEnvironment = {
  OPENAI_API_KEY: string;
  VOICE_PROVIDER?: "realtime" | "live";
  OPENAI_LIVE_MODEL?: string;
  OPENAI_LIVE_VOICE?: string;
  VOICE_ALLOWED_ORIGINS?: string;
};
const liveEnv = env as unknown as LiveEnvironment;

function configuredProvider(): "realtime" | "live" {
  return liveEnv.VOICE_PROVIDER === "live" ? "live" : "realtime";
}

export function hasMeaningfulSavedNeed(need: {
  locationQuery?: string;
  locationLabel?: string;
  city?: string;
  radiusKm?: number;
  maxBudgetEur?: number;
  arrangement: string[];
  schedule: string[];
  requirements: string[];
  openToSharing?: boolean;
  genres?: string[];
  instruments?: string[];
  collaborationOpen?: boolean;
  facets?: unknown[];
} | null): boolean {
  return Boolean(need && (
    need.locationQuery?.trim() ||
    need.locationLabel?.trim() ||
    need.city?.trim() ||
    need.radiusKm !== undefined ||
    need.maxBudgetEur !== undefined ||
    need.arrangement.length > 0 ||
    need.schedule.length > 0 ||
    need.requirements.length > 0 ||
    need.openToSharing !== undefined ||
    (need.genres?.length ?? 0) > 0 ||
    (need.instruments?.length ?? 0) > 0 ||
    need.collaborationOpen !== undefined ||
    (need.facets?.length ?? 0) > 0
  ));
}

export function captureFactsCapabilities(args: {
  mode: "search_discovery" | "signal_advisor" | "outreach_drafting";
  hasActiveNeed: boolean;
  needStatus?: "draft" | "active" | "paused" | "archived";
}) {
  const updateSearchDraft = args.hasActiveNeed &&
    (args.mode === "search_discovery" || args.mode === "signal_advisor");
  return {
    updateSearchDraft,
    markSearchBriefReady: updateSearchDraft &&
      args.mode === "search_discovery" &&
      args.needStatus === "draft",
  };
}

function cleanLocale(value: string | null | undefined): ConversationLocale | null {
  return value === "en" || value === "de" ? value : null;
}

function allowedOrigin(request: Request): string | null {
  const origin = request.headers.get("Origin");
  if (!origin) return null;
  const configured = (liveEnv.VOICE_ALLOWED_ORIGINS ?? process.env.REALTIME_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return ["http://localhost:5173", "http://127.0.0.1:5173", ...configured].includes(origin)
    ? origin
    : null;
}

function corsHeaders(origin: string | null): Record<string, string> {
  return origin
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers": "Authorization, Content-Type, X-RoomScout-Conversation-Locale",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Expose-Headers": "X-RoomScout-Voice-Session, X-RoomScout-Voice-Provider",
        Vary: "Origin",
      }
    : {};
}

function errorResponse(origin: string | null, status: number, message: string): Response {
  return Response.json({ error: message }, { status, headers: corsHeaders(origin) });
}

export const getConfig = query({
  args: {},
  returns: v.object({ locale: localeValidator }),
  handler: async (ctx) => {
    const ownerId = await requireUserId(ctx);
    const user = await ctx.db.get(ownerId);
    if (!user) throw new ConvexError({ code: "USER_NOT_FOUND" });
    return { locale: user.conversationLocale ?? "en" };
  },
});

export const setLanguage = mutation({
  args: { locale: localeValidator, voiceSessionId: v.optional(v.id("voiceSessions")) },
  returns: v.object({ locale: localeValidator, languageRevision: v.number() }),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const user = await ctx.db.get(ownerId);
    if (!user) throw new ConvexError({ code: "USER_NOT_FOUND" });
    await ctx.db.patch(ownerId, { conversationLocale: args.locale });
    if (!args.voiceSessionId) return { locale: args.locale, languageRevision: 0 };
    const session = await ctx.db.get(args.voiceSessionId);
    if (!session || session.ownerId !== ownerId) {
      throw new ConvexError({ code: "VOICE_SESSION_NOT_FOUND" });
    }
    const languageRevision = (session.languageRevision ?? 0) + 1;
    await ctx.db.patch(session._id, {
      conversationLocale: args.locale,
      languageRevision,
      updatedAt: Date.now(),
    });
    return { locale: args.locale, languageRevision };
  },
});

export const recordTranscriptSegment = mutation({
  args: {
    voiceSessionId: v.id("voiceSessions"),
    segmentId: v.string(),
    revision: v.number(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    transcript: v.string(),
    sourceEventIds: v.array(v.string()),
    startMs: v.number(),
    endMs: v.number(),
  },
  returns: v.object({
    status: v.union(
      v.literal("created"),
      v.literal("updated"),
      v.literal("unchanged"),
      v.literal("stale"),
    ),
    messageId: v.string(),
  }),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const session = await ctx.db.get(args.voiceSessionId);
    if (!session || session.ownerId !== ownerId || session.provider !== "live") {
      throw new ConvexError({ code: "VOICE_SESSION_NOT_FOUND" });
    }
    const transcript = args.transcript.trim();
    const uniqueSourceIds = [...new Set(args.sourceEventIds)];
    if (
      !args.segmentId.trim() ||
      args.segmentId.length > MAX_EVENT_ID_CHARS ||
      !Number.isSafeInteger(args.revision) ||
      args.revision < 1 ||
      !transcript ||
      transcript.length > MAX_TRANSCRIPT_SEGMENT_CHARS ||
      uniqueSourceIds.length !== args.sourceEventIds.length ||
      uniqueSourceIds.length < 1 ||
      uniqueSourceIds.length > MAX_TRANSCRIPT_SOURCE_EVENTS ||
      uniqueSourceIds.some((eventId) => !eventId || eventId.length > MAX_EVENT_ID_CHARS) ||
      !Number.isFinite(args.startMs) ||
      !Number.isFinite(args.endMs) ||
      args.startMs < 0 ||
      args.endMs < args.startMs
    ) {
      throw new ConvexError({ code: "INVALID_VOICE_TRANSCRIPT_SEGMENT" });
    }
    const existing = await ctx.db
      .query("voiceTranscriptEvents")
      .withIndex("by_voice_session_and_provider_event_id", (q) =>
        q.eq("voiceSessionId", args.voiceSessionId).eq("providerEventId", args.segmentId))
      .unique();
    if (existing) {
      if (existing.ownerId !== ownerId || existing.role !== args.role || !existing.agentMessageId) {
        throw new ConvexError({ code: "VOICE_TRANSCRIPT_SEGMENT_CONFLICT" });
      }
      const existingRevision = existing.segmentRevision ?? 1;
      if (args.revision < existingRevision) {
        return { status: "stale" as const, messageId: existing.agentMessageId };
      }
      const unchanged = args.revision === existingRevision &&
        existing.transcript === transcript &&
        existing.startMs === args.startMs &&
        existing.endMs === args.endMs &&
        JSON.stringify(existing.sourceEventIds ?? []) === JSON.stringify(uniqueSourceIds);
      if (unchanged) {
        return { status: "unchanged" as const, messageId: existing.agentMessageId };
      }
      if (args.revision === existingRevision) {
        return { status: "stale" as const, messageId: existing.agentMessageId };
      }
      await scoutAgent.updateMessage(ctx, {
        messageId: existing.agentMessageId,
        patch: {
          message: { role: args.role, content: transcript },
          status: "success",
        },
      });
      await ctx.db.patch(existing._id, {
        transcript,
        sourceEventIds: uniqueSourceIds,
        segmentRevision: args.revision,
        startMs: args.startMs,
        endMs: args.endMs,
        finalizedAt: Date.now(),
      });
      return { status: "updated" as const, messageId: existing.agentMessageId };
    }
    const saved = await saveMessage(ctx, components.agent, {
      threadId: session.threadId,
      userId: ownerId,
      message: { role: args.role, content: transcript },
      agentName: "RoomScout Live Transcript",
    });
    await ctx.db.insert("voiceTranscriptEvents", {
      ownerId,
      voiceSessionId: args.voiceSessionId,
      providerEventId: args.segmentId,
      role: args.role,
      transcript,
      sourceEventIds: uniqueSourceIds,
      segmentRevision: args.revision,
      startMs: args.startMs,
      endMs: args.endMs,
      agentMessageId: saved.messageId,
      finalizedAt: Date.now(),
    });
    return { status: "created" as const, messageId: saved.messageId };
  },
});

export const setLanguageFromClaim = internalMutation({
  args: {
    ownerId: v.id("users"),
    voiceSessionId: v.id("voiceSessions"),
    requestId: v.string(),
    generation: v.number(),
    locale: localeValidator,
  },
  returns: v.object({ locale: localeValidator, languageRevision: v.number() }),
  handler: async (ctx, args) => {
    const { session } = await assertVoiceClaim(ctx, args.ownerId, {
      voiceSessionId: args.voiceSessionId,
      requestId: args.requestId,
      generation: args.generation,
    });
    const languageRevision = (session.languageRevision ?? 0) + 1;
    await Promise.all([
      ctx.db.patch(args.ownerId, { conversationLocale: args.locale }),
      ctx.db.patch(session._id, {
        conversationLocale: args.locale,
        languageRevision,
        updatedAt: Date.now(),
      }),
    ]);
    return { locale: args.locale, languageRevision };
  },
});

export const getSessionBootstrap = internalQuery({
  args: { ownerId: v.id("users") },
  returns: v.union(v.object({
    threadId: v.string(),
    activeNeedId: v.optional(v.id("savedNeeds")),
    focusedSignalId: v.optional(v.id("signals")),
    discoveryContext: v.string(),
    discovery: v.boolean(),
    locale: localeValidator,
    hasPriorContext: v.boolean(),
  }), v.null()),
  handler: async (ctx, args) => {
    const [user, context] = await Promise.all([
      ctx.db.get(args.ownerId),
      ctx.db.query("scoutContexts").withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId)).unique(),
    ]);
    if (!user || !context) return null;
    const [loadedNeed, priorVoiceTranscript] = await Promise.all([
      context.activeNeedId ? ctx.db.get(context.activeNeedId) : null,
      ctx.db.query("voiceTranscriptEvents")
        .withIndex("by_owner_and_finalized_at", (q) => q.eq("ownerId", args.ownerId))
        .order("desc")
        .first(),
    ]);
    const need = loadedNeed?.ownerId === args.ownerId ? loadedNeed : null;
    const hasMeaningfulNeed = hasMeaningfulSavedNeed(need);
    const discoveryContext = buildLiveDiscoveryContext({
      need,
      mode: context.mode,
      briefReadiness: briefReadinessFor(need, context),
    });
    return {
      threadId: context.threadId,
      activeNeedId: context.activeNeedId,
      focusedSignalId: context.focusedSignalId,
      discoveryContext: JSON.stringify(discoveryContext),
      discovery: discoveryContext.discovery,
      locale: user.conversationLocale ?? "en",
      hasPriorContext: hasMeaningfulNeed || priorVoiceTranscript !== null,
    };
  },
});

export const openLiveSession = internalMutation({
  args: {
    ownerId: v.id("users"),
    threadId: v.string(),
    model: v.string(),
    voice: v.string(),
    locale: localeValidator,
    providerSessionId: v.string(),
    activeNeedId: v.optional(v.id("savedNeeds")),
    focusedSignalId: v.optional(v.id("signals")),
  },
  returns: v.id("voiceSessions"),
  handler: async (ctx, args): Promise<Id<"voiceSessions">> => {
    const context = await ctx.db.query("scoutContexts")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId)).unique();
    if (!context || context.ownerId !== args.ownerId || context.activeNeedId !== args.activeNeedId) {
      throw new ConvexError({ code: "VOICE_CONTEXT_CHANGED" });
    }
    await ctx.db.patch(args.ownerId, { conversationLocale: args.locale });
    const now = Date.now();
    const voiceSessionId = await ctx.db.insert("voiceSessions", {
      ownerId: args.ownerId,
      threadId: args.threadId,
      model: args.model,
      voice: args.voice,
      provider: "live",
      providerSessionId: args.providerSessionId,
      conversationLocale: args.locale,
      languageRevision: 0,
      claimGeneration: 0,
      requestTombstones: [],
      recentResults: [],
      status: "active",
      activeNeedId: args.activeNeedId,
      focusedSignalId: args.focusedSignalId,
      startedAt: now,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(MAX_SESSION_MS, internal.voice.expireSession, { voiceSessionId });
    return voiceSessionId;
  },
});

export const optionsHttp = httpAction(async (_ctx, request) => {
  const origin = allowedOrigin(request);
  if (request.headers.get("Origin") && !origin) return new Response("Origin not allowed", { status: 403 });
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
});

export const sessionHttp = httpAction(async (ctx, request) => {
  const origin = allowedOrigin(request);
  if (request.headers.get("Origin") && !origin) return new Response("Origin not allowed", { status: 403 });
  if (configuredProvider() !== "live") return errorResponse(origin, 409, "Live voice is not enabled");
  let ownerId: Id<"users">;
  try {
    ownerId = await requireActionUserId(ctx);
  } catch {
    return errorResponse(origin, 401, "Authentication required");
  }
  const contentType = request.headers.get("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/sdp") return errorResponse(origin, 415, "Expected application/sdp");
  const offer = await request.text();
  if (!offer.trim() || offer.length > 100_000) return errorResponse(origin, 400, "Invalid SDP offer");
  const bootstrap = await ctx.runQuery(internal.voiceLive.getSessionBootstrap, { ownerId });
  if (!bootstrap) return errorResponse(origin, 409, "Scout context required");
  const url = new URL(request.url);
  const requestedLocale = cleanLocale(url.searchParams.get("locale")) ??
    cleanLocale(request.headers.get("X-RoomScout-Conversation-Locale"));
  const locale = requestedLocale ?? bootstrap.locale;
  const model = liveEnv.OPENAI_LIVE_MODEL?.trim() || DEFAULT_MODEL;
  const voice = liveEnv.OPENAI_LIVE_VOICE?.trim() || DEFAULT_VOICE;
  let providerResponse: Response;
  try {
    providerResponse = await fetch("https://api.openai.com/v1/live/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${liveEnv.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session: {
          model,
          audio: { output: { voice } },
          client: {
            data_channel: {
              allowed_client_events: [
                "session.input_audio.mute",
                "session.input_audio.unmute",
                "session.commentary.append",
                "session.thinking.append",
                "session.instructions.append",
                "session.close",
              ],
              allowed_server_events: [
                { type: "session.started" },
                { type: "session.input_audio.muted" },
                { type: "session.input_audio.unmuted" },
                { type: "session.input_transcript.delta" },
                { type: "session.output_transcript.delta" },
                { type: "session.delegation.created" },
                { type: "session.commentary.appended" },
                { type: "session.thinking.appended" },
                { type: "session.instructions.appended" },
                { type: "session.usage.updated" },
                { type: "session.closed" },
                { type: "error" },
                { type: "info" },
              ],
            },
          },
          delegation: { type: "client" },
          instructions: liveInstructions(locale, bootstrap.discoveryContext, {
            hasPriorContext: bootstrap.hasPriorContext,
            discovery: bootstrap.discovery,
          }),
          store: false,
        },
        transport: { type: "webrtc", sdp: offer },
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    console.error("LIVE_SESSION_CREATE_FAILED", error instanceof Error ? error.message : String(error));
    return errorResponse(origin, 502, "Voice provider unavailable");
  }
  if (!providerResponse.ok) {
    const detail = (await providerResponse.text()).slice(0, 1_000);
    console.error("LIVE_SESSION_CREATE_REJECTED", { status: providerResponse.status, detail });
    return errorResponse(origin, 502, "Voice provider rejected the session");
  }
  let created: { session?: { id?: string }; transport?: { type?: string; sdp?: string } };
  try {
    created = await providerResponse.json();
  } catch {
    return errorResponse(origin, 502, "Invalid voice provider response");
  }
  if (!created.session?.id || created.transport?.type !== "webrtc" || !created.transport.sdp) {
    return errorResponse(origin, 502, "Incomplete voice provider response");
  }
  let voiceSessionId: Id<"voiceSessions">;
  try {
    voiceSessionId = await ctx.runMutation(internal.voiceLive.openLiveSession, {
      ownerId,
      threadId: bootstrap.threadId,
      model,
      voice,
      locale,
      providerSessionId: created.session.id,
      activeNeedId: bootstrap.activeNeedId,
      focusedSignalId: bootstrap.focusedSignalId,
    });
  } catch (error) {
    console.error("LIVE_SESSION_RECORD_FAILED", error instanceof Error ? error.message : String(error));
    return errorResponse(origin, 409, "Scout context changed; reconnect voice");
  }
  return new Response(created.transport.sdp, {
    status: 200,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/sdp",
      "X-RoomScout-Voice-Session": voiceSessionId,
      "X-RoomScout-Voice-Provider": "live",
    },
  });
});

export const claimRequest = internalMutation({
  args: {
    ownerId: v.id("users"),
    voiceSessionId: v.id("voiceSessions"),
    requestId: v.string(),
    fingerprint: v.string(),
    source: sourceValidator,
    intent: v.optional(v.literal("capture_facts")),
    delegationId: v.optional(v.string()),
    transcriptSegmentId: v.optional(v.string()),
    eventIds: v.array(v.string()),
    prompt: v.string(),
    focusedSignalId: v.optional(v.id("signals")),
    decisionId: v.optional(v.id("decisions")),
  },
  returns: v.union(
    v.object({ kind: v.literal("accepted"), generation: v.number(), promptMessageId: v.optional(v.string()), locale: localeValidator, activeNeedId: v.optional(v.id("savedNeeds")), needRevision: v.optional(v.number()) }),
    v.object({ kind: v.literal("result"), result: delegateResultValidator }),
  ),
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.voiceSessionId);
    if (!session || session.ownerId !== args.ownerId || session.provider !== "live") {
      throw new ConvexError({ code: "VOICE_SESSION_NOT_FOUND" });
    }
    const locale = session.conversationLocale ?? "en";
    const tombstones = session.requestTombstones ?? [];
    if (session.activeClaim) {
      const sameRequest = session.activeClaim.requestId === args.requestId;
      return {
        kind: "result" as const,
        result: {
          status: sameRequest && session.activeClaim.fingerprint === args.fingerprint
            ? "in_progress" as const
            : sameRequest
              ? "outcome_unknown" as const
              : "busy" as const,
          requestId: args.requestId,
          resolvedEventIds: [],
          locale,
          ...(sameRequest && session.activeClaim.promptMessageId ? { promptMessageId: session.activeClaim.promptMessageId } : {}),
        },
      };
    }
    const known = tombstones.find((entry) => entry.requestId === args.requestId);
    if (known) {
      if (known.fingerprint !== args.fingerprint) {
        return { kind: "result" as const, result: { status: "outcome_unknown" as const, requestId: args.requestId, resolvedEventIds: [], locale, ...(known.promptMessageId ? { promptMessageId: known.promptMessageId } : {}) } };
      }
      const cached = (session.recentResults ?? []).find((entry) => entry.requestId === args.requestId);
      if (cached) {
        return {
          kind: "result" as const,
          result: {
            status: cached.status,
            requestId: cached.requestId,
            resolvedEventIds: cached.resolvedEventIds,
            delivery: cached.delivery,
            spokenSummary: cached.spokenSummary,
            locale: cached.locale,
            revision: cached.revision,
            promptMessageId: cached.promptMessageId,
            assistantMessageId: cached.assistantMessageId,
            changedFields: cached.changedFields,
            verifiedFacts: cached.verifiedFacts,
            endCall: cached.endCall,
          },
        };
      }
      return { kind: "result" as const, result: { status: "outcome_unknown" as const, requestId: args.requestId, resolvedEventIds: [], locale, ...(known.promptMessageId ? { promptMessageId: known.promptMessageId } : {}) } };
    }
    if (session.status !== "active") {
      return { kind: "result" as const, result: { status: "failed" as const, requestId: args.requestId, resolvedEventIds: [], locale } };
    }
    if (tombstones.length >= MAX_REQUESTS_PER_SESSION) {
      return { kind: "result" as const, result: { status: "failed" as const, requestId: args.requestId, resolvedEventIds: [], locale, spokenSummary: locale === "de" ? "Bitte starte das Gespräch neu." : "Please restart the conversation." } };
    }
    const context = await ctx.db.query("scoutContexts").withIndex("by_thread_id", (q) => q.eq("threadId", session.threadId)).unique();
    if (!context || context.ownerId !== args.ownerId || context.activeNeedId !== session.activeNeedId) {
      return { kind: "result" as const, result: { status: "superseded" as const, requestId: args.requestId, resolvedEventIds: [], locale } };
    }
    if (context.focusedSignalId !== session.focusedSignalId ||
      (args.focusedSignalId !== undefined && args.focusedSignalId !== session.focusedSignalId)) {
      return { kind: "result" as const, result: { status: "superseded" as const, requestId: args.requestId, resolvedEventIds: [], locale } };
    }
    let decisionUpdatedAt: number | undefined;
    if (args.decisionId !== undefined) {
      const decision = await ctx.db.get(args.decisionId);
      if (!decision || decision.ownerId !== args.ownerId || decision.status !== "open") {
        return { kind: "result" as const, result: { status: "superseded" as const, requestId: args.requestId, resolvedEventIds: [], locale } };
      }
      decisionUpdatedAt = decision.updatedAt;
    }
    const need = context.activeNeedId ? await ctx.db.get(context.activeNeedId) : null;
    const transcriptSegment = args.transcriptSegmentId
      ? await ctx.db
          .query("voiceTranscriptEvents")
          .withIndex("by_voice_session_and_provider_event_id", (q) =>
            q.eq("voiceSessionId", args.voiceSessionId).eq("providerEventId", args.transcriptSegmentId!))
          .unique()
      : null;
    if (args.transcriptSegmentId && (
      !transcriptSegment ||
      transcriptSegment.ownerId !== args.ownerId ||
      transcriptSegment.role !== "user" ||
      !transcriptSegment.agentMessageId
    )) {
      throw new ConvexError({ code: "VOICE_TRANSCRIPT_SEGMENT_NOT_FOUND" });
    }
    const messageId = args.intent === "capture_facts"
      ? undefined
      : transcriptSegment?.agentMessageId
        ? transcriptSegment.agentMessageId
      : (await saveMessage(ctx, components.agent, {
          threadId: session.threadId,
          userId: args.ownerId,
          prompt: args.prompt,
        })).messageId;
    const generation = (session.claimGeneration ?? 0) + 1;
    const now = Date.now();
    await ctx.db.patch(session._id, {
      claimGeneration: generation,
      activeClaim: {
        requestId: args.requestId,
        fingerprint: args.fingerprint,
        generation,
        source: args.source,
        intent: args.intent,
        delegationId: args.delegationId,
        eventIds: args.eventIds,
        promptMessageId: messageId,
        focusedSignalId: args.focusedSignalId,
        decisionId: args.decisionId,
        decisionUpdatedAt,
        needRevision: need?.matchingRevision ?? 0,
        needSnapshotJson: need ? voiceNeedSnapshot(need) : undefined,
        startedAt: now,
      },
      requestTombstones: [...tombstones, {
        requestId: args.requestId,
        fingerprint: args.fingerprint,
        ...(messageId ? { promptMessageId: messageId } : {}),
        acceptedAt: now,
      }],
      updatedAt: now,
    });
    return { kind: "accepted" as const, generation, promptMessageId: messageId, locale, activeNeedId: context.activeNeedId, needRevision: need?.matchingRevision ?? 0 };
  },
});

export const finishRequest = internalMutation({
  args: {
    ownerId: v.id("users"),
    voiceSessionId: v.id("voiceSessions"),
    requestId: v.string(),
    generation: v.number(),
    expectedLocale: localeValidator,
    result: delegateResultValidator,
  },
  returns: delegateResultValidator,
  handler: async (ctx, args): Promise<DelegateResult> => {
    const session = await ctx.db.get(args.voiceSessionId);
    const claim = session?.activeClaim;
    if (!session || session.ownerId !== args.ownerId || !claim || claim.requestId !== args.requestId || claim.generation !== args.generation) {
      return { status: "superseded", requestId: args.requestId, resolvedEventIds: [], locale: session?.conversationLocale ?? args.expectedLocale };
    }
    const locale = session.conversationLocale ?? "en";
    const languageChangedByClaim = args.result.changedFields?.includes("conversationLocale") ?? false;
    const staleLanguage = locale !== args.expectedLocale && !languageChangedByClaim;
    const context = await ctx.db.query("scoutContexts")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId)).unique();
    const staleTarget = !context || context.activeNeedId !== session.activeNeedId ||
      context.focusedSignalId !== session.focusedSignalId ||
      (claim.focusedSignalId !== undefined && context.focusedSignalId !== claim.focusedSignalId);
    if (args.result.status === "in_progress" || args.result.status === "busy") {
      throw new ConvexError({ code: "VOICE_RESULT_NOT_TERMINAL" });
    }
    let result: DelegateResult & { status: TerminalStatus } = {
      ...args.result,
      status: args.result.status,
      locale,
      ...(staleLanguage || staleTarget
        ? { status: "superseded", delivery: "silent", spokenSummary: undefined, endCall: undefined }
        : {}),
    };
    // Spoken Live output is persisted from the provider transcript, which is
    // the actual conversation. Only a silent typed turn needs an invisible
    // completion marker so the text composer does not remain pending.
    const assistantCompletion = result.delivery === "silent" &&
      result.status === "completed" &&
      claim.source === "text" &&
      claim.promptMessageId
      ? ""
      : undefined;
    if (assistantCompletion !== undefined && !result.assistantMessageId) {
      const saved = await scoutAgent.saveMessage(ctx, {
        threadId: session.threadId,
        userId: args.ownerId,
        message: { role: "assistant", content: assistantCompletion },
        ...(claim.promptMessageId ? { promptMessageId: claim.promptMessageId } : {}),
        skipEmbeddings: true,
      });
      result = { ...result, assistantMessageId: saved.messageId };
    }
    const stored = { ...result, completedAt: Date.now() };
    const recentResults = [...(session.recentResults ?? []).filter((entry) => entry.requestId !== args.requestId), stored]
      .slice(-MAX_RECENT_RESULTS);
    await ctx.db.patch(session._id, { activeClaim: undefined, recentResults, updatedAt: Date.now() });
    return result;
  },
});

export const changeNeedStatus = internalMutation({
  args: {
    ownerId: v.id("users"),
    voiceSessionId: v.id("voiceSessions"),
    requestId: v.string(),
    generation: v.number(),
    action: v.union(v.literal("start"), v.literal("pause")),
  },
  returns: v.object({
    status: v.union(v.literal("active"), v.literal("paused"), v.literal("needs_clarification")),
    revision: v.number(),
    changed: v.boolean(),
    missingFields: v.array(activationMissingFieldValidator),
    clarificationQuestion: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const { session, context } = await assertVoiceClaim(ctx, args.ownerId, {
      voiceSessionId: args.voiceSessionId,
      requestId: args.requestId,
      generation: args.generation,
    });
    if (!context.activeNeedId || context.activeNeedId !== session.activeNeedId) {
      throw new ConvexError({ code: "VOICE_TARGET_SUPERSEDED" });
    }
    const need = await ctx.db.get(context.activeNeedId);
    if (!need || need.ownerId !== args.ownerId || need.status === "archived") {
      throw new ConvexError({ code: "NEED_NOT_FOUND" });
    }
    const status = args.action === "start" ? "active" as const : "paused" as const;
    if (status === "active") {
      const activation = getSavedNeedActivationReadiness(need);
      if (!activation.canActivate) {
        return {
          status: "needs_clarification" as const,
          revision: need.matchingRevision ?? 0,
          changed: false,
          missingFields: activation.missingFields,
          clarificationQuestion: savedNeedActivationClarificationQuestion(
            session.conversationLocale === "de" ? "de" : "en",
            need,
            activation.missingFields,
          ),
        };
      }
      await activateNeed(ctx, args.ownerId, need);
    } else {
      await setNeedStatus(ctx, need, status);
    }
    return {
      status,
      revision: need.status === status ? (need.matchingRevision ?? 0) : (need.matchingRevision ?? 0) + 1,
      changed: need.status !== status,
      missingFields: [],
    };
  },
});

export const getSessionState = query({
  args: { voiceSessionId: v.id("voiceSessions") },
  returns: v.object({
    voiceSessionId: v.id("voiceSessions"),
    status: sessionStatusValidator,
    locale: localeValidator,
    languageRevision: v.number(),
    activeRequest: v.optional(v.object({ requestId: v.string(), source: sourceValidator, startedAt: v.number() })),
    lastResult: v.optional(delegateResultValidator),
    current: v.object({
      activeNeedId: v.optional(v.id("savedNeeds")),
      needRevision: v.optional(v.number()),
      needStatus: v.optional(v.union(v.literal("draft"), v.literal("active"), v.literal("paused"), v.literal("archived"))),
      focusedSignalId: v.optional(v.id("signals")),
      decisionId: v.optional(v.id("decisions")),
      decisionStatus: v.optional(v.union(v.literal("open"), v.literal("answered"), v.literal("superseded"))),
    }),
  }),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const session = await ctx.db.get(args.voiceSessionId);
    if (!session || session.ownerId !== ownerId) throw new ConvexError({ code: "VOICE_SESSION_NOT_FOUND" });
    const [context, need, decision] = await Promise.all([
      ctx.db.query("scoutContexts").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).unique(),
      session.activeNeedId ? ctx.db.get(session.activeNeedId) : null,
      ctx.db.query("decisions").withIndex("by_owner_and_status", (q) => q.eq("ownerId", ownerId).eq("status", "open")).order("desc").first(),
    ]);
    const cached = session.recentResults?.at(-1);
    const lastResult = cached ? {
      status: cached.status,
      requestId: cached.requestId,
      resolvedEventIds: cached.resolvedEventIds,
      delivery: cached.delivery,
      spokenSummary: cached.spokenSummary,
      locale: cached.locale,
      revision: cached.revision,
      promptMessageId: cached.promptMessageId,
      assistantMessageId: cached.assistantMessageId,
      changedFields: cached.changedFields,
      verifiedFacts: cached.verifiedFacts,
      endCall: cached.endCall,
    } : undefined;
    return {
      voiceSessionId: session._id,
      status: session.status,
      locale: session.conversationLocale ?? "en",
      languageRevision: session.languageRevision ?? 0,
      activeRequest: session.activeClaim ? { requestId: session.activeClaim.requestId, source: session.activeClaim.source, startedAt: session.activeClaim.startedAt } : undefined,
      lastResult,
      current: {
        activeNeedId: context?.activeNeedId,
        needRevision: need?.matchingRevision ?? 0,
        needStatus: need?.status,
        focusedSignalId: context?.focusedSignalId,
        decisionId: decision?._id,
        decisionStatus: decision?.status,
      },
    };
  },
});

function normalizeText(value: string): string {
  return value.replace(/[^\S\n]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function composeVoiceInput(args: {
  source: "voice" | "text";
  fragments: Array<{ role: "user" | "assistant"; text: string }>;
  text?: string;
  locale: ConversationLocale;
}): { userPrompt: string; assistantContext: string } {
  const segments: Array<{ role: "user" | "assistant"; text: string }> = [];
  for (const fragment of args.fragments) {
    const previous = segments.at(-1);
    if (previous?.role === fragment.role) previous.text += fragment.text;
    else segments.push({ role: fragment.role, text: fragment.text });
  }
  const user = segments.filter((item) => item.role === "user").map((item) => item.text.trim()).filter(Boolean);
  const assistant = segments.filter((item) => item.role === "assistant").map((item) => item.text.trim()).filter(Boolean);
  const explicit = args.text ? normalizeText(args.text) : "";
  return {
    userPrompt: [...user, explicit].filter(Boolean).join("\n"),
    assistantContext: assistant.join("\n"),
  };
}

async function fingerprint(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function shortSummary(text: string): string | undefined {
  const normalized = normalizeText(text);
  if (!normalized) return undefined;
  const encoder = new TextEncoder();
  if (encoder.encode(normalized).length <= 440) return normalized;
  let result = "";
  for (const char of normalized) {
    if (encoder.encode(result + char + "…").length > 440) break;
    result += char;
  }
  return `${result.trimEnd()}…`;
}

type VoiceSemanticResult = {
  delivery: "silent" | "spoken";
  responseKind: "routine_update" | "answer" | "clarification" | "action_result" | "decision_result";
  spokenSummary: string;
};

export function resolveLiveDelivery(args: {
  semantic: VoiceSemanticResult;
  captureFacts: boolean;
  hasEndCall: boolean;
  requiresSpoken: boolean;
  requiresClarification: boolean;
  searchStatus?: {
    locale: ConversationLocale;
    action: "start" | "pause";
    result: {
      status: "active" | "paused" | "needs_clarification";
      changed: boolean;
      clarificationQuestion?: string;
    };
  };
}): Pick<DelegateResult, "delivery" | "spokenSummary"> & { status: "completed" | "needs_clarification" } {
  if (args.captureFacts) {
    return { delivery: "silent", status: "completed" };
  }
  if (args.searchStatus) {
    const { locale, result } = args.searchStatus;
    if (result.status === "needs_clarification") {
      return {
        delivery: "spoken",
        status: "needs_clarification",
        spokenSummary: result.clarificationQuestion ?? (locale === "de"
          ? "Ich brauche noch eine Pflichtangabe, bevor ich die Suche starten kann."
          : "I still need one required detail before I can start the search."),
      };
    }
    const spokenSummary = locale === "de"
      ? result.status === "active"
        ? result.changed ? "Die Suche läuft jetzt." : "Die Suche läuft bereits."
        : result.changed ? "Die Suche ist jetzt pausiert." : "Die Suche ist bereits pausiert."
      : result.status === "active"
        ? result.changed ? "The search is now active." : "The search is already active."
        : result.changed ? "The search is now paused." : "The search is already paused.";
    return { delivery: "spoken", status: "completed", spokenSummary };
  }
  const semanticSummary = shortSummary(args.semantic.spokenSummary);
  // The separately validated farewell is already a complete client-facing
  // response. Auxiliary effects must not turn a clean hangup into a failure.
  if (args.hasEndCall && !semanticSummary) {
    return { delivery: "silent", status: "completed" };
  }
  const delivery = args.requiresSpoken ? "spoken" : args.semantic.delivery;
  const status = args.requiresClarification || args.semantic.responseKind === "clarification"
    ? "needs_clarification" as const
    : "completed" as const;
  const spokenSummary = delivery === "spoken" ? semanticSummary : undefined;
  if (delivery === "spoken" && !spokenSummary) {
    throw new Error("VOICE_SPOKEN_SUMMARY_REQUIRED");
  }
  return { delivery, status, ...(spokenSummary ? { spokenSummary } : {}) };
}

export const delegate = action({
  args: {
    voiceSessionId: v.id("voiceSessions"),
    requestId: v.string(),
    delegationId: v.optional(v.string()),
    source: sourceValidator,
    intent: v.optional(v.literal("capture_facts")),
    fragments: v.array(fragmentValidator),
    text: v.optional(v.string()),
    transcriptSegmentId: v.optional(v.string()),
    focusedSignalId: v.optional(v.id("signals")),
    decisionId: v.optional(v.id("decisions")),
  },
  returns: delegateResultValidator,
  handler: async (ctx, args): Promise<DelegateResult> => {
    const ownerId = await requireActionUserId(ctx);
    const requestId = args.requestId.trim();
    if (
      !requestId ||
      requestId.length > MAX_REQUEST_ID_CHARS ||
      args.fragments.length > MAX_FRAGMENTS ||
      (args.transcriptSegmentId !== undefined &&
        (!args.transcriptSegmentId || args.transcriptSegmentId.length > MAX_EVENT_ID_CHARS))
    ) {
      throw new ConvexError({ code: "INVALID_VOICE_REQUEST" });
    }
    const seen = new Set<string>();
    let inputChars = args.text?.length ?? 0;
    for (const fragment of args.fragments) {
      if (!fragment.eventId || fragment.eventId.length > MAX_EVENT_ID_CHARS || seen.has(fragment.eventId) || fragment.text.length > MAX_FRAGMENT_CHARS || !Number.isFinite(fragment.startMs) || !Number.isFinite(fragment.endMs) || fragment.endMs < fragment.startMs) {
        throw new ConvexError({ code: "INVALID_VOICE_FRAGMENT" });
      }
      seen.add(fragment.eventId);
      inputChars += fragment.text.length;
    }
    if (inputChars > MAX_PROMPT_CHARS) throw new ConvexError({ code: "VOICE_INPUT_TOO_LARGE" });
    if (args.text !== undefined && (!normalizeText(args.text) || args.text.length > MAX_PROMPT_CHARS)) {
      throw new ConvexError({ code: "INVALID_VOICE_TEXT" });
    }
    if (!args.text && !args.fragments.some((fragment) => fragment.role === "user" && normalizeText(fragment.text))) {
      throw new ConvexError({ code: "VOICE_USER_INPUT_REQUIRED" });
    }
    const state = await ctx.runQuery(internal.voiceLive.getOwnedSessionForDelegate, { ownerId, voiceSessionId: args.voiceSessionId });
    if (!state) throw new ConvexError({ code: "VOICE_SESSION_NOT_FOUND" });
    const { userPrompt, assistantContext } = composeVoiceInput({ source: args.source, fragments: args.fragments, text: args.text, locale: state.locale });
    const inputFingerprint = await fingerprint({ intent: args.intent ?? null, source: args.source, delegationId: args.delegationId ?? null, transcriptSegmentId: args.transcriptSegmentId ?? null, fragments: args.fragments, text: args.text ?? null, focusedSignalId: args.focusedSignalId ?? null, decisionId: args.decisionId ?? null });
    const claimed = await ctx.runMutation(internal.voiceLive.claimRequest, {
      ownerId,
      voiceSessionId: args.voiceSessionId,
      requestId,
      fingerprint: inputFingerprint,
      source: args.source,
      intent: args.intent,
      delegationId: args.delegationId,
      transcriptSegmentId: args.transcriptSegmentId,
      eventIds: args.fragments.map((fragment) => fragment.eventId),
      prompt: userPrompt,
      focusedSignalId: args.focusedSignalId,
      decisionId: args.decisionId,
    });
    if (claimed.kind === "result") return claimed.result;

    const context = await ctx.runQuery(internal.scout.getActionContext, { ownerId, threadId: state.threadId });
    if (!context || context.activeNeedId !== claimed.activeNeedId) {
      return await ctx.runMutation(internal.voiceLive.finishRequest, {
        ownerId, voiceSessionId: args.voiceSessionId, requestId, generation: claimed.generation, expectedLocale: claimed.locale,
        result: { status: "superseded", requestId, resolvedEventIds: [], locale: claimed.locale, promptMessageId: claimed.promptMessageId },
      });
    }
    const changedFields = new Set<string>();
    const verifiedFacts = new Set<string>();
    const effectKinds = new Set<string>();
    let revision = claimed.needRevision;
    let sideEffect = false;
    let requiresSpoken = false;
    let requiresClarification = false;
    let searchStatusOutcome: {
      action: "start" | "pause";
      result: {
        status: "active" | "paused" | "needs_clarification";
        changed: boolean;
        clarificationQuestion?: string;
      };
    } | undefined;
    let endCallReason: VoiceEndReason | undefined;
    const claimRef = { voiceSessionId: args.voiceSessionId, requestId, generation: claimed.generation };
    const captureFacts = args.intent === "capture_facts";
    const onEffect = (kind: string, fields: string[]) => {
      sideEffect = true;
      effectKinds.add(kind);
      fields.forEach((field) => changedFields.add(field));
      if (kind === "memory") verifiedFacts.add("memory.updated=true");
      if (kind === "decision") verifiedFacts.add("decision.status=answered");
    };
    const searchCanChange = context.activeNeedId !== undefined &&
      (context.mode === "search_discovery" || context.mode === "signal_advisor");
    const needBeforeTurn = context.activeNeedId
      ? await ctx.runQuery(internal.savedNeeds.getOwnedInternal, {
          ownerId,
          needId: context.activeNeedId,
        })
      : null;
    const captureCapabilities = captureFactsCapabilities({
      mode: context.mode,
      hasActiveNeed: context.activeNeedId !== undefined,
      needStatus: needBeforeTurn?.status,
    });
    const tools: ToolSet = captureFacts
      ? captureCapabilities.updateSearchDraft && context.activeNeedId
        ? {
            updateSearchDraft: createSearchDraftTool(ctx, {
              ownerId,
              needId: context.activeNeedId,
              voiceClaim: claimRef,
              onUpdated: (result) => onEffect("search", result.changedFields),
            }),
            ...(captureCapabilities.markSearchBriefReady
              ? {
                  markSearchBriefReady: createMarkSearchBriefReadyTool(ctx, {
                    ownerId,
                    threadId: state.threadId,
                    needId: context.activeNeedId,
                    voiceClaim: claimRef,
                    onReady: () => {
                      onEffect("brief", ["briefReadiness"]);
                      verifiedFacts.add("search.briefReadiness=ready");
                    },
                  }),
                }
              : {}),
          }
        : {}
      : buildScoutTools(ctx, {
          ownerId,
          threadId: state.threadId,
          context,
          voiceClaim: claimRef,
          decisionId: args.decisionId,
          musicianInput: userPrompt,
          onEndCall: (reason) => { endCallReason = reason; },
          onClarificationRequired: () => {
            requiresSpoken = true;
            requiresClarification = true;
          },
          onEffect,
        });
    if (!captureFacts && searchCanChange && context.activeNeedId) {
      tools.setSearchStatus = createTool({
        description: "Start or pause the current search only after the musician explicitly asks. Never infer this from a completed brief. Use pause only for the domain search, not for stopping audio. If start returns needs_clarification, ask exactly its clarificationQuestion naturally and do not claim the search started.",
        inputSchema: z.object({ action: z.enum(["start", "pause"]) }),
        execute: async (_toolCtx, input) => {
          const result = await ctx.runMutation(internal.voiceLive.changeNeedStatus, { ownerId, ...claimRef, action: input.action });
          searchStatusOutcome = { action: input.action, result };
          requiresSpoken = true;
          if (result.status === "needs_clarification") requiresClarification = true;
          if (!result.changed) return result;
          sideEffect = true;
          effectKinds.add("search_status");
          revision = result.revision;
          changedFields.add("status");
          verifiedFacts.add(`search.status=${result.status}`);
          return result;
        },
      });
    }
    try {
      const captureInstruction = claimed.locale === "de"
        ? captureCapabilities.markSearchBriefReady
          ? "FRÜHE FAKTENERFASSUNG: Prüfe nur abgeschlossene, ausdrückliche Aussagen des Musikers. Speichere zuerst ausschließlich klare Suchfakten mit updateSearchDraft. Ignoriere Fragen, unvollständige Werte, Handlungswünsche und mehrdeutige Aussagen. Wenn und nur wenn der gesamte aktuelle kanonische Entwurf danach nützlich genug für eine Suche ist und keine wesentliche Unklarheit bleibt, rufe markSearchBriefReady auf. Markiere nicht allein deshalb als bereit, weil Ort und Radius vorhanden sind, und nicht mitten in einer erkennbar fortgesetzten Beschreibung. markSearchBriefReady startet keine Suche. Nutze keine anderen Wirkungen. Dein Text wird nicht angezeigt oder gesprochen."
          : "FRÜHE FAKTENERFASSUNG: Prüfe nur abgeschlossene, ausdrückliche Aussagen des Musikers. Speichere ausschließlich klare Suchfakten mit updateSearchDraft. Ignoriere Fragen, unvollständige Werte, Handlungswünsche und mehrdeutige Aussagen. Keine anderen Wirkungen. Dein Text wird nicht angezeigt oder gesprochen."
        : captureCapabilities.markSearchBriefReady
          ? "EARLY FACT CAPTURE: Inspect only complete, explicit musician statements. First save only clear search facts with updateSearchDraft. Ignore questions, incomplete values, action requests and ambiguous statements. If and only if the whole current canonical draft is then useful enough to run and no material ambiguity remains, call markSearchBriefReady. Do not mark it ready merely because location and radius exist, or while the musician is evidently still describing the brief. markSearchBriefReady never starts the search. Cause no other effects. Your prose is neither shown nor spoken."
          : "EARLY FACT CAPTURE: Inspect only complete, explicit musician statements. Save only clear search facts with updateSearchDraft. Ignore questions, incomplete values, action requests and ambiguous statements. Cause no other effects. Your prose is neither shown nor spoken.";
      const assistantInstruction = assistantContext
        ? claimed.locale === "de"
          ? `VOICE-ASSISTENT-KONTEXT (keine Musikerangabe und keine Grundlage für Suchänderungen):\n${assistantContext}`
          : `VOICE ASSISTANT CONTEXT (not a musician statement and never a basis for search changes):\n${assistantContext}`
        : "";
      const discovery = context.mode === "search_discovery" && needBeforeTurn?.status === "draft";
      const turn = await runScoutTurn(ctx, {
        ownerId,
        threadId: state.threadId,
        origin: "musician",
        savedNeedId: context.activeNeedId,
        caseCard: [
          context.caseCard,
          captureFacts ? captureInstruction : scoutVoiceInstructions(claimed.locale, { discovery }),
          assistantInstruction,
        ].filter(Boolean).join("\n\n"),
        memoryQuery: userPrompt,
        ...(captureFacts
          ? {
              prompt: userPrompt,
              saveMessages: "none" as const,
              contextMode: "search_facts" as const,
            }
          : {
              promptMessageId: claimed.promptMessageId!,
              prompt: userPrompt,
              saveMessages: "none" as const,
              responseMode: "voice_delivery" as const,
            }),
        tools,
        stream: false,
      });
      if (context.activeNeedId) {
        const currentNeed = await ctx.runQuery(internal.savedNeeds.getOwnedInternal, {
          ownerId,
          needId: context.activeNeedId,
        });
        revision = currentNeed?.matchingRevision ?? revision;
      }
      const postTurnSession = endCallReason || searchStatusOutcome
        ? await ctx.runQuery(internal.voiceLive.getOwnedSessionForDelegate, {
            ownerId,
            voiceSessionId: args.voiceSessionId,
          })
        : null;
      const endCall = endCallReason
        ? {
            reason: endCallReason,
            farewell: voiceEndFarewell(postTurnSession?.locale ?? claimed.locale, endCallReason),
          }
        : undefined;
      const semantic = "output" in turn && turn.output
        ? turn.output
        : { delivery: "silent" as const, responseKind: "routine_update" as const, spokenSummary: "" };
      const guardedSpokenEffect = [...effectKinds].some((kind) =>
        kind !== "search" && kind !== "memory" && kind !== "brief");
      const deliveryResult = resolveLiveDelivery({
        semantic,
        captureFacts,
        hasEndCall: Boolean(endCall),
        requiresSpoken: requiresSpoken || guardedSpokenEffect,
        requiresClarification,
        ...(searchStatusOutcome
          ? {
              searchStatus: {
                locale: postTurnSession?.locale ?? claimed.locale,
                ...searchStatusOutcome,
              },
            }
          : {}),
      });
      return await ctx.runMutation(internal.voiceLive.finishRequest, {
        ownerId,
        voiceSessionId: args.voiceSessionId,
        requestId,
        generation: claimed.generation,
        expectedLocale: claimed.locale,
        result: {
          requestId,
          resolvedEventIds: captureFacts ? [] : args.fragments.map((fragment) => fragment.eventId),
          locale: claimed.locale,
          revision,
          ...(!captureFacts && claimed.promptMessageId ? { promptMessageId: claimed.promptMessageId } : {}),
          changedFields: [...changedFields],
          verifiedFacts: [...verifiedFacts],
          ...deliveryResult,
          ...(endCall ? { endCall } : {}),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const superseded = message.includes("VOICE_CLAIM_SUPERSEDED") || message.includes("VOICE_TARGET_SUPERSEDED") || message.includes("VOICE_FIELD_CONFLICT") || message.includes("VOICE_DECISION_TARGET");
      console.error("LIVE_DELEGATE_FAILED", { requestId, sideEffect, error: message });
      const endCall = endCallReason
        ? { reason: endCallReason, farewell: voiceEndFarewell(claimed.locale, endCallReason) }
        : undefined;
      const failedStatus = superseded ? "superseded" : sideEffect ? "outcome_unknown" : "failed";
      const failureSummary = claimed.locale === "de"
        ? "Das konnte ich gerade nicht zuverlässig abschließen."
        : "I couldn't finish that reliably just now.";
      return await ctx.runMutation(internal.voiceLive.finishRequest, {
        ownerId,
        voiceSessionId: args.voiceSessionId,
        requestId,
        generation: claimed.generation,
        expectedLocale: claimed.locale,
        result: {
          status: failedStatus,
          requestId,
          resolvedEventIds: [],
          locale: claimed.locale,
          revision,
          promptMessageId: claimed.promptMessageId,
          changedFields: [...changedFields],
          verifiedFacts: [...verifiedFacts],
          delivery: superseded ? "silent" : "spoken",
          ...(!superseded ? { spokenSummary: failureSummary } : {}),
          ...(endCall ? { endCall } : {}),
        },
      });
    }
  },
});

export const getOwnedSessionForDelegate = internalQuery({
  args: { ownerId: v.id("users"), voiceSessionId: v.id("voiceSessions") },
  returns: v.union(v.object({ threadId: v.string(), locale: localeValidator }), v.null()),
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.voiceSessionId);
    if (!session || session.ownerId !== args.ownerId || session.provider !== "live") return null;
    return { threadId: session.threadId, locale: session.conversationLocale ?? "en" };
  },
});
