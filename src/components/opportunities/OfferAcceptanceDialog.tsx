import { useMutation, useQuery } from "convex/react";
import { useEffect, useId, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

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
    return "Das Angebot oder die Nachricht hat sich geändert. Es wurde nichts gesendet. Schließe diese Prüfung und beginne erneut mit dem aktuellen Angebot.";
  }
  if (error.message.includes("EXPIRED")) return "Diese Freigabe ist abgelaufen. Es wurde nichts gesendet.";
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
  const pending = descriptor ? ["approved", "queued", "executing"].includes(descriptor.status) : false;
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
      setSubmitFailure({ snapshotKey, message: errorMessage(cause, "Die Annahme konnte nicht freigegeben werden. Es wurde nichts gesendet.") });
    } finally {
      setWorking(false);
    }
  }

  return <Dialog onOpenChange={handleOpenChange} open={open}>
    <DialogContent tone="dialog" size="md" className="max-w-[720px]" aria-describedby={undefined}>
      <DialogHeader>
        <DialogTitle>Angebot verbindlich annehmen</DialogTitle>
        <DialogDescription>
          Prüfe Empfänger, Absender und Nachricht genau. Erst nach deiner Freigabe darf RoomScout diese Annahme einmal senden.
        </DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 flex-col gap-[var(--space-7)] text-left text-[length:var(--text-body-sm-size)] leading-[var(--text-body-leading)]">
      {loading ? <p role="status" className="text-rs-ink-4">Die genaue Annahme wird vorbereitet …</p> : null}
      {error ? <p className="rs-form-error" role="alert">{error}</p> : null}
      {!loading && !error && !descriptor ? <p className="text-rs-red-text" role="alert">Diese Annahme ist nicht verfügbar. Es wurde nichts gesendet.</p> : null}
      {descriptor ? <>
        {!descriptor.current && !pending && !alreadySent ? <p className="rounded-control-lg border border-rs-border-amber bg-rs-surface-amber-tint px-[var(--space-7)] py-[var(--space-4)] text-rs-ink" role="alert">Diese Prüfung ist nicht mehr aktuell, weil sich Angebot, Suche oder Gespräch geändert haben. Es wurde nichts gesendet.</p> : null}
        {expiredAtOpen && !pending && !alreadySent ? <p className="rounded-control-lg border border-rs-border-amber bg-rs-surface-amber-tint px-[var(--space-7)] py-[var(--space-4)] text-rs-ink" role="alert">Diese Freigabe ist abgelaufen. Es wurde nichts gesendet.</p> : null}
        {failed ? <p className="rounded-control-lg border border-rs-border-amber bg-rs-surface-amber-tint px-[var(--space-7)] py-[var(--space-4)] text-rs-ink" role="alert">Die Annahme ist fehlgeschlagen und wurde nicht als gesendet bestätigt. Diese genaue Anfrage kann nicht erneut freigegeben werden.</p> : null}
        {pending ? <p role="status" className="rounded-control-lg border border-rs-border-amber bg-rs-surface-amber-tint px-[var(--space-7)] py-[var(--space-4)]">Annahme freigegeben. Die Zustellung wird noch geprüft; das bestätigt noch keinen Versand.</p> : null}
        {alreadySent ? <p role="status" className="rounded-control-lg border border-rs-border-card-soft bg-rs-surface-subtle px-[var(--space-7)] py-[var(--space-4)]">Annahme gesendet.</p> : null}
        <section aria-label="Angenommene Angebotsbedingungen" className="rounded-card border border-rs-border-card-soft bg-rs-surface-subtle p-[var(--space-7)]">
          <h3 className="text-[length:var(--text-body-lg-size)] font-medium text-rs-ink">Dieses Angebot wird angenommen</h3>
          <p className="mt-[var(--space-3)] text-rs-ink-3">{descriptor.assessment.summary}</p>
          <dl className="mt-[var(--space-6)] divide-y divide-rs-border-divider">
            <div className="grid gap-[var(--space-2)] py-[var(--space-4)] sm:grid-cols-[10rem_1fr]"><dt className="text-rs-ink-6">Monatlich gesamt</dt><dd>{descriptor.assessment.monthlyPrice.totalEur === null ? "Nicht bestätigt" : `${descriptor.assessment.monthlyPrice.totalEur} €`} · {descriptor.assessment.monthlyPrice.allRecurringCostsKnown ? "Alle laufenden Kosten genannt" : "Weitere Kosten können noch offen sein"}</dd></div>
            {descriptor.assessment.terms.map((term) => <div className="grid gap-[var(--space-2)] py-[var(--space-4)] sm:grid-cols-[10rem_1fr]" key={term.key}><dt className="text-rs-ink-6">{term.label}</dt><dd>{term.value}</dd></div>)}
          </dl>
        </section>
        <section aria-label="Genaue Nachricht" className="flex flex-col gap-[var(--space-5)]">
          {[
            ["Absender", descriptor.actingAs],
            ["Empfänger", descriptor.destination],
            ["Betreff", descriptor.subject || "(Kein Betreff)"],
          ].map(([label, value]) => <div key={label}><div className="text-[length:var(--text-micro-size)] font-medium tracking-[var(--text-overline-tracking)] text-rs-ink-6 uppercase">{label}</div><div className="mt-[var(--space-2)] rounded-control border border-rs-border-control bg-rs-surface-inset px-[var(--space-5)] py-[var(--space-4)] text-rs-ink">{value}</div></div>)}
          <div><div className="text-[length:var(--text-micro-size)] font-medium tracking-[var(--text-overline-tracking)] text-rs-ink-6 uppercase">Genaue Nachricht</div><p className="mt-[var(--space-2)] whitespace-pre-wrap rounded-control border border-rs-border-control bg-rs-surface-inset px-[var(--space-5)] py-[var(--space-4)] text-rs-ink">{descriptor.body}</p></div>
        </section>
        <p className="text-[length:var(--text-caption-sm-size)] text-rs-ink-6">RoomScout sendet nur diese geprüfte Plattformnachricht an roomscout.dev. Damit wird kein Vertrag unterschrieben, kein Raum gebucht und keine Zahlung ausgelöst.</p>
        <label className="flex cursor-pointer items-start gap-[var(--space-4)] rounded-control-lg border border-rs-border-accent-soft bg-rs-rust-faint p-[var(--space-6)]" htmlFor={acknowledgementId}>
          <input className="mt-[var(--space-1)] size-[var(--space-7)] accent-rs-orange" checked={acknowledged} disabled={!reviewable} id={acknowledgementId} onChange={(event) => setAcknowledgedSnapshotKey(event.target.checked ? snapshotKey : "")} type="checkbox" />
          <span>Ich habe diese genauen Bedingungen, Absender, Empfänger, Betreff und Nachricht geprüft. RoomScout darf diese Annahme einmal senden.</span>
        </label>
      </> : null}
      {submitError ? <p className="text-rs-red-text" role="alert">{submitError}</p> : null}
      </div>

      <DialogFooter>
        <Button variant="secondary" size="sm" onClick={() => handleOpenChange(false)} type="button">Abbrechen</Button>
        <Button size="sm" disabled={!acknowledged || !reviewable || working} onClick={() => void approve()} type="button">
          {working ? "Wird freigegeben …" : "Freigeben und Annahme senden"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
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
      if (active) setPrepareError(errorMessage(cause, "Die Annahme konnte nicht vorbereitet werden. Es wurde nichts gesendet."));
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
