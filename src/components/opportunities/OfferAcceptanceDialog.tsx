import { useMutation, useQuery } from "convex/react";
import { useEffect, useId, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ActionDialog } from "../ui/ActionDialog";

export type OfferAcceptanceDescriptor = {
  requestId: Id<"actionRequests">;
  offerId: Id<"offerRevisions">;
  offerHash: string;
  offerRevision: number;
  contentVersion: number;
  contentHash: string;
  reviewContextHash: string;
  status: string;
  current: boolean;
  expiresAt: number;
  destination: string;
  actingAs: string;
  subject: string;
  body: string;
  assessment: {
    summary: string;
    monthlyPrice: { totalEur: number | null; allRecurringCostsKnown: boolean };
    terms: Array<{ key: string; label: string; value: string }>;
  };
};

type OfferAcceptanceDialogProps = {
  descriptor?: OfferAcceptanceDescriptor | null;
  error?: string;
  loading?: boolean;
  onApprove: (descriptor: OfferAcceptanceDescriptor) => Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

function errorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  if (error.message.includes("OFFER_CHANGED") || error.message.includes("ACCEPTANCE_CONTENT_CHANGED")) {
    return "The offer or acceptance message changed. Nothing was sent. Close this review and start again from the current offer.";
  }
  if (error.message.includes("EXPIRED")) return "This approval request expired. Nothing was sent.";
  return error.message || fallback;
}

export function OfferAcceptanceDialog({ descriptor, error, loading = false, onApprove, onOpenChange, open }: OfferAcceptanceDialogProps) {
  const acknowledgementId = useId();
  const [acknowledgedSnapshotKey, setAcknowledgedSnapshotKey] = useState("");
  const [openedAt] = useState(() => Date.now());
  const [working, setWorking] = useState(false);
  const [submitFailure, setSubmitFailure] = useState<{ snapshotKey: string; message: string }>();
  const snapshotKey = descriptor
    ? `${descriptor.requestId}:${descriptor.contentVersion}:${descriptor.contentHash}:${descriptor.reviewContextHash}`
    : "no-snapshot";

  const acknowledged = acknowledgedSnapshotKey === snapshotKey;
  const submitError = submitFailure?.snapshotKey === snapshotKey ? submitFailure.message : "";

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setAcknowledgedSnapshotKey("");
      setSubmitFailure(undefined);
    }
    onOpenChange(nextOpen);
  }

  const expiredAtOpen = descriptor ? descriptor.expiresAt <= openedAt : false;
  const alreadySent = descriptor?.status === "executed";
  const pending = descriptor ? ["approved", "executing"].includes(descriptor.status) : false;
  const failed = descriptor?.status === "failed";
  const reviewable = Boolean(descriptor?.current && descriptor.status === "awaiting_approval" && !expiredAtOpen);

  async function approve() {
    if (!descriptor || !acknowledged || !reviewable) return;
    setWorking(true);
    setSubmitFailure(undefined);
    try {
      await onApprove(descriptor);
    } catch (cause) {
      setAcknowledgedSnapshotKey("");
      setSubmitFailure({ snapshotKey, message: errorMessage(cause, "The acceptance could not be approved. Nothing was sent.") });
    } finally {
      setWorking(false);
    }
  }

  return <ActionDialog
    description={descriptor ? `Offer revision ${descriptor.offerRevision} · exact-once platform message` : "Preparing an exact acceptance for review"}
    footer={<>
      <button className="btn btn-g" onClick={() => handleOpenChange(false)} type="button">Cancel</button>
      <button className="btn btn-p" disabled={!acknowledged || !reviewable || working} onClick={() => void approve()} type="button">
        {working ? "Approving…" : "Approve and send acceptance"}
      </button>
    </>}
    onOpenChange={handleOpenChange}
    open={open}
    title="Review offer acceptance"
  >
    <div className="rs-approval-form">
      {loading ? <p role="status">Preparing the exact acceptance…</p> : null}
      {error ? <p className="rs-form-error" role="alert">{error}</p> : null}
      {!loading && !error && !descriptor ? <p className="rs-form-error" role="alert">This acceptance request is unavailable. Nothing was sent.</p> : null}
      {descriptor ? <>
        {!descriptor.current && !pending && !alreadySent ? <p className="rs-form-error" role="alert">This review is stale because the offer, search, or conversation changed. Nothing was sent.</p> : null}
        {expiredAtOpen && !pending && !alreadySent ? <p className="rs-form-error" role="alert">This approval request expired. Nothing was sent.</p> : null}
        {failed ? <p className="rs-form-error" role="alert">The acceptance failed and is not confirmed sent. This exact request cannot be approved again.</p> : null}
        {pending ? <p role="status">Acceptance approved. Delivery is still being checked; this does not yet confirm it was sent.</p> : null}
        {alreadySent ? <p role="status">Acceptance sent.</p> : null}
        <section aria-label="Offer terms">
          <h3>Offer being accepted</h3>
          <p>{descriptor.assessment.summary}</p>
          <dl>
            <div><dt>Monthly total</dt><dd>{descriptor.assessment.monthlyPrice.totalEur === null ? "Not confirmed" : `€${descriptor.assessment.monthlyPrice.totalEur}`} · {descriptor.assessment.monthlyPrice.allRecurringCostsKnown ? "All recurring costs stated" : "Additional costs may be unresolved"}</dd></div>
            {descriptor.assessment.terms.map((term) => <div key={term.key}><dt>{term.label}</dt><dd>{term.value}</dd></div>)}
          </dl>
        </section>
        <div><span className="flabel">Sending as</span><div className="mailbox">{descriptor.actingAs}</div></div>
        <div><span className="flabel">Destination</span><div className="mailbox">{descriptor.destination}</div></div>
        <div><span className="flabel">Subject</span><div className="mailbox">{descriptor.subject || "(No subject)"}</div></div>
        <div><span className="flabel">Exact message</span><p className="rs-provider-offer__prose">{descriptor.body}</p></div>
        <p className="mono">Controlled roomscout.dev platform message only. This does not sign an agreement, book a room, or make a payment.</p>
        <label className="ack" htmlFor={acknowledgementId}>
          <input checked={acknowledged} disabled={!reviewable} id={acknowledgementId} onChange={(event) => setAcknowledgedSnapshotKey(event.target.checked ? snapshotKey : "")} type="checkbox" />
          <span>I reviewed these exact terms, sender, destination, subject, and message. RoomScout may send this acceptance once.</span>
        </label>
      </> : null}
      {submitError ? <p className="rs-form-error" role="alert">{submitError}</p> : null}
    </div>
  </ActionDialog>;
}

type OfferAcceptanceFlowProps = {
  expectedOfferHash: string;
  offerId: Id<"offerRevisions">;
  onOpenChange: (open: boolean) => void;
};

export function OfferAcceptanceFlow({ expectedOfferHash, offerId, onOpenChange }: OfferAcceptanceFlowProps) {
  const [requestId, setRequestId] = useState<Id<"actionRequests">>();
  const [prepareError, setPrepareError] = useState("");
  const prepare = useMutation(api.offerAcceptance.prepare);
  const approveAndSend = useMutation(api.offerAcceptance.approveAndSend);
  const descriptor = useQuery(api.offerAcceptance.getMine, requestId ? { requestId } : "skip");

  useEffect(() => {
    let active = true;
    void prepare({ offerId, expectedOfferHash }).then((id) => {
      if (active) setRequestId(id);
    }).catch((cause) => {
      if (active) setPrepareError(errorMessage(cause, "The acceptance could not be prepared. Nothing was sent."));
    });
    return () => { active = false; };
  }, [expectedOfferHash, offerId, prepare]);

  return <OfferAcceptanceDialog
    descriptor={descriptor}
    error={prepareError}
    loading={!prepareError && (!requestId || descriptor === undefined)}
    onApprove={async (reviewed) => {
      await approveAndSend({
        acknowledged: true,
        expectedContentHash: reviewed.contentHash,
        expectedContentVersion: reviewed.contentVersion,
        expectedContextHash: reviewed.reviewContextHash,
        expectedOfferHash: reviewed.offerHash,
        offerId: reviewed.offerId,
        requestId: reviewed.requestId,
      });
      onOpenChange(false);
    }}
    onOpenChange={onOpenChange}
    open
  />;
}
