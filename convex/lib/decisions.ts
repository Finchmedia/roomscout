/**
 * Entscheidung — a question of the Scout to the musician, answered in the
 * Scout chat (CONTEXT.md). This module owns the table's invariants:
 * at most one open decision per conversation (or per owner when no
 * conversation is involved) and the fixed German question templates.
 */

import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { GateReason } from "./autonomyGate";

export type DecisionKind = Doc<"decisions">["kind"];
export type DecisionOption = { id: string; label: string };
export type DecisionRefs = Doc<"decisions">["refs"];

export const decisionKindValidator = v.union(
  v.literal("scout_question"),
  v.literal("review_message"),
  v.literal("private_data"),
  v.literal("binding_content"),
  v.literal("unsupported_claims"),
  v.literal("safety_unavailable"),
  v.literal("offer_ready"),
  v.literal("human_step"),
);
export const decisionStatusValidator = v.union(v.literal("open"), v.literal("answered"), v.literal("superseded"));
export const decisionOptionValidator = v.object({ id: v.string(), label: v.string() });
export const decisionRefsValidator = v.object({
  requestId: v.optional(v.id("actionRequests")),
  offerId: v.optional(v.id("offerRevisions")),
  runId: v.optional(v.id("browserRuns")),
  connectionId: v.optional(v.id("portalConnections")),
});
export const decisionAnswerValidator = v.object({ choice: v.string(), text: v.optional(v.string()), at: v.number() });
export const decisionConstraintEffectValidator = v.union(v.literal("accept_alternative"), v.literal("keep_requirement"), v.literal("none"));
export const decisionQuestionOptionValidator = v.object({
  id: v.string(), label: v.string(), constraintEffect: v.optional(decisionConstraintEffectValidator),
});
export const decisionQuestionValidator = v.object({
  id: v.string(), constraintKeys: v.array(v.string()), question: v.string(),
  options: v.array(decisionQuestionOptionValidator), answer: v.optional(decisionAnswerValidator),
});

export const decisionPublicValidator = v.object({
  _id: v.id("decisions"),
  kind: decisionKindValidator,
  status: decisionStatusValidator,
  question: v.string(),
  detail: v.optional(v.string()),
  options: v.array(decisionOptionValidator),
  questions: v.optional(v.array(decisionQuestionValidator)),
  refs: decisionRefsValidator,
  conversationId: v.optional(v.id("providerConversations")),
  savedNeedId: v.optional(v.id("savedNeeds")),
  threadMessageId: v.optional(v.string()),
  answer: v.optional(decisionAnswerValidator),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export function decisionPublic(row: Doc<"decisions">) {
  return {
    _id: row._id, kind: row.kind, status: row.status, question: row.question,
    ...(row.detail !== undefined ? { detail: row.detail } : {}),
    options: row.options, refs: row.refs,
    ...(row.questions !== undefined ? { questions: row.questions } : {}),
    ...(row.conversationId !== undefined ? { conversationId: row.conversationId } : {}),
    ...(row.savedNeedId !== undefined ? { savedNeedId: row.savedNeedId } : {}),
    ...(row.threadMessageId !== undefined ? { threadMessageId: row.threadMessageId } : {}),
    ...(row.answer !== undefined ? { answer: row.answer } : {}),
    createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

/** Full question/answer pairs, never an unscoped yes or a global preference. */
export function musicianQuestionRoundStatement(questions: NonNullable<Doc<"decisions">["questions"]>): string {
  return JSON.stringify({ scope: "this_room_only", answers: questions.filter((question) => question.answer).map((question) => {
    const label = question.options.find((item) => item.id === question.answer!.choice)?.label;
    return {
      constraintKeys: question.constraintKeys, question: question.question,
      answer: label && question.answer!.text ? `${label} — ${question.answer!.text}` : question.answer!.text ?? label ?? question.answer!.choice,
    };
  }) });
}

/** The kinds that wrap a gate ask_user on an outgoing message. */
export const MESSAGE_DECISION_KINDS: ReadonlySet<DecisionKind> = new Set<DecisionKind>([
  "review_message", "private_data", "binding_content", "unsupported_claims", "safety_unavailable",
]);

export const MESSAGE_OPTIONS: DecisionOption[] = [
  { id: "yes", label: "Ja, so senden" },
  { id: "no", label: "Nein, anders" },
];
export const OFFER_OPTIONS: DecisionOption[] = [
  { id: "review", label: "Angebot prüfen" },
  { id: "no", label: "Nicht dieses" },
];
export const OFFER_READY_QUESTION = "Ein Angebot liegt vor. Willst du es prüfen?";
export const HUMAN_STEP_QUESTION = "Bei der Anmeldung im Portal brauche ich dich.";
export const HUMAN_STEP_DETAIL_FIRECRAWL = "Verbindung in den Einstellungen neu registrieren.";
export const SCOUT_DECLINED_MESSAGE = "Okay, ich sende das nicht. Was soll anders sein?";
/**
 * Prefix for the band's own wording instruction on a message Entscheidung. The
 * words are never sent verbatim: they steer the Scout's next draft, which goes
 * through the Freigabeprüfung like any other Scout message.
 */
export const MUSICIAN_INSTRUCTION_PREFIX = "Anweisung der Band zur nächsten Nachricht: ";

const GATE_QUESTION: Record<"en" | "de", Partial<Record<GateReason, string>>> = {
  en: {
    review_mode: "Should I send this message?",
    user_draft: "Should I send your message as written?",
    private_data: "This message includes details your sharing rules do not allow. Send it anyway?",
    binding_content: "This message contains a binding commitment. Send it anyway?",
    uncertain_content: "The meaning of this message is unclear. Send it anyway?",
    unsupported_claims: "This message contains claims that are not supported by the saved facts. Send it anyway?",
    safety_unavailable: "I could not complete the safety review. Send it anyway?",
    binding_action: "The binding decision stays with you. Would you like to review the offer?",
  },
  de: {
    review_mode: "Soll ich diese Nachricht so senden?",
    user_draft: "Soll ich deine Nachricht so senden?",
    private_data: "Die Nachricht enthält Angaben, die ich laut deinen Regeln nicht teilen darf. Trotzdem so senden?",
    binding_content: "Die Nachricht enthält eine verbindliche Zusage. Soll ich sie trotzdem so senden?",
    uncertain_content: "Die Bedeutung der Nachricht ist nicht eindeutig. Soll ich sie trotzdem so senden?",
    unsupported_claims: "Die Nachricht enthält Behauptungen ohne Beleg. Trotzdem so senden?",
    safety_unavailable: "Ich konnte die Nachricht nicht prüfen. Soll ich sie trotzdem so senden?",
    binding_action: "Die verbindliche Zusage bleibt bei dir. Willst du das Angebot prüfen?",
  },
};

/** Which Entscheidung a gate ask_user reason raises; `null` for reasons that never ask. */
export function gateDecisionKind(reason: GateReason): DecisionKind | null {
  switch (reason) {
    case "review_mode":
    case "user_draft":
      return "review_message";
    case "private_data":
      return "private_data";
    case "binding_content":
    case "uncertain_content":
      return "binding_content";
    case "unsupported_claims":
      return "unsupported_claims";
    case "safety_unavailable":
      return "safety_unavailable";
    case "binding_action":
      return "offer_ready";
    default:
      return null;
  }
}

/** The text the musician would send: body (with subject) or the contact form's message field. */
export function outgoingMessageText(payload: Doc<"actionRequests">["payload"]): string {
  if (payload.kind === "email_message") return payload.subject ? `${payload.subject}\n\n${payload.body}` : payload.body;
  if (payload.kind === "platform_message") return payload.subject ? `${payload.subject}\n\n${payload.body}` : payload.body;
  if (payload.kind === "contact_form") {
    const message = payload.fields.find((field) => field.name === "message");
    if (message) return message.value;
    return payload.fields.map((field) => `${field.label ?? field.name}: ${field.value}`).join("\n");
  }
  return `${payload.operation}${payload.accountLabel ? ` (${payload.accountLabel})` : ""}`;
}

/** Everything a gate ask_user needs to become an Entscheidung. */
export function gateDecisionSpec(
  request: Doc<"actionRequests">,
  outcome: { reason: GateReason; detail?: string },
  locale: "en" | "de" = "en",
): { kind: DecisionKind; question: string; detail: string; options: DecisionOption[] } | null {
  const kind = gateDecisionKind(outcome.reason);
  if (kind === null) return null;
  const question = GATE_QUESTION[locale][outcome.reason] ?? GATE_QUESTION[locale].review_mode!;
  const payload = request.payload;
  const message = (payload.kind === "email_message" || payload.kind === "platform_message") && payload.subject?.trim()
    ? `${locale === "de" ? "Betreff" : "Subject"}:\n${payload.subject.trim()}\n\n${locale === "de" ? "Nachricht" : "Message"}:\n${payload.body}`
    : outgoingMessageText(payload);
  const detail = kind === "private_data" && outcome.detail
    ? `Datenfelder: ${outcome.detail}\n\n${message}`
    : message;
  const messageOptions = locale === "de" ? MESSAGE_OPTIONS : [
    { id: "yes", label: "Yes, send it" },
    { id: "no", label: "No, change it" },
  ];
  const offerOptions = locale === "de" ? OFFER_OPTIONS : [
    { id: "review", label: "Review offer" },
    { id: "no", label: "Not this one" },
  ];
  return { kind, question, detail: detail.slice(0, 20_000), options: kind === "offer_ready" ? offerOptions : messageOptions };
}

async function openDecisionsFor(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  conversationId: Id<"providerConversations"> | undefined,
): Promise<Doc<"decisions">[]> {
  if (conversationId !== undefined) {
    return await ctx.db.query("decisions").withIndex("by_conversation_and_status", (q) =>
      q.eq("conversationId", conversationId).eq("status", "open"),
    ).take(20);
  }
  const rows = await ctx.db.query("decisions").withIndex("by_owner_and_status", (q) =>
    q.eq("ownerId", ownerId).eq("status", "open"),
  ).take(50);
  return rows.filter((row) => row.conversationId === undefined);
}

/**
 * Raises a new Entscheidung and supersedes the previously open one of the
 * same conversation (or of the owner when no conversation is involved).
 */
export async function raiseDecision(ctx: MutationCtx, args: {
  ownerId: Id<"users">;
  savedNeedId?: Id<"savedNeeds">;
  conversationId?: Id<"providerConversations">;
  kind: DecisionKind;
  question: string;
  detail?: string;
  options: DecisionOption[];
  refs: DecisionRefs;
  threadMessageId?: string;
}): Promise<Id<"decisions">> {
  const now = Date.now();
  for (const previous of await openDecisionsFor(ctx, args.ownerId, args.conversationId)) {
    if (previous.ownerId !== args.ownerId) continue;
    await ctx.db.patch(previous._id, { status: "superseded", updatedAt: now });
  }
  return await ctx.db.insert("decisions", {
    ownerId: args.ownerId,
    ...(args.savedNeedId !== undefined ? { savedNeedId: args.savedNeedId } : {}),
    ...(args.conversationId !== undefined ? { conversationId: args.conversationId } : {}),
    kind: args.kind, status: "open", question: args.question,
    ...(args.detail !== undefined ? { detail: args.detail.slice(0, 20_000) } : {}),
    options: args.options, refs: args.refs,
    ...(args.threadMessageId !== undefined ? { threadMessageId: args.threadMessageId } : {}),
    createdAt: now, updatedAt: now,
  });
}

/** Records the answer on one open decision. Returns false when it was not open. */
export async function markAnswered(
  ctx: MutationCtx,
  decision: Doc<"decisions">,
  answer: { choice: string; text?: string },
): Promise<boolean> {
  if (decision.status !== "open") return false;
  const now = Date.now();
  await ctx.db.patch(decision._id, {
    status: "answered",
    answer: { choice: answer.choice, ...(answer.text !== undefined ? { text: answer.text.slice(0, 4_000) } : {}), at: now },
    updatedAt: now,
  });
  return true;
}

/** Answers every open decision that references the given request (legacy UI decision, expiry). */
export async function answerDecisionsForRequest(
  ctx: MutationCtx,
  requestId: Id<"actionRequests">,
  answer: { choice: string; text?: string },
): Promise<number> {
  const rows = await ctx.db.query("decisions").withIndex("by_request", (q) => q.eq("refs.requestId", requestId)).take(20);
  let count = 0;
  for (const row of rows) if (await markAnswered(ctx, row, answer)) count += 1;
  return count;
}

/** Answers open decisions of the owner matching a predicate (offer reviewed, portal run finished). */
export async function answerOpenDecisions(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  matches: (row: Doc<"decisions">) => boolean,
  answer: { choice: string; text?: string },
): Promise<number> {
  const rows = await ctx.db.query("decisions").withIndex("by_owner_and_status", (q) =>
    q.eq("ownerId", ownerId).eq("status", "open"),
  ).take(50);
  let count = 0;
  for (const row of rows) if (matches(row) && await markAnswered(ctx, row, answer)) count += 1;
  return count;
}

/** Raises the human_step Entscheidung for a portal registration that needs the musician. */
export async function raiseHumanStep(ctx: MutationCtx, args: {
  ownerId: Id<"users">;
  runId: Id<"browserRuns">;
  connectionId: Id<"portalConnections">;
  browserProvider: "firecrawl" | "browserbase";
}): Promise<Id<"decisions">> {
  return await raiseDecision(ctx, {
    ownerId: args.ownerId, kind: "human_step", question: HUMAN_STEP_QUESTION,
    ...(args.browserProvider === "firecrawl" ? { detail: HUMAN_STEP_DETAIL_FIRECRAWL } : {}),
    options: [], refs: { runId: args.runId, connectionId: args.connectionId },
  });
}
