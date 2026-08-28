import { Check, Copy, EyeOff, Pencil, X } from "lucide-react";
import { useState } from "react";
import { WorkspaceShell } from "../../components/navigation/WorkspaceShell";
import { FixtureNotice, PageHeader } from "../../components/ui/LedgerCard";
import { demoNewSignal, demoReviewCandidates } from "../../mocks/demoData";

const filters = ["Needs review", "New", "Changed", "Possible duplicate", "Published", "Suppressed"];

export function OpsSignalsPage() {
  const [selectedId, setSelectedId] = useState<string | undefined>(demoReviewCandidates[0]?.id);
  const [activeFilter, setActiveFilter] = useState("Needs review");
  const selected = demoReviewCandidates.find((candidate) => candidate.id === selectedId);
  const [resolution, setResolution] = useState<string>();

  return (
    <WorkspaceShell mode="ops">
      <PageHeader meta={<span className="rs-page-meta"><FixtureNotice /><span className="mono">Healthy records may publish automatically</span></span>} title="Signal review" />
      <div className="filters rs-ops-filters">
        {filters.map((filter) => <button aria-pressed={activeFilter === filter} className={`fchip${activeFilter === filter ? " on" : ""}`} key={filter} onClick={() => setActiveFilter(filter)} type="button">{filter}</button>)}
        <label className="sr-only" htmlFor="ops-source-filter">Source</label>
        <select className="select" defaultValue="all" id="ops-source-filter"><option value="all">All sources</option><option value="musikboard">Musikboard Süd</option><option value="musikerboerse">Musikerbörse</option></select>
      </div>
      <div className="lcard rs-review-table-wrap">
        <table className="q rs-review-table">
          <thead><tr><th>Candidate</th><th>Side</th><th>Source</th><th>Reason</th><th>Age</th></tr></thead>
          <tbody>
            {demoReviewCandidates.map((candidate) => (
              <tr className={`row${candidate.id === selectedId ? " sel" : ""}`} key={candidate.id}>
                <td><button className="rs-table-row-button" onClick={() => { setSelectedId(candidate.id); setResolution(undefined); }} type="button"><strong>{candidate.title}</strong><span className="mono">{candidate.subtitle}</span></button></td>
                <td><span className={`pill ${candidate.side === "supply" ? "new" : ""}`}>{candidate.side}</span></td>
                <td>{candidate.source}</td><td><span className={`pill ${candidate.tone === "warning" ? "warn" : candidate.tone === "new" ? "new" : ""}`}>{candidate.reason}</span></td><td className="mono">{candidate.age}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <aside aria-label="Signal review detail" className={`drawer${selected ? " open" : ""}`}>
        <header className="dhead"><h2>{selected?.title ?? "Review candidate"}</h2><button aria-label="Close review drawer" className="xbtn" onClick={() => setSelectedId(undefined)} type="button"><X aria-hidden="true" size={18} /></button></header>
        {selected ? <div className="dbody">
          <section><h3>Extracted fields</h3><table className="facts"><tbody>{demoNewSignal.facts.map((fact) => <tr key={fact.label}><td>{fact.label}</td><td className={fact.unknown ? "unknown" : undefined}>{fact.value}</td></tr>)}</tbody></table></section>
          <section><h3>Source excerpt · prototype fixture</h3><blockquote className="evidence">Biete: Raum-Sharing in Stuttgart-Süd. <mark>240€/Monat</mark>, Mo+Mi+Fr frei. <mark>Schlagzeug vorhanden und erlaubt</mark>.</blockquote></section>
          <section><h3>Review impact</h3><p>Publishing would make this evidence-backed example visible in the musician views. The fixture does not represent a live listing.</p></section>
          {resolution ? <p aria-live="polite" className="fitline">Prototype resolution: {resolution}. No backend state changed.</p> : null}
        </div> : null}
        {selected ? <footer className="dfoot">
          <button className="btn btn-p" onClick={() => setResolution("accepted for publish")} type="button"><Check aria-hidden="true" size={14} />Accept</button>
          <button className="btn btn-s" onClick={() => setResolution("edit requested")} type="button"><Pencil aria-hidden="true" size={14} />Edit fields</button>
          <button className="btn btn-s" onClick={() => setResolution("marked as duplicate")} type="button"><Copy aria-hidden="true" size={14} />Duplicate</button>
          <button className="btn btn-g" onClick={() => setResolution("suppression reason required")} type="button"><EyeOff aria-hidden="true" size={14} />Suppress</button>
        </footer> : null}
      </aside>
    </WorkspaceShell>
  );
}
