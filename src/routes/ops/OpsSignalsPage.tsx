import { ExternalLink, X } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { WorkspaceShell } from "../../components/navigation/WorkspaceShell";
import { EmptyState, PageHeader } from "../../components/ui/LedgerCard";
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
          <table className="q rs-review-table">
            <thead><tr><th>Entry</th><th>Side</th><th>Source</th><th>Detail state</th><th>Last seen</th></tr></thead>
            <tbody>
              {entries.map((entry) => (
                <tr className={`row${entry._id === selected?._id ? " sel" : ""}`} key={entry._id}>
                  <td><button className="rs-table-row-button" onClick={() => setSelectedId(entry._id)} type="button"><strong>{entry.title}</strong><span className="mono">{entry.city ?? "Location not extracted"}</span></button></td>
                  <td><span className={`pill ${entry.side === "supply" ? "new" : ""}`}>{titleCase(entry.side)}</span></td>
                  <td>{entry.sourceName}</td>
                  <td><span className={`pill ${toneForStatus(entry.detailState)}`}>{titleCase(entry.detailState)}</span></td>
                  <td className="mono">{formatAge(entry.lastSeenAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
              <table className="facts"><tbody>
                <tr><td>Source</td><td>{selected.sourceName}</td></tr>
                <tr><td>Entry status</td><td>{titleCase(selected.status)}</td></tr>
                <tr><td>Detail state</td><td>{titleCase(selected.detailState)}</td></tr>
                <tr><td>Attempts</td><td>{selected.detailAttempts}</td></tr>
                <tr><td>Private contacts</td><td>{selected.contactDataPresent ? "Extracted into restricted storage" : "None detected"}</td></tr>
              </tbody></table>
              {selected.error ? <p className="fitline">{selected.error}</p> : null}
            </section>
            <section><h3>Redacted source excerpt</h3><blockquote className="evidence">{selected.excerpt || "No retained excerpt."}</blockquote></section>
            {selected.signal ? (
              <section>
                <h3>Canonical signal</h3>
                <table className="facts"><tbody>
                  <tr><td>Title</td><td>{selected.signal.title}</td></tr>
                  <tr><td>Arrangement</td><td>{titleCase(selected.signal.arrangement)}</td></tr>
                  <tr><td>Price</td><td>{selected.signal.priceEur === undefined ? "Unknown" : `€${selected.signal.priceEur} / ${selected.signal.pricePeriod ?? "unknown"}`}</td></tr>
                  <tr><td>Verification</td><td>{titleCase(selected.signal.verification)}</td></tr>
                  <tr><td>Requirements</td><td>{selected.signal.requirements.join(", ") || "None extracted"}</td></tr>
                  <tr><td>Unknowns</td><td>{selected.signal.unknowns.join(", ") || "None recorded"}</td></tr>
                </tbody></table>
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
