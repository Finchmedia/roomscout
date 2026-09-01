import { ExternalLink, X } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { WorkspaceShell } from "../../components/navigation/WorkspaceShell";
import { EmptyState, PageHeader } from "../../components/ui/LedgerCard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { formatAge, toneForStatus, titleCase } from "./opsFormat";

const filters = ["all", "failed", "queued", "fetching", "processed", "none"] as const;
type QueueFilter = (typeof filters)[number];

export function OpsSignalsPage() {
  const [activeFilter, setActiveFilter] = useState<QueueFilter>("all");
  const entries = useQuery(api.ops.listSignalQueue, { state: activeFilter, limit: 50 });
  const retrySourceEntry = useMutation(api.sourceRegistry.retrySourceEntry);
  const [retrying, setRetrying] = useState(false);
  const [retryMessage, setRetryMessage] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>();
  const selected = selectedId === null
    ? undefined
    : entries?.find((entry) => entry._id === selectedId) ?? entries?.[0];

  return (
    <WorkspaceShell mode="ops">
      <PageHeader
        meta={<span className="rs-page-meta"><span className="chip">Live detail pipeline</span><span className="mono">Contact values remain private</span></span>}
        title="Signal review"
      />
      <div className="filters rs-ops-filters">
        {filters.map((filter) => (
          <button
            aria-pressed={activeFilter === filter}
            className={`fchip${activeFilter === filter ? " on" : ""}`}
            key={filter}
            onClick={() => { setActiveFilter(filter); setSelectedId(undefined); }}
            type="button"
          >
            {filter === "none" ? "Not queued" : titleCase(filter)}
          </button>
        ))}
      </div>
      {entries === undefined ? (
        <EmptyState body="Reading the normalized source-entry pipeline." title="Loading signal queue…" />
      ) : entries.length === 0 ? (
        <EmptyState body="The selected pipeline state currently contains no entries." title="Queue is empty" />
      ) : (
        <div className="lcard rs-review-table-wrap">
          <Table className="q rs-review-table">
            <TableHeader><TableRow><TableHead>Entry</TableHead><TableHead>Side</TableHead><TableHead>Source</TableHead><TableHead>Detail state</TableHead><TableHead>Last seen</TableHead></TableRow></TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow className={`row${entry._id === selected?._id ? " sel" : ""}`} key={entry._id}>
                  <TableCell><button className="rs-table-row-button" onClick={() => setSelectedId(entry._id)} type="button"><strong>{entry.title}</strong><span className="mono">{entry.city ?? "Location not extracted"}</span></button></TableCell>
                  <TableCell><span className={`pill ${entry.side === "supply" ? "new" : ""}`}>{titleCase(entry.side)}</span></TableCell>
                  <TableCell>{entry.sourceName}</TableCell>
                  <TableCell><span className={`pill ${toneForStatus(entry.detailState)}`}>{titleCase(entry.detailState)}</span></TableCell>
                  <TableCell className="mono">{formatAge(entry.lastSeenAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <aside aria-label="Signal review detail" className={`drawer${selected ? " open" : ""}`}>
        <header className="dhead">
          <h2>{selected?.title ?? "Source entry"}</h2>
          <button aria-label="Close review drawer" className="xbtn" onClick={() => setSelectedId(null)} type="button"><X aria-hidden="true" size={18} /></button>
        </header>
        {selected ? (
          <div className="dbody">
            <section>
              <h3>Pipeline state</h3>
              <Table className="facts"><TableBody>
                <TableRow><TableCell>Source</TableCell><TableCell>{selected.sourceName}</TableCell></TableRow>
                <TableRow><TableCell>Entry status</TableCell><TableCell>{titleCase(selected.status)}</TableCell></TableRow>
                <TableRow><TableCell>Detail state</TableCell><TableCell>{titleCase(selected.detailState)}</TableCell></TableRow>
                <TableRow><TableCell>Attempts</TableCell><TableCell>{selected.detailAttempts}</TableCell></TableRow>
                <TableRow><TableCell>Private contacts</TableCell><TableCell>{selected.contactDataPresent ? "Extracted into restricted storage" : "None detected"}</TableCell></TableRow>
              </TableBody></Table>
              {selected.error ? <p className="fitline">{selected.error}</p> : null}
            </section>
            <section><h3>Redacted source excerpt</h3><blockquote className="evidence">{selected.excerpt || "No retained excerpt."}</blockquote></section>
            {selected.signal ? (
              <section>
                <h3>Canonical signal</h3>
                <Table className="facts"><TableBody>
                  <TableRow><TableCell>Title</TableCell><TableCell>{selected.signal.title}</TableCell></TableRow>
                  <TableRow><TableCell>Arrangement</TableCell><TableCell>{titleCase(selected.signal.arrangement)}</TableCell></TableRow>
                  <TableRow><TableCell>Price</TableCell><TableCell>{selected.signal.priceEur === undefined ? "Unknown" : `€${selected.signal.priceEur} / ${selected.signal.pricePeriod ?? "unknown"}`}</TableCell></TableRow>
                  <TableRow><TableCell>Verification</TableCell><TableCell>{titleCase(selected.signal.verification)}</TableCell></TableRow>
                  <TableRow><TableCell>Requirements</TableCell><TableCell>{selected.signal.requirements.join(", ") || "None extracted"}</TableCell></TableRow>
                  <TableRow><TableCell>Unknowns</TableCell><TableCell>{selected.signal.unknowns.join(", ") || "None recorded"}</TableCell></TableRow>
                </TableBody></Table>
                <p className="fitline">{selected.signal.summary}</p>
              </section>
            ) : <EmptyState body="Normalization has not produced a canonical signal for this entry." title="No canonical signal yet" />}
          </div>
        ) : null}
        {selected ? (
          <footer className="dfoot">
            <a className="btn btn-s" href={selected.detailUrl} rel="noreferrer" target="_blank">Open public source <ExternalLink aria-hidden="true" size={14} /></a>
            {selected.detailState === "failed" ? <button className="btn btn-p" disabled={retrying} onClick={() => {
              setRetrying(true);
              setRetryMessage("");
              void retrySourceEntry({ sourceEntryId: selected._id }).then(() => setRetryMessage("Retry queued with the bounded detail worker.")).catch((error: unknown) => setRetryMessage(error instanceof Error ? error.message : "Retry failed.")).finally(() => setRetrying(false));
            }} type="button">{retrying ? "Queuing…" : "Retry entry"}</button> : null}
            {retryMessage ? <span className="mono" role="status">{retryMessage}</span> : null}
          </footer>
        ) : null}
      </aside>
    </WorkspaceShell>
  );
}
