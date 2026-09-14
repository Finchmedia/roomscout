import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { messageSafetyContext } from "./messageSafety";
import { offerReadiness } from "./providerAssessment";
import { signalMatchRevision } from "./matchValidity";
import { portalDestinationHash, resolveControlledPortal } from "./providerPortal";

export async function currentAcceptableOffer(ctx: QueryCtx, ownerId: Id<"users">, offerId: Id<"offerRevisions">) {
  const offer = await ctx.db.get(offerId);
  if (!offer || offer.ownerId !== ownerId) throw new ConvexError({ code: "OFFER_NOT_FOUND" });
  const conversation = await ctx.db.get(offer.conversationId);
  const [need, signal, event] = await Promise.all([
    ctx.db.get(offer.savedNeedId), conversation ? ctx.db.get(conversation.signalId) : null, ctx.db.get(offer.eventId),
  ]);
  if (!conversation || conversation.ownerId !== ownerId || conversation.state === "closed" || conversation.acceptedOfferId ||
    conversation.currentOfferId !== offerId || conversation.revision !== offer.revision || conversation.activeEventId ||
    event?.status !== "completed" || !need || need.ownerId !== ownerId || need.status !== "active" ||
    (need.matchingRevision ?? 0) !== offer.needRevision || !signal || !["published", "stale"].includes(signal.status) ||
    await signalMatchRevision(signal) !== offer.signalRevision) throw new ConvexError({ code: "OFFER_CHANGED" });
  if (!offer.ready || !offerReadiness(offer.assessment, need).ready) throw new ConvexError({ code: "OFFER_NOT_READY" });
  return { offer, conversation, need, signal };
}

/** Reused by review, approval and the final pre-click executor gate. */
export async function assertAcceptanceCurrent(ctx: QueryCtx, request: Doc<"actionRequests">) {
  if (request.providerActionKind !== "acceptance" || !request.providerOfferId || !request.reviewContextHash ||
    request.automationMode !== "exact_once") throw new ConvexError({ code: "ACCEPTANCE_REVIEW_REQUIRED" });
  const current = await currentAcceptableOffer(ctx, request.ownerId, request.providerOfferId);
  const target = await resolveControlledPortal(ctx, current.conversation, current.signal, request.updatedAt);
  if (!target || !request.reviewDestinationHash || request.reviewDestinationHash !== await portalDestinationHash(target)) {
    throw new ConvexError({ code: "ACCEPTANCE_DESTINATION_CHANGED" });
  }
  if (request.providerOfferHash !== current.offer.contentHash || request.providerConversationId !== current.conversation._id ||
    request.reviewContextHash !== (await messageSafetyContext(ctx, request))?.snapshotHash) throw new ConvexError({ code: "ACCEPTANCE_CONTEXT_CHANGED" });
  return current;
}

export function acceptanceMessage(offer: Doc<"offerRevisions">, title: string) {
  const assessment = offer.assessment;
  const subject = `Zusage: ${title}`.slice(0, 200);
  const body = [
    `Hallo, wir nehmen das Angebot für „${title}“ zu den folgenden bestätigten Konditionen an:`,
    `Monatliche Gesamtkosten: ${assessment.monthlyPrice.totalEur} € pro Monat, inklusive aller genannten laufenden Kosten.`,
    ...assessment.terms.map((term) => `${term.label}: ${term.value}`),
    ...assessment.constraints.filter((item) => item.key !== "budget").map((item) => `Bestätigte Bedingung: ${item.explanation}`),
    "", "Dies ist eine Bestätigung aus der RoomScout-Demo. Mit dieser Nachricht wird keine Zahlung geleistet und kein Vertrag unterschrieben.",
  ].join("\n");
  if (body.length > 20_000) throw new ConvexError({ code: "ACCEPTANCE_MESSAGE_TOO_LONG" });
  return { subject, body };
}
