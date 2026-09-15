import { useState } from "react";
import type { FunctionReturnType } from "convex/server";
import { Link } from "react-router-dom";
import type { api } from "../../../convex/_generated/api";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Overline } from "../ui/overline";
import { useCopy } from "../../ui/copy";
import { formatMessageStamp } from "../../ui/copy/format";
import { PhotoPlaceholder } from "../../ui/scout/stages/PhotoPlaceholder";
import { OfferAcceptanceFlow } from "./OfferAcceptanceDialog";

type Conversation = FunctionReturnType<typeof api.providerConversations.listMine>[number];

/**
 * How long „unknown“ is still the delivery confirming itself. The acceptance
 * runs through a browser session whose receipt can lag; inside this window the
 * card says the Versand is being confirmed, after it it says plainly that it is
 * not confirmed. RoomScout never resends on its own either way.
 */
const ACCEPTANCE_CONFIRM_WINDOW_MS = 3 * 60_000;

/**
 * Actual provider facts, presented with the design port's offer-card anatomy.
 *
 * `hideMessagesLink` drops the „Nachrichten ansehen“ link: inside Nachrichten
 * the card already sits on top of the conversation it would link to.
 *
 * `now` is the reference moment for every stamp and for the „unknown“ window.
 * It falls back to the mount moment so hosts that have no clock of their own
 * keep working; a host that already threads a `now` (the Nachrichten thread
 * does) passes it, and the render stays reproducible.
 */
export function LiveProviderOffer({ conversation, title, hideMessagesLink = false, now }: {
  conversation: Conversation; title?: string; hideMessagesLink?: boolean; now?: number;
}) {
  const { t, locale } = useCopy();
  // Read once, at mount: a `Date.now()` in the render body is impure, and a
  // host that needs the states to move with the clock threads its own `now`
  // (the Nachrichten thread does).
  const [mountedAt] = useState(() => Date.now());
  const reference = now ?? mountedAt;
  const [reviewing, setReviewing] = useState(false);
  const offer = conversation.offer;
  if (!offer) return <p role="status">{t("liveScout.replyDetail")}</p>;
  const { assessment } = offer;
  const pending = ["approved", "queued", "executing"].includes(conversation.acceptanceStatus ?? "");
  const unknown = conversation.acceptanceStatus === "unknown";
  const sent = conversation.acceptedOfferId === offer.offerId && conversation.acceptedAt !== undefined;
  const canReview = offer.current && offer.ready && Boolean(conversation.platformThreadId) && !pending && !unknown && !sent;
  const price = assessment.monthlyPrice.totalEur;
  const interim = !offer.ready && !sent;
  // `conversation.updatedAt` moves with the acceptance request, so it is the
  // moment the „unknown“ outcome was recorded — the only timestamp the query
  // hands out for it.
  const confirming = unknown && reference - conversation.updatedAt < ACCEPTANCE_CONFIRM_WINDOW_MS;
  const acceptanceState = <>
    {pending ? <p role="status" className="mt-[var(--space-6)]">{t("liveScout.pendingAcceptance")}</p> : null}
    {unknown ? (confirming
      ? <p role="status" className="mt-[var(--space-6)]">{t("liveScout.unknownAcceptance")}</p>
      : <p role="alert" className="mt-[var(--space-6)]">{t("liveScout.unconfirmedAcceptance")}</p>) : null}
    {conversation.acceptanceStatus === "failed" ? <p role="alert">{t("liveScout.failedAcceptance")}</p> : null}
    {sent && conversation.acceptedAt !== undefined
      ? <p role="status" className="mt-[var(--space-6)]">{t("liveScout.sentAcceptance", { time: formatMessageStamp(locale, conversation.acceptedAt, reference) })}</p>
      : null}
  </>;
  const messagesLink = hideMessagesLink ? null
    : <Link className="mt-[var(--space-5)] text-sm text-rs-ink-4 underline underline-offset-4" to="/app/inbox">{t("liveScout.viewMessages")}</Link>;
  const head = <>
    <Overline tone="accent">{t(interim ? "liveScout.interimLabel" : "liveScout.offerLabel")}</Overline>
    <h2 className="mt-[var(--space-8)] text-[length:var(--text-card-title-size)]">{title || t("liveScout.offerFallback")}</h2>
    <div className="mt-[var(--space-2)] text-[length:var(--text-price-size)] leading-[1.1]">
      {price === null ? t("liveScout.priceUnknown") : <>{new Intl.NumberFormat(locale === "en" ? "en-GB" : "de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(price)} <span className="text-[.6em] text-rs-ink-2">{t("liveScout.perMonth")}</span></>}
    </div>
    <p className="mt-[var(--space-2)] text-rs-ink-4">{t(assessment.monthlyPrice.allRecurringCostsKnown ? "liveScout.allIn" : "liveScout.extrasUnknown")}</p>
  </>;
  // While the Scout still clarifies, show a compact interim state instead of a full offer card.
  if (interim) return <Card size="xl" padding={0} className="w-full overflow-hidden text-left">
    <div className="grid min-[960px]:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <PhotoPlaceholder className="min-h-[200px] min-[960px]:min-h-[380px]">{t("liveScout.noPhoto")}</PhotoPlaceholder>
      <div className="flex min-w-0 flex-col justify-center px-[clamp(24px,3.4vw,56px)] py-[clamp(24px,3vw,44px)]">
        {head}
        {offer.blockers.length > 0 ? <div className="mt-[var(--space-8)]"><p className="text-rs-ink-2">{t("liveScout.clarifying")}</p><ul className="mt-[var(--space-3)] list-disc pl-[var(--space-9)] text-rs-ink-2">{offer.blockers.slice(0, 3).map((item, index) => <li key={index}>{item}</li>)}</ul></div> : null}
        {acceptanceState}
        {messagesLink}
      </div>
    </div>
  </Card>;
  return <Card size="xl" padding={0} className="w-full overflow-hidden text-left">
    <div className="grid min-[960px]:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <PhotoPlaceholder className="min-h-[200px] min-[960px]:min-h-[380px]">{t("liveScout.noPhoto")}</PhotoPlaceholder>
      <div className="flex min-w-0 flex-col justify-center px-[clamp(24px,3.4vw,56px)] py-[clamp(24px,3vw,44px)]">
        {head}
        <p className="mt-[var(--space-10)] leading-relaxed text-rs-ink-2">{assessment.summary}</p>
        {!offer.current && !sent ? <p role="status" className="mt-[var(--space-6)] text-rs-ink-4">{t("liveScout.changed")}</p> : null}
        {offer.blockers.length > 0 && !sent ? <div className="mt-[var(--space-6)]"><h3>{t("liveScout.openQuestions")}</h3><ul className="mt-[var(--space-3)] list-disc pl-[var(--space-9)] text-rs-ink-2">{offer.blockers.map((item, index) => <li key={index}>{item}</li>)}</ul></div> : null}
        <details className="mt-[var(--space-8)]">
          <summary className="cursor-pointer text-rs-ink-2">{t("liveScout.terms")}</summary>
          <dl className="mt-[var(--space-6)] grid gap-[var(--space-6)]">{assessment.terms.map(term => <div key={term.key}><dt className="text-sm text-rs-ink-6">{term.label}</dt><dd className="mt-[var(--space-1)]">{term.value}</dd></div>)}</dl>
        </details>
        {canReview ? <Button size="md" className="mt-[var(--space-11)] self-start" onClick={() => setReviewing(true)}>{t("liveScout.review")}</Button> : null}
        {acceptanceState}
        <p className="mt-[var(--space-6)] text-sm text-rs-ink-6">{t("liveScout.offerNote")}</p>
        {messagesLink}
      </div>
    </div>
    {reviewing ? <OfferAcceptanceFlow expectedOfferHash={offer.contentHash} offerId={offer.offerId} onOpenChange={setReviewing} /> : null}
  </Card>;
}
