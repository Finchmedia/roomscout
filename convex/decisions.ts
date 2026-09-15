/**
 * Entscheidung im Chat (Kandidat B): the Scout's questions to the musician,
 * raised by the Freigabeprüfung, provider assessments and portal registration,
 * answered in the Scout chat (UI or chat tools) and executed here.
 */

import { createTool } from "@convex-dev/agent";
import { ConvexError, v } from "convex/values";
import { z } from "zod";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { requireUserId } from "./integrations/authz";
import { approveRequestAsHuman, dispatchApproved, rejectRequestAsHuman } from "./externalActions";
import {
  decisionPublic, decisionPublicValidator, markAnswered, MESSAGE_DECISION_KINDS, MUSICIAN_INSTRUCTION_PREFIX,
  SCOUT_DECLINED_MESSAGE,
} from "./lib/decisions";
import { delimitUntrustedData } from "./lib/privacy";
import { enqueueMusicianInputTurn } from "./providerConversations";
import { stageCustomReplyForOwner } from "./providerActions";
import { runScoutTurn, scoutAgent } from "./scoutRuntime";

const answerResultValidator = v.object({
  decisionId: v.id("decisions"),
  status: v.union(v.literal("answered"), v.literal("open")),
  /** What happened to the referenced action, when there is one. */
  action: v.optional(v.string()),
  requestId: v.optional(v.id("actionRequests")),
  dispatched: v.optional(v.boolean()),
  sent: v.optional(v.literal(false)),
  next: v.optional(v.string()),
});
type AnswerResult = {
  decisionId: Id<"decisions">;
  status: "answered" | "open";
  action?: string;
  requestId?: Id<"actionRequests">;
  dispatched?: boolean;
  sent?: false;
  next?: string;
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const listOpenMine = query({
  args: {},
  returns: v.array(decisionPublicValidator),
  handler: async (ctx) => {
    const ownerId = await requireUserId(ctx);
    const rows = await ctx.db.query("decisions").withIndex("by_owner_and_status", (q) =>
      q.eq("ownerId", ownerId).eq("status", "open"),
    ).order("desc").take(50);
    return rows.map(decisionPublic);
  },
});

export const historyMine = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(decisionPublicValidator),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const limit = Math.max(1, Math.min(50, Math.floor(args.limit ?? 50)));
    const [answered, superseded] = await Promise.all([
      ctx.db.query("decisions").withIndex("by_owner_and_status", (q) => q.eq("ownerId", ownerId).eq("status", "answered")).order("desc").take(limit),
      ctx.db.query("decisions").withIndex("by_owner_and_status", (q) => q.eq("ownerId", ownerId).eq("status", "superseded")).order("desc").take(limit),
    ]);
    return [...answered, ...superseded].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, limit).map(decisionPublic);
  },
});

/** Open decisions of one owner for the Scout's case card (chat and voice). */
export async function openDecisionCards(ctx: QueryCtx, ownerId: Id<"users">) {
  const rows = await ctx.db.query("decisions").withIndex("by_owner_and_status", (q) =>
    q.eq("ownerId", ownerId).eq("status", "open"),
  ).order("desc").take(10);
  return rows
    .filter((row) => row.kind !== "human_step" && (row.kind !== "scout_question" || row.question.length > 0))
    .map((row) => ({
      decisionId: row._id as string, kind: row.kind, question: row.question,
      ...(row.detail !== undefined ? { detail: row.detail.slice(0, 2_000) } : {}),
      options: row.options,
      ...(row.conversationId !== undefined ? { conversationId: row.conversationId as string } : {}),
    }));
}

// ---------------------------------------------------------------------------
// Scout chat thread helpers
// ---------------------------------------------------------------------------

/** The musician's Scout thread; created when they never opened the chat. */
async function ensureOwnerThread(ctx: MutationCtx, ownerId: Id<"users">): Promise<string> {
  const existing = await ctx.db.query("scoutContexts").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).first();
  if (existing) return existing.threadId;
  const { threadId } = await scoutAgent.createThread(ctx, { userId: ownerId, title: "My RoomScout search" });
  await ctx.db.insert("scoutContexts", { ownerId, threadId, mode: "search_discovery", updatedAt: Date.now() });
  return threadId;
}

/** Appends one Scout (assistant) message to the musician's chat. Returns the Agent message id. */
export async function postScoutMessage(ctx: MutationCtx, ownerId: Id<"users">, text: string): Promise<string> {
  const threadId = await ensureOwnerThread(ctx, ownerId);
  const { messageId } = await scoutAgent.saveMessage(ctx, {
    threadId, userId: ownerId, message: { role: "assistant", content: text.slice(0, 8_000) }, skipEmbeddings: true,
  });
  return messageId;
}

// ---------------------------------------------------------------------------
// Answering
// ---------------------------------------------------------------------------

async function ownedOpenDecision(ctx: MutationCtx, ownerId: Id<"users">, decisionId: Id<"decisions">): Promise<Doc<"decisions">> {
  const decision = await ctx.db.get(decisionId);
  if (!decision || decision.ownerId !== ownerId) throw new ConvexError({ code: "DECISION_NOT_FOUND" });
  if (decision.status !== "open") throw new ConvexError({ code: "DECISION_NOT_OPEN" });
  return decision;
}

/**
 * The one answer path for every kind. `fromChat` marks answers the Scout took
 * from the musician's words in chat: the words are already in the thread, so
 * no extra chat round is scheduled for them. `dictated` marks the inbox
 * composer, the one place where the musician's text IS the message to the
 * provider; everywhere else "custom" on a message Entscheidung is an
 * instruction for the Scout's next draft, never a message sent verbatim.
 */
export async function answerDecision(ctx: MutationCtx, args: {
  ownerId: Id<"users">; decisionId: Id<"decisions">; choice: string; text?: string; fromChat?: boolean; dictated?: boolean;
}): Promise<AnswerResult> {
  const decision = await ownedOpenDecision(ctx, args.ownerId, args.decisionId);
  const choice = args.choice.trim().slice(0, 40);
  const text = args.text?.replace(/[^\S\n]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, 4_000) || undefined;
  if (!choice) throw new ConvexError({ code: "INVALID_CHOICE" });
  if (choice === "custom" && !text) throw new ConvexError({ code: "TEXT_REQUIRED" });

  if (decision.kind === "human_step") throw new ConvexError({ code: "DECISION_NOT_ANSWERABLE" });

  if (MESSAGE_DECISION_KINDS.has(decision.kind)) {
    if (!["yes", "no", "custom"].includes(choice)) throw new ConvexError({ code: "INVALID_CHOICE" });
    const request = decision.refs.requestId ? await ctx.db.get(decision.refs.requestId) : null;
    if (!request || request.ownerId !== args.ownerId) throw new ConvexError({ code: "ACTION_NOT_FOUND" });
    if (request.status !== "awaiting_approval") throw new ConvexError({ code: "INVALID_ACTION_STATE" });
    if (choice === "yes") {
      await approveRequestAsHuman(ctx, request, args.ownerId);
      await dispatchApproved(ctx, (await ctx.db.get(request._id))!);
      await markAnswered(ctx, decision, { choice });
      return { decisionId: decision._id, status: "answered", action: "approved", requestId: request._id, dispatched: true, sent: false };
    }
    await rejectRequestAsHuman(ctx, request, args.ownerId);
    await markAnswered(ctx, decision, { choice, ...(text ? { text } : {}) });
    if (choice === "no") {
      if (!args.fromChat) await postScoutMessage(ctx, args.ownerId, SCOUT_DECLINED_MESSAGE);
      return { decisionId: decision._id, status: "answered", action: "rejected", requestId: request._id, next: "ask_what_should_change" };
    }
    const conversationId = decision.conversationId ?? request.providerConversationId;
    if (!conversationId) throw new ConvexError({ code: "CONVERSATION_REQUIRED" });
    if (args.dictated) {
      // Nachrichten composer: the musician writes the provider message themselves.
      const staged = await stageCustomReplyForOwner(ctx, { ownerId: args.ownerId, conversationId, body: text! });
      return { decisionId: decision._id, status: "answered", action: `custom_${staged.status}`, requestId: staged.requestId, dispatched: staged.dispatched, sent: false };
    }
    // The band's words steer the wording; the Scout re-assesses and drafts the
    // next message, which passes the Freigabeprüfung like any Scout draft.
    const turnId = await enqueueMusicianInputTurn(ctx, {
      conversationId, decisionId: decision._id, input: `${MUSICIAN_INSTRUCTION_PREFIX}${text!}`,
    });
    if (turnId === null) {
      // The conversation is closed: no next draft can carry the instruction.
      if (!args.fromChat) await postScoutMessage(ctx, args.ownerId, SCOUT_DECLINED_MESSAGE);
      return { decisionId: decision._id, status: "answered", action: "rejected", requestId: request._id, next: "ask_what_should_change" };
    }
    return { decisionId: decision._id, status: "answered", action: "reassessing", requestId: request._id, sent: false };
  }

  if (decision.kind === "scout_question") {
    const option = decision.options.find((item) => item.id === choice);
    if (!option && choice !== "custom") throw new ConvexError({ code: "INVALID_CHOICE" });
    const statement = option ? (text ? `${option.label} — ${text}` : option.label) : text!;
    await markAnswered(ctx, decision, { choice, ...(text ? { text } : {}) });
    if (decision.conversationId) {
      await enqueueMusicianInputTurn(ctx, { conversationId: decision.conversationId, decisionId: decision._id, input: statement });
    }
    if (text && !args.fromChat) {
      await ctx.scheduler.runAfter(0, internal.decisions.absorbMusicianAnswer, { decisionId: decision._id });
    }
    return { decisionId: decision._id, status: "answered", action: "reassessing" };
  }

  // offer_ready
  if (choice === "review") {
    // Stays open until the musician actually opens the review (offerAcceptance.prepare answers it).
    return { decisionId: decision._id, status: "open", next: "open_offer_review" };
  }
  if (choice !== "no") throw new ConvexError({ code: "INVALID_CHOICE" });
  await markAnswered(ctx, decision, { choice, ...(text ? { text } : {}) });
  if (decision.refs.requestId) {
    const request = await ctx.db.get(decision.refs.requestId);
    if (request && request.ownerId === args.ownerId && request.status === "awaiting_approval") await rejectRequestAsHuman(ctx, request, args.ownerId);
  }
  const conversation = decision.conversationId ? await ctx.db.get(decision.conversationId) : null;
  const opportunity = conversation?.ownerId === args.ownerId && conversation.opportunityId ? await ctx.db.get(conversation.opportunityId) : null;
  if (opportunity && opportunity.ownerId === args.ownerId && !["converted", "dismissed", "expired"].includes(opportunity.status)) {
    // Same transition as opportunities.updateStatus(dismissed).
    await ctx.db.patch(opportunity._id, { status: "dismissed", updatedAt: Date.now() });
    return { decisionId: decision._id, status: "answered", action: "opportunity_dismissed" };
  }
  return { decisionId: decision._id, status: "answered", action: "declined" };
}

export const answer = mutation({
  args: { decisionId: v.id("decisions"), choice: v.string(), text: v.optional(v.string()) },
  returns: answerResultValidator,
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    return await answerDecision(ctx, { ownerId, ...args });
  },
});

/** Chat/voice tool path: the owner is already resolved by the caller. */
export const answerFromScout = internalMutation({
  args: { ownerId: v.id("users"), decisionId: v.id("decisions"), choice: v.string(), text: v.optional(v.string()) },
  returns: answerResultValidator,
  handler: async (ctx, args) => await answerDecision(ctx, { ...args, fromChat: true }),
});


// ---------------------------------------------------------------------------
// scout_question: formulate the question with one Scout round in the chat
// ---------------------------------------------------------------------------

const formulationInputValidator = v.object({
  ownerId: v.id("users"),
  threadId: v.string(),
  decisionId: v.id("decisions"),
  savedNeedId: v.optional(v.id("savedNeeds")),
  need: v.union(v.object({ title: v.string(), city: v.string(), requirements: v.array(v.string()), schedule: v.array(v.string()), maxBudgetEur: v.optional(v.number()) }), v.null()),
  signalTitle: v.optional(v.string()),
  summary: v.string(),
  uncertainties: v.array(v.string()),
  blockers: v.array(v.string()),
});

export const prepareFormulation = internalMutation({
  args: { decisionId: v.id("decisions") },
  returns: v.union(formulationInputValidator, v.null()),
  handler: async (ctx, args) => {
    const decision = await ctx.db.get(args.decisionId);
    if (!decision || decision.status !== "open" || decision.kind !== "scout_question" || decision.question.length > 0) return null;
    const offer = decision.refs.offerId ? await ctx.db.get(decision.refs.offerId) : null;
    if (!offer || offer.ownerId !== decision.ownerId) return null;
    const conversation = await ctx.db.get(offer.conversationId);
    const [need, signal] = await Promise.all([
      ctx.db.get(offer.savedNeedId), conversation ? ctx.db.get(conversation.signalId) : Promise.resolve(null),
    ]);
    const threadId = await ensureOwnerThread(ctx, decision.ownerId);
    return {
      ownerId: decision.ownerId, threadId, decisionId: decision._id,
      ...(decision.savedNeedId !== undefined ? { savedNeedId: decision.savedNeedId } : {}),
      need: need && need.ownerId === decision.ownerId
        ? { title: need.title, city: need.city, requirements: need.requirements, schedule: need.schedule, ...(need.maxBudgetEur !== undefined ? { maxBudgetEur: need.maxBudgetEur } : {}) }
        : null,
      ...(signal ? { signalTitle: signal.title } : {}),
      summary: offer.assessment.summary,
      uncertainties: offer.assessment.uncertainties,
      blockers: offer.blockers,
    };
  },
});

export const recordDecisionQuestion = internalMutation({
  args: {
    decisionId: v.id("decisions"),
    question: v.string(),
    options: v.array(v.object({ id: v.string(), label: v.string() })),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const decision = await ctx.db.get(args.decisionId);
    if (!decision || decision.status !== "open" || decision.kind !== "scout_question") return false;
    const question = args.question.replace(/\s+/g, " ").trim().slice(0, 700);
    if (!question) throw new ConvexError({ code: "QUESTION_REQUIRED" });
    const seen = new Set<string>();
    const options = args.options.slice(0, 3).map((option) => ({
      id: option.id.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_").slice(0, 40) || "option",
      label: option.label.replace(/\s+/g, " ").trim().slice(0, 120),
    })).filter((option) => option.label && option.id !== "custom" && !seen.has(option.id) && seen.add(option.id));
    await ctx.db.patch(decision._id, { question, options, updatedAt: Date.now() });
    return true;
  },
});

export const attachThreadMessage = internalMutation({
  args: { ownerId: v.id("users"), decisionId: v.id("decisions"), text: v.string(), messageId: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const decision = await ctx.db.get(args.decisionId);
    if (!decision || decision.ownerId !== args.ownerId || decision.status !== "open") return null;
    const messageId = args.messageId ?? await postScoutMessage(ctx, args.ownerId, args.text);
    await ctx.db.patch(decision._id, { threadMessageId: messageId, updatedAt: Date.now() });
    return null;
  },
});

/** Deterministic question when the model round yields none: the musician still gets a usable Entscheidung. */
export function fallbackQuestion(input: { uncertainties: string[]; blockers: string[]; signalTitle?: string }): string {
  const topic = input.uncertainties[0] ?? input.blockers[0];
  const room = input.signalTitle ? ` zu „${input.signalTitle}“` : "";
  return topic ? `Ich brauche deine Einschätzung${room}: ${topic} — wie willst du damit umgehen?` : `Ich brauche deine Einschätzung${room}, bevor ich weitermache. Wie soll ich vorgehen?`;
}

export const formulateQuestion = internalAction({
  args: { decisionId: v.id("decisions") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const input = await ctx.runMutation(internal.decisions.prepareFormulation, args);
    if (!input) return null;
    let recorded = false;
    const recordDecisionQuestion = createTool({
      description: "Record the ONE short German question to the musician for this Entscheidung and up to three answer options. Call exactly once.",
      inputSchema: z.object({
        decisionId: z.string().describe("The decisionId from the case card"),
        question: z.string().min(1).max(700),
        options: z.array(z.object({ id: z.string().min(1).max(40), label: z.string().min(1).max(120) })).max(3),
      }),
      execute: async (_toolCtx, toolInput) => {
        if (toolInput.decisionId !== input.decisionId) return { recorded: false, reason: "wrong decisionId" };
        recorded = await ctx.runMutation(internal.decisions.recordDecisionQuestion, {
          decisionId: input.decisionId, question: toolInput.question, options: toolInput.options,
        });
        return { recorded };
      },
    });
    let text = "";
    let assistantMessageId: string | undefined;
    try {
      const result = await runScoutTurn(ctx, {
        ownerId: input.ownerId, threadId: input.threadId, origin: "scout", savedNeedId: input.savedNeedId,
        memoryQuery: `${input.need?.title ?? ""} ${input.uncertainties.join(" ")}`.trim() || "Proberaum",
        saveMessages: "none",
        caseCard: [
          `MODE: ENTSCHEIDUNG FORMULIEREN
GOAL: The provider conversation needs the musician's decision. Formulate ONE short question in German (the musician's language) from the uncertainties and blockers below, plus up to three concrete answer options, and call recordDecisionQuestion exactly once with decisionId "${input.decisionId}". Then write the same question as a brief, warm chat message to the musician (one or two sentences, no lists of everything you know). Do not ask for facts already in the musician's search or memory. You cannot send, accept or change anything else.`,
          `Current musician search (data): ${JSON.stringify(input.need)}`,
          input.signalTitle ? `Room (data): ${input.signalTitle}` : "",
          delimitUntrustedData("assessment_summary", input.summary),
          delimitUntrustedData("uncertainties", JSON.stringify(input.uncertainties)),
          delimitUntrustedData("blockers", JSON.stringify(input.blockers)),
        ].filter(Boolean).join("\n\n"),
        prompt: "Formulate the question for the musician now.",
        tools: { recordDecisionQuestion },
      });
      text = result.text.trim();
      assistantMessageId = result.assistantMessageId;
    } catch (error) {
      console.error("DECISION_FORMULATION_FAILED", error instanceof Error ? error.message : String(error));
    }
    if (!recorded) {
      const question = fallbackQuestion(input);
      await ctx.runMutation(internal.decisions.recordDecisionQuestion, { decisionId: input.decisionId, question, options: [] });
      if (!text) text = question;
    }
    const decision = await ctx.runQuery(internal.decisions.getInternal, { decisionId: input.decisionId });
    await ctx.runMutation(internal.decisions.attachThreadMessage, {
      ownerId: input.ownerId, decisionId: input.decisionId, text: text || decision?.question || fallbackQuestion(input),
      ...(assistantMessageId ? { messageId: assistantMessageId } : {}),
    });
    return null;
  },
});

export const getInternal = internalQuery({
  args: { decisionId: v.id("decisions") },
  returns: v.union(decisionPublicValidator, v.null()),
  handler: async (ctx, args) => {
    const decision = await ctx.db.get(args.decisionId);
    return decision ? decisionPublic(decision) : null;
  },
});

// ---------------------------------------------------------------------------
// scout_question text answers also feed the musician's memory / search
// ---------------------------------------------------------------------------

const memoryToolSchema = z.object({
  subject: z.string(),
  subjectKind: z.enum(["person", "band", "place", "equipment", "organization", "project", "other"]),
  predicate: z.string(),
  value: z.string(),
  objectName: z.string().optional(),
  objectKind: z.enum(["person", "band", "place", "equipment", "organization", "project", "other"]).optional(),
  category: z.enum(["identity", "music", "location", "mobility", "schedule", "equipment", "goal", "preference", "constraint", "relationship", "collaboration", "room_need", "other"]),
  confidence: z.number().min(0).max(1),
  verification: z.enum(["user_stated", "inferred"]),
  sensitivity: z.enum(["normal", "personal", "sensitive"]),
  replaceExisting: z.boolean(),
});

export const getAbsorbInput = internalQuery({
  args: { decisionId: v.id("decisions") },
  returns: v.union(v.object({ ownerId: v.id("users"), threadId: v.string(), text: v.string(), savedNeedId: v.optional(v.id("savedNeeds")) }), v.null()),
  handler: async (ctx, args) => {
    const decision = await ctx.db.get(args.decisionId);
    if (!decision || decision.status !== "answered" || !decision.answer?.text) return null;
    const context = await ctx.db.query("scoutContexts").withIndex("by_owner", (q) => q.eq("ownerId", decision.ownerId)).first();
    if (!context) return null;
    return {
      ownerId: decision.ownerId, threadId: context.threadId, text: decision.answer.text,
      ...(decision.savedNeedId !== undefined ? { savedNeedId: decision.savedNeedId } : {}),
    };
  },
});

/** One musician chat round over the typed answer so durable facts land in memory (rememberFact). */
export const absorbMusicianAnswer = internalAction({
  args: { decisionId: v.id("decisions") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const input = await ctx.runQuery(internal.decisions.getAbsorbInput, args);
    if (!input) return null;
    const ownerId = input.ownerId;
    const rememberFact = createTool({
      description: "Remember one durable musician, band, collaboration, mobility, equipment, schedule, or room-search fact. Do not use for transient chat or sensitive secrets.",
      inputSchema: memoryToolSchema,
      execute: async (_toolCtx, factInput) => {
        const result = await ctx.runMutation(internal.memory.rememberFromScout, { ownerId, ...factInput });
        return { remembered: result.created, factId: result.factId };
      },
    });
    await runScoutTurn(ctx, {
      ownerId, threadId: input.threadId, origin: "musician", savedNeedId: input.savedNeedId,
      caseCard: "MODE: ENTSCHEIDUNG BEANTWORTET\nThe musician just answered your question about a provider conversation; the answer is being applied to that conversation by the server. Remember durable facts from it with rememberFact when useful. Reply with one short confirming sentence in the musician's language; do not ask a new question and do not claim any message was sent.",
      memoryQuery: input.text, prompt: input.text, tools: { rememberFact },
    });
    return null;
  },
});
