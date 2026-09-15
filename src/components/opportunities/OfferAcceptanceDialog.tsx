import { useMutation, useQuery } from "convex/react";
import { useEffect, useId, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useCopy } from "../../ui/copy";
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

type AcceptanceErrorCopy = {
  changed: string;
  expired: string;
  fallback: string;
};

function errorMessage(error: unknown, copy: AcceptanceErrorCopy) {
  if (!(error instanceof Error)) return copy.fallback;
  if (error.message.includes("OFFER_CHANGED") || error.message.includes("ACCEPTANCE_CONTENT_CHANGED")) {
    return copy.changed;
  }
  if (error.message.includes("EXPIRED")) return copy.expired;
  return error.message || copy.fallback;
}

export function OfferAcceptanceDialog({ descriptor, error, loading = false, onApprove, onOpenChange, open }: OfferAcceptanceDialogProps) {
  const { locale, t } = useCopy();
  const acknowledgementId = useId();
  const [acknowledgedSnapshotKey, setAcknowledgedSnapshotKey] = useState("");
  const [openedAt] = useState(() => Date.now());
  const [working, setWorking] = useState(false);
  const [submitFailure, setSubmitFailure] = useState<{ snapshotKey: string; cause: unknown }>();
  const snapshotKey = descriptor
    ? `${descriptor.requestId}:${descriptor.contentVersion}:${descriptor.contentHash}:${descriptor.reviewContextHash}`
    : "no-snapshot";

  const acknowledged = acknowledgedSnapshotKey === snapshotKey;
  const submitError = submitFailure?.snapshotKey === snapshotKey
    ? errorMessage(submitFailure.cause, {
      changed: t("liveScout.acceptance.changed"),
      expired: t("liveScout.acceptance.expired"),
      fallback: t("liveScout.acceptance.approveError"),
    })
    : "";

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
      setSubmitFailure({ snapshotKey, cause });
    } finally {
      setWorking(false);
    }
  }

  return <Dialog onOpenChange={handleOpenChange} open={open}>
    <DialogContent tone="dialog" size="md" className="max-w-[720px]" aria-describedby={undefined}>
      <DialogHeader>
        <DialogTitle>{t("liveScout.acceptance.title")}</DialogTitle>
        <DialogDescription>
          {t("liveScout.acceptance.description")}
        </DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 flex-col gap-[var(--space-7)] text-left text-[length:var(--text-body-sm-size)] leading-[var(--text-body-leading)]">
      {loading ? <p role="status" className="text-rs-ink-4">{t("liveScout.acceptance.loading")}</p> : null}
      {error ? <p className="rs-form-error" role="alert">{error}</p> : null}
      {!loading && !error && !descriptor ? <p className="text-rs-red-text" role="alert">{t("liveScout.acceptance.unavailable")}</p> : null}
      {descriptor ? <>
        {!descriptor.current && !pending && !alreadySent ? <p className="rounded-control-lg border border-rs-border-amber bg-rs-surface-amber-tint px-[var(--space-7)] py-[var(--space-4)] text-rs-ink" role="alert">{t("liveScout.acceptance.stale")}</p> : null}
        {expiredAtOpen && !pending && !alreadySent ? <p className="rounded-control-lg border border-rs-border-amber bg-rs-surface-amber-tint px-[var(--space-7)] py-[var(--space-4)] text-rs-ink" role="alert">{t("liveScout.acceptance.expired")}</p> : null}
        {failed ? <p className="rounded-control-lg border border-rs-border-amber bg-rs-surface-amber-tint px-[var(--space-7)] py-[var(--space-4)] text-rs-ink" role="alert">{t("liveScout.acceptance.failed")}</p> : null}
        {pending ? <p role="status" className="rounded-control-lg border border-rs-border-amber bg-rs-surface-amber-tint px-[var(--space-7)] py-[var(--space-4)]">{t("liveScout.acceptance.pending")}</p> : null}
        {alreadySent ? <p role="status" className="rounded-control-lg border border-rs-border-card-soft bg-rs-surface-subtle px-[var(--space-7)] py-[var(--space-4)]">{t("liveScout.acceptance.sent")}</p> : null}
        <section aria-label={t("liveScout.acceptance.termsRegion")} className="rounded-card border border-rs-border-card-soft bg-rs-surface-subtle p-[var(--space-7)]">
          <h3 className="text-[length:var(--text-body-lg-size)] font-medium text-rs-ink">{t("liveScout.acceptance.termsTitle")}</h3>
          <p className="mt-[var(--space-3)] text-rs-ink-3">{descriptor.assessment.summary}</p>
          <dl className="mt-[var(--space-6)] divide-y divide-rs-border-divider">
            <div className="grid gap-[var(--space-2)] py-[var(--space-4)] sm:grid-cols-[10rem_1fr]"><dt className="text-rs-ink-6">{t("liveScout.acceptance.monthlyTotal")}</dt><dd>{descriptor.assessment.monthlyPrice.totalEur === null ? t("liveScout.acceptance.priceUnconfirmed") : new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(descriptor.assessment.monthlyPrice.totalEur)} · {t(descriptor.assessment.monthlyPrice.allRecurringCostsKnown ? "liveScout.acceptance.allCostsKnown" : "liveScout.acceptance.costsMayRemain")}</dd></div>
            {descriptor.assessment.terms.map((term) => <div className="grid gap-[var(--space-2)] py-[var(--space-4)] sm:grid-cols-[10rem_1fr]" key={term.key}><dt className="text-rs-ink-6">{term.label}</dt><dd>{term.value}</dd></div>)}
          </dl>
        </section>
        <section aria-label={t("liveScout.acceptance.messageRegion")} className="flex flex-col gap-[var(--space-5)]">
          {[
            [t("liveScout.acceptance.sender"), descriptor.actingAs],
            [t("liveScout.acceptance.recipient"), descriptor.destination],
            [t("liveScout.acceptance.subject"), descriptor.subject || t("liveScout.acceptance.noSubject")],
          ].map(([label, value]) => <div key={label}><div className="text-[length:var(--text-micro-size)] font-medium tracking-[var(--text-overline-tracking)] text-rs-ink-6 uppercase">{label}</div><div className="mt-[var(--space-2)] rounded-control border border-rs-border-control bg-rs-surface-inset px-[var(--space-5)] py-[var(--space-4)] text-rs-ink">{value}</div></div>)}
          <div><div className="text-[length:var(--text-micro-size)] font-medium tracking-[var(--text-overline-tracking)] text-rs-ink-6 uppercase">{t("liveScout.acceptance.exactMessage")}</div><p className="mt-[var(--space-2)] whitespace-pre-wrap rounded-control border border-rs-border-control bg-rs-surface-inset px-[var(--space-5)] py-[var(--space-4)] text-rs-ink">{descriptor.body}</p></div>
        </section>
        <p className="text-[length:var(--text-caption-sm-size)] text-rs-ink-6">{t("liveScout.acceptance.disclosure")}</p>
        <label className="flex cursor-pointer items-start gap-[var(--space-4)] rounded-control-lg border border-rs-border-accent-soft bg-rs-rust-faint p-[var(--space-6)]" htmlFor={acknowledgementId}>
          <input className="mt-[var(--space-1)] size-[var(--space-7)] accent-rs-orange" checked={acknowledged} disabled={!reviewable} id={acknowledgementId} onChange={(event) => setAcknowledgedSnapshotKey(event.target.checked ? snapshotKey : "")} type="checkbox" />
          <span>{t("liveScout.acceptance.acknowledgement")}</span>
        </label>
      </> : null}
      {submitError ? <p className="text-rs-red-text" role="alert">{submitError}</p> : null}
      </div>

      <DialogFooter>
        <Button variant="secondary" size="sm" onClick={() => handleOpenChange(false)} type="button">{t("liveScout.acceptance.cancel")}</Button>
        <Button size="sm" disabled={!acknowledged || !reviewable || working} onClick={() => void approve()} type="button">
          {t(working ? "liveScout.acceptance.approving" : "liveScout.acceptance.approve")}
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
  const { t } = useCopy();
  const [requestId, setRequestId] = useState<Id<"actionRequests">>();
  const [prepareFailure, setPrepareFailure] = useState<{ cause: unknown }>();
  const prepare = useMutation(api.offerAcceptance.prepare);
  const approveAndSend = useMutation(api.offerAcceptance.approveAndSend);
  const descriptor = useQuery(api.offerAcceptance.getMine, requestId ? { requestId } : "skip");

  useEffect(() => {
    let active = true;
    void prepare({ offerId, expectedOfferHash }).then((id) => {
      if (active) setRequestId(id);
    }).catch((cause) => {
      if (active) setPrepareFailure({ cause });
    });
    return () => { active = false; };
  }, [expectedOfferHash, offerId, prepare]);

  const prepareError = prepareFailure
    ? errorMessage(prepareFailure.cause, {
      changed: t("liveScout.acceptance.changed"),
      expired: t("liveScout.acceptance.expired"),
      fallback: t("liveScout.acceptance.prepareError"),
    })
    : "";

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
