import { ShieldCheck } from "lucide-react";
import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { WorkspaceShell } from "../../components/navigation/WorkspaceShell";
import { EmptyState, LedgerCard, PageHeader } from "../../components/ui/LedgerCard";
import { Table, TableBody, TableCell, TableRow } from "../../components/ui/table";
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
              <Table className="facts"><TableBody>
                <TableRow><TableCell>Owner</TableCell><TableCell>{selected.ownerName}</TableCell></TableRow>
                <TableRow><TableCell>From</TableCell><TableCell>{selected.senderAddressMasked ?? "Mailbox not provisioned"}</TableCell></TableRow>
                <TableRow><TableCell>Search</TableCell><TableCell>{selected.needTitle}</TableCell></TableRow>
                <TableRow><TableCell>Signal</TableCell><TableCell>{selected.signalTitle}</TableCell></TableRow>
                <TableRow><TableCell>Subject</TableCell><TableCell>{selected.subject}</TableCell></TableRow>
                <TableRow><TableCell>Status</TableCell><TableCell>{titleCase(selected.status)}</TableCell></TableRow>
                <TableRow><TableCell>Delivery</TableCell><TableCell>{selected.deliveryStatus ? titleCase(selected.deliveryStatus) : "Not sent"}</TableCell></TableRow>
                <TableRow><TableCell>Content fingerprint</TableCell><TableCell><span className="mono">{selected.contentHashPrefix}…</span></TableCell></TableRow>
                <TableRow><TableCell>Approved</TableCell><TableCell>{formatAge(selected.approvedAt)}</TableCell></TableRow>
                <TableRow><TableCell>Sent</TableCell><TableCell>{formatAge(selected.sentAt)}</TableCell></TableRow>
              </TableBody></Table>
              {selected.error ? <p className="fitline">{selected.error}</p> : null}
              <p className="fitline"><ShieldCheck aria-hidden="true" size={15} /> The exact recipient, subject, body, content version, and hash are rechecked by the backend before an approved send. Message bodies stay out of this aggregate Ops query.</p>
            </LedgerCard>
          ) : null}
        </div>
      )}
    </WorkspaceShell>
  );
}
