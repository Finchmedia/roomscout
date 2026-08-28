import { Agent, createTool, listUIMessages } from "@convex-dev/agent";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { stepCountIs } from "ai";
import { z } from "zod";
import type { Id } from "./_generated/dataModel";
import { components, internal } from "./_generated/api";
import { action, internalQuery, mutation, query } from "./_generated/server";
import { roomScoutLanguageModel } from "./ai";
import { requireActionUserId, requireUserId } from "./integrations/authz";
import { buildScoutCaseCard, scoutBaseInstructions } from "./scoutCaseCards";

const modeValidator = v.union(
  v.literal("search_discovery"),
  v.literal("signal_advisor"),
  v.literal("outreach_drafting"),
);

const scoutAgent = new Agent(components.agent, {
  name: "Room Scout",
  languageModel: roomScoutLanguageModel,
  instructions: scoutBaseInstructions,
  stopWhen: stepCountIs(6),
});

const memoryToolSchema = z.object({
  subject: z.string().describe("The person, band, place, equipment item, or project this fact is about"),
  subjectKind: z.enum(["person", "band", "place", "equipment", "organization", "project", "other"]),
  predicate: z.string().describe("A short stable relationship name, for example plays_instrument or prefers_genres"),
  value: z.string().describe("The durable fact in concise human-readable form"),
  objectName: z.string().optional(),
  objectKind: z.enum(["person", "band", "place", "equipment", "organization", "project", "other"]).optional(),
  category: z.enum(["identity", "music", "location", "mobility", "schedule", "equipment", "goal", "preference", "constraint", "relationship", "collaboration", "room_need", "other"]),
  confidence: z.number().min(0).max(1),
  verification: z.enum(["user_stated", "inferred"]),
  sensitivity: z.enum(["normal", "personal", "sensitive"]),
  replaceExisting: z.boolean().describe("True when this is a newer value for the same subject and predicate"),
});

const contextValidator = v.object({
  threadId: v.string(),
  mode: modeValidator,
  activeNeedId: v.optional(v.id("savedNeeds")),
  focusedSignalId: v.optional(v.id("signals")),
});

async function ownedNeed(
  ctx: Parameters<typeof requireUserId>[0],
  needId: Id<"savedNeeds">,
  ownerId: Id<"users">,
) {
  const need = await ctx.db.get(needId);
  if (need === null || need.ownerId !== ownerId) {
    throw new ConvexError({ code: "NEED_NOT_FOUND" });
  }
  return need;
}

export const getOrCreateThread = mutation({
  args: { activeNeedId: v.optional(v.id("savedNeeds")) },
  returns: contextValidator,
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    if (args.activeNeedId !== undefined) {
      await ownedNeed(ctx, args.activeNeedId, ownerId);
    }

    const existing = await ctx.db
      .query("scoutContexts")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .first();
    if (existing !== null) {
      if (args.activeNeedId !== undefined && existing.activeNeedId !== args.activeNeedId) {
        await ctx.db.patch(existing._id, {
          activeNeedId: args.activeNeedId,
          mode: "search_discovery",
          focusedSignalId: undefined,
          updatedAt: Date.now(),
        });
      }
      return {
        threadId: existing.threadId,
        mode:
          args.activeNeedId !== undefined && existing.activeNeedId !== args.activeNeedId
            ? "search_discovery"
            : existing.mode,
        activeNeedId: args.activeNeedId ?? existing.activeNeedId,
        focusedSignalId:
          args.activeNeedId !== undefined && existing.activeNeedId !== args.activeNeedId
            ? undefined
            : existing.focusedSignalId,
      };
    }

    const { threadId } = await scoutAgent.createThread(ctx, {
      userId: ownerId,
      title: "My RoomScout search",
    });
    await ctx.db.insert("scoutContexts", {
      ownerId,
      threadId,
      activeNeedId: args.activeNeedId,
      mode: "search_discovery",
      updatedAt: Date.now(),
    });
    return {
      threadId,
      mode: "search_discovery" as const,
      activeNeedId: args.activeNeedId,
      focusedSignalId: undefined,
    };
  },
});

export const getMine = query({
  args: {},
  returns: v.union(contextValidator, v.null()),
  handler: async (ctx) => {
    const ownerId = await requireUserId(ctx);
    const context = await ctx.db
      .query("scoutContexts")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .first();
    return context === null
      ? null
      : {
          threadId: context.threadId,
          mode: context.mode,
          activeNeedId: context.activeNeedId,
          focusedSignalId: context.focusedSignalId,
        };
  },
});

export const setFocus = mutation({
  args: {
    threadId: v.string(),
    mode: modeValidator,
    activeNeedId: v.optional(v.id("savedNeeds")),
    focusedSignalId: v.optional(v.id("signals")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const context = await ctx.db
      .query("scoutContexts")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .unique();
    if (context === null || context.ownerId !== ownerId) {
      throw new ConvexError({ code: "THREAD_NOT_FOUND" });
    }
    if (args.activeNeedId !== undefined) {
      await ownedNeed(ctx, args.activeNeedId, ownerId);
    }
    if (args.mode !== "search_discovery" && args.focusedSignalId === undefined) {
      throw new ConvexError({ code: "SIGNAL_REQUIRED" });
    }
    if (args.focusedSignalId !== undefined) {
      const signal = await ctx.db.get(args.focusedSignalId);
      if (signal === null || (signal.status !== "published" && signal.status !== "stale")) {
        throw new ConvexError({ code: "SIGNAL_NOT_FOUND" });
      }
    }
    await ctx.db.patch(context._id, {
      mode: args.mode,
      activeNeedId: args.activeNeedId ?? context.activeNeedId,
      focusedSignalId:
        args.mode === "search_discovery" ? undefined : args.focusedSignalId,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const listMessages = query({
  args: { threadId: v.string(), paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(
      v.object({
        key: v.string(),
        role: v.union(
          v.literal("system"),
          v.literal("user"),
          v.literal("assistant"),
        ),
        text: v.string(),
        status: v.string(),
        createdAt: v.number(),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const context = await ctx.db
      .query("scoutContexts")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .unique();
    if (context === null || context.ownerId !== ownerId) {
      throw new ConvexError({ code: "THREAD_NOT_FOUND" });
    }
    const result = await listUIMessages(ctx, components.agent, args);
    return {
      page: result.page.map((message) => ({
        key: message.key,
        role: message.role,
        text: message.text,
        status: message.status,
        createdAt: message._creationTime,
      })),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

export const getActionContext = internalQuery({
  args: { ownerId: v.id("users"), threadId: v.string() },
  returns: v.union(
    v.object({
      mode: modeValidator,
      caseCard: v.string(),
      activeNeedId: v.optional(v.id("savedNeeds")),
      focusedSignalId: v.optional(v.id("signals")),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const context = await ctx.db
      .query("scoutContexts")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .unique();
    if (context === null || context.ownerId !== args.ownerId) return null;
    const need = context.activeNeedId
      ? await ctx.db.get(context.activeNeedId)
      : null;
    const signal = context.focusedSignalId
      ? await ctx.db.get(context.focusedSignalId)
      : null;
    return {
      mode: context.mode,
      caseCard: buildScoutCaseCard({ mode: context.mode, need, signal }),
      activeNeedId: context.activeNeedId,
      focusedSignalId: context.focusedSignalId,
    };
  },
});

export const sendMessage = action({
  args: { threadId: v.string(), message: v.string() },
  returns: v.object({ text: v.string() }),
  handler: async (ctx, args): Promise<{ text: string }> => {
    const ownerId = await requireActionUserId(ctx);
    const message = args.message.trim();
    if (message.length === 0 || message.length > 4_000) {
      throw new ConvexError({ code: "INVALID_MESSAGE" });
    }
    const context: {
      mode: "search_discovery" | "signal_advisor" | "outreach_drafting";
      caseCard: string;
      activeNeedId?: Id<"savedNeeds">;
      focusedSignalId?: Id<"signals">;
    } | null = await ctx.runQuery(internal.scout.getActionContext, {
      ownerId,
      threadId: args.threadId,
    });
    if (context === null) {
      throw new ConvexError({ code: "THREAD_NOT_FOUND" });
    }

    const memoryContext: string = await ctx.runQuery(
      internal.memory.getPromptContext,
      { ownerId },
    );
    const relevantMemory: string = await ctx.runAction(
      internal.memory.searchRelevant,
      { ownerId, query: message },
    );
    const instructions: string = [
      scoutBaseInstructions,
      context.caseCard,
      memoryContext,
      relevantMemory,
    ].filter(Boolean).join("\n\n");

    const rememberFact = createTool({
      description:
        "Remember one durable musician, band, collaboration, mobility, equipment, schedule, or room-search fact. Do not use for transient chat or sensitive secrets.",
      inputSchema: memoryToolSchema,
      execute: async (_toolCtx, input) => {
        const result = await ctx.runMutation(internal.memory.rememberFromScout, {
          ownerId,
          ...input,
        });
        return { remembered: result.created, factId: result.factId };
      },
    });

    if (context.mode === "search_discovery" && context.activeNeedId) {
      const needId = context.activeNeedId;
      const updateSearchDraft = createTool({
        description: "Update explicit facts on the user's attached draft search.",
        inputSchema: z.object({
          title: z.string().optional(),
          city: z.string().optional(),
          districts: z.array(z.string()).optional(),
          maxBudgetEur: z.number().nonnegative().optional(),
          arrangement: z.array(z.enum(["permanent", "shared", "hourly"])).optional(),
          schedule: z.array(z.string()).optional(),
          requirements: z.array(z.string()).optional(),
          openToSharing: z.boolean().optional(),
        }),
        execute: async (_toolCtx, input) => {
          await ctx.runMutation(internal.savedNeeds.updateFromScout, {
            needId,
            ownerId,
            ...input,
          });
          return { updated: true };
        },
      });
      const responseText: string = (await scoutAgent.generateText(
        ctx,
        { threadId: args.threadId, userId: ownerId },
        {
          prompt: message,
          instructions,
          tools: { updateSearchDraft, rememberFact },
        },
      )).text;
      return { text: responseText };
    }

    if (
      context.mode === "outreach_drafting" &&
      context.activeNeedId &&
      context.focusedSignalId
    ) {
      const savedNeedId = context.activeNeedId;
      const signalId = context.focusedSignalId;
      const createOutreachDraft = createTool({
        description:
          "Create a private outreach draft for review. This never approves or sends it.",
        inputSchema: z.object({
          recipientName: z.string(),
          recipientEmail: z.string().email(),
          subject: z.string(),
          body: z.string(),
        }),
        execute: async (_toolCtx, input) => {
          const draftId: Id<"outreachDrafts"> = await ctx.runMutation(internal.outreach.createFromScout, {
            ownerId,
            savedNeedId,
            signalId,
            ...input,
          });
          return { drafted: true, draftId };
        },
      });
      const responseText: string = (await scoutAgent.generateText(
        ctx,
        { threadId: args.threadId, userId: ownerId },
        {
          prompt: message,
          instructions,
          tools: { createOutreachDraft, rememberFact },
        },
      )).text;
      return { text: responseText };
    }

    const responseText: string = (await scoutAgent.generateText(
      ctx,
      { threadId: args.threadId, userId: ownerId },
      { prompt: message, instructions, tools: { rememberFact } },
    )).text;
    return { text: responseText };
  },
});
