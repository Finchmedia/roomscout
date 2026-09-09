import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import type { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { OfferAcceptanceFlow } from "./OfferAcceptanceDialog";

type Conversation = FunctionReturnType<typeof api.providerConversations.listMine>[number] & {
  acceptanceStatus?: string;
  acceptanceRequestId?: Id<"actionRequests">;
  acceptedOfferId?: Id<"offerRevisions">;
  acceptedAt?: number;
};

export function ProviderOfferPanel({ conversation }: { conversation: Conversation }) {
  const [reviewingAcceptance, setReviewingAcceptance] = useState(false);
  const offer = conversation.offer;
  if (!offer) {
    return <section aria-label="Scout offer assessment" className="rs-provider-offer">
      <h2>Scout assessment</h2>
      <p role="status">{conversation.errorCode ? "The provider update could not be assessed yet. No reply has been sent." : "Your Scout is reviewing the provider's message against your search."}</p>
    </section>;
  }
  const { assessment } = offer;
  const acceptancePending = conversation.acceptanceStatus === "approved" || conversation.acceptanceStatus === "executing";
  const acceptanceSent = conversation.acceptedOfferId === offer.offerId && conversation.acceptedAt !== undefined;
  const canReviewAcceptance = offer.current && offer.ready && Boolean(conversation.platformThreadId) && !acceptancePending && !acceptanceSent;
  const replyLabel = conversation.replyStatus === "executed" ? "Reply · sent" :
    conversation.replyStatus === "executing" ? "Reply · delivery being checked" :
    conversation.replyStatus === "queued" ? "Reply · checking final text" :
    conversation.replyStatus === "approved" ? "Reply · authorized, awaiting delivery" :
    conversation.replyStatus === "awaiting_approval" ? "Reply · needs your review" :
    conversation.replyStatus === "failed" ? "Reply · failed; not confirmed sent" : "Suggested reply · not sent";
  return <section aria-label="Scout offer assessment" className="rs-provider-offer">
    <header><h2>Scout assessment</h2><span className="mono">Revision {offer.revision} · {acceptanceSent ? "Accepted offer" : !offer.current ? "Needs reassessment" : offer.ready ? "Ready for review" : "Open questions"}</span></header>
    <p>{assessment.summary}</p>
    {!offer.current && !acceptanceSent ? <p className="rs-provider-offer__notice" role="status">This assessment is out of date because the conversation, listing or your search changed.</p> : null}
    <dl>
      <div><dt>Availability</dt><dd>{assessment.availability.status}</dd></div>
      <div><dt>Monthly total</dt><dd>{assessment.monthlyPrice.totalEur === null ? "Not confirmed" : `€${assessment.monthlyPrice.totalEur}`} · {assessment.monthlyPrice.allRecurringCostsKnown ? "All recurring costs stated" : "Additional costs may be unresolved"}</dd></div>
      {assessment.terms.map((term) => <div key={term.key}><dt>{term.label}</dt><dd>{term.value}</dd></div>)}
    </dl>
    {offer.blockers.length && !acceptanceSent ? <div><h3>Still to resolve</h3><ul>{offer.blockers.map((blocker, index) => <li key={index}>{blocker}</li>)}</ul></div> : null}
    {assessment.suggestedReply ? <details><summary>{replyLabel}</summary><p><strong>{assessment.suggestedReply.subject}</strong></p><p className="rs-provider-offer__prose">{assessment.suggestedReply.body}</p></details> : null}
    <details><summary>Evidence behind this assessment</summary>
      {assessment.constraints.map((constraint) => <div key={constraint.key}>
        <p><strong>{constraint.verdict}</strong> · {constraint.explanation}</p>
        {constraint.evidence.map((item, index) => <blockquote key={index}>{item.quote}</blockquote>)}
      </div>)}
      {assessment.availability.evidence.map((item, index) => <blockquote key={`availability-${index}`}>{item.quote}</blockquote>)}
    </details>
    {acceptanceSent ? <p className="rs-provider-offer__notice" role="status">Acceptance sent · search paused. This does not confirm a booking, signature, or payment.</p> : null}
    {acceptancePending ? <p className="rs-provider-offer__notice" role="status">Acceptance approved. Delivery is still being checked; it is not yet confirmed sent.</p> : null}
    {conversation.acceptanceStatus === "failed" ? <p className="rs-provider-offer__notice" role="status">Acceptance failed and is not confirmed sent.</p> : null}
    {canReviewAcceptance ? <button className="btn btn-p" onClick={() => setReviewingAcceptance(true)} type="button">Review acceptance</button> : null}
    <p className="rs-provider-offer__notice">An assessment is not a booking or acceptance. Any final commitment needs your exact approval.</p>
    {reviewingAcceptance ? <OfferAcceptanceFlow expectedOfferHash={offer.contentHash} offerId={offer.offerId} onOpenChange={setReviewingAcceptance} /> : null}
  </section>;
}
