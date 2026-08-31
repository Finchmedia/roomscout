import { ShieldCheck } from "lucide-react";
import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { WorkspaceShell } from "../../components/navigation/WorkspaceShell";
import { EmptyState, LedgerCard, PageHeader } from "../../components/ui/LedgerCard";
import { formatAge, toneForStatus, titleCase } from "./opsFormat";

const filters = ["all", "awaiting_approval", "approved", "sending", "sent", "replied", "failed", "rejected"] as const;
type OutreachFilter = (typeof filters)[number];

export function OpsOutreachPage() {
  const [filter, setFilter] = useState<OutreachFilter>("all");
  const drafts = useQuery(api.ops.listOutreach, {
    status: filter === "all" ? undefined : filter,
    limit: 50,
  });
  const [selectedId, setSelectedId] = useState<string>();
  const selected = drafts?.find((draft) => draft._id === selectedId) ?? drafts?.[0];

  return (
    <WorkspaceShell mode="ops">
      <PageHeader
        meta={<span className="rs-page-meta"><span className="chip">Live approval ledger</span><span className="mono">Operators cannot approve for users</span></span>}
        title="Outreach control"
      />
      <div className="filters rs-ops-filters">
        {filters.map((item) => (
          <button
            aria-pressed={filter === item}
            className={`fchip${filter === item ? " on" : ""}`}
            key={item}
            onClick={() => { setFilter(item); setSelectedId(undefined); }}
            type="button"
          >
            {titleCase(item)}
          </button>
        ))}
      </div>
      {drafts === undefined ? (
        <EmptyState body="Reading approval, sending, and delivery state." title="Loading outreach…" />
      ) : drafts.length === 0 ? (
        <EmptyState body="No outreach drafts match this status. RoomScout never creates a send from this operator screen." title="No outreach records" />
      ) : (
        <div className="cols rs-outreach-layout">
          <LedgerCard header={<><span className="type">Approval and delivery queue</span><span className="mono">{drafts.length} records</span></>}>
            <div className="rs-queue-list">
              {drafts.map((draft) => (
                <button
                  className={`qrow rs-queue-button${draft._id === selected?._id ? " on" : ""}`}
                  key={draft._id}
                  onClick={() => setSelectedId(draft._id)}
                  type="button"
                >
                  <span className="t">{draft.subject}<span className="mono">{draft.ownerName} · {titleCase(draft.status)} · {formatAge(draft.updatedAt)}</span></span>
                  <span className={`pill ${toneForStatus(draft.deliveryStatus ?? draft.status)}`}>{titleCase(draft.deliveryStatus ?? draft.status)}</span>
                </button>
              ))}
            </div>
          </LedgerCard>
          {selected ? (
            <LedgerCard accent header={<><span className="type t-scout">Approval invariant</span><span className="mono">Version {selected.contentVersion}</span></>}>
              <div className="mailbox">{selected.recipientName} &lt;{selected.recipientEmailMasked}&gt;</div>
              <table className="facts"><tbody>
                <tr><td>Owner</td><td>{selected.ownerName}</td></tr>
                <tr><td>From</td><td>{selected.senderAddressMasked ?? "Mailbox not provisioned"}</td></tr>
                <tr><td>Search</td><td>{selected.needTitle}</td></tr>
                <tr><td>Signal</td><td>{selected.signalTitle}</td></tr>
                <tr><td>Subject</td><td>{selected.subject}</td></tr>
                <tr><td>Status</td><td>{titleCase(selected.status)}</td></tr>
                <tr><td>Delivery</td><td>{selected.deliveryStatus ? titleCase(selected.deliveryStatus) : "Not sent"}</td></tr>
                <tr><td>Content fingerprint</td><td><span className="mono">{selected.contentHashPrefix}…</span></td></tr>
                <tr><td>Approved</td><td>{formatAge(selected.approvedAt)}</td></tr>
                <tr><td>Sent</td><td>{formatAge(selected.sentAt)}</td></tr>
              </tbody></table>
              {selected.error ? <p className="fitline">{selected.error}</p> : null}
              <p className="fitline"><ShieldCheck aria-hidden="true" size={15} /> The exact recipient, subject, body, content version, and hash are rechecked by the backend before an approved send. Message bodies stay out of this aggregate Ops query.</p>
            </LedgerCard>
          ) : null}
        </div>
      )}
    </WorkspaceShell>
  );
}
