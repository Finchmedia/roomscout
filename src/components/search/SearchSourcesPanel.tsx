import { ExternalLink, Link2, ShieldAlert } from "lucide-react";
import type { SearchSourceCoverage } from "../../features/agentOperations/types";
import { EmptyState, LedgerCard } from "../ui/LedgerCard";
import { CoverageTrustNotice } from "../coverage/CoverageTrustNotice";

type SearchSourcesPanelProps = {
  city: string;
  sources: SearchSourceCoverage[];
  indexedSignalCount: number;
  indexedSourceCount: number;
  disclosure?: string;
  onScopeChange?: (sourceId: string, included: boolean) => void;
  onConnect?: (sourceId: string) => void;
};

const statusLabels: Record<SearchSourceCoverage["status"], string> = {
  watching: "Watching",
  partial: "Partial coverage",
  connection_required: "Connection required",
  under_review: "Under review",
  unavailable: "Unavailable",
};

export function SearchSourcesPanel({ city, sources, indexedSignalCount, indexedSourceCount, disclosure, onScopeChange, onConnect }: SearchSourcesPanelProps) {
  const watching = sources.filter((source) => source.status === "watching").length;
  const gaps = sources.filter((source) => source.status !== "watching").length;

  return (
    <div className="stack">
      <CoverageTrustNotice />
      <LedgerCard accent header={<><span className="type t-scout">Coverage for {city || "this search"}</span><span className="mono">Live index evidence</span></>}>
        <div className="rs-coverage-metrics">
          <div><strong>{indexedSignalCount}</strong><span>observed signals</span></div>
          <div><strong>{indexedSourceCount}</strong><span>evidence sources</span></div>
          <div><strong>{watching}</strong><span>watching this search</span></div>
          <div><strong>{gaps}</strong><span>known gaps</span></div>
        </div>
        <p className="hint">Source inclusion is a search preference. Global monitoring, policy review, and extraction health remain operator-controlled.</p>
        {disclosure ? <p className="hint">{disclosure}</p> : null}
      </LedgerCard>

      {sources.length === 0 ? (
        <EmptyState
          body="RoomScout has indexed market evidence for this search, but no user-visible source coverage records are available yet. It will not invent a source list from aggregate counts."
          title="Source-level coverage is not available yet"
        />
      ) : sources.map((source) => (
        <LedgerCard
          footer={<><span className="mono">{source.lastCheckedLabel ?? "No successful check recorded"}</span><span className="mono">{source.signalCount ?? 0} relevant signals</span></>}
          header={<><span className="type">{source.name}</span><span className={`pill ${source.status === "watching" ? "new" : source.status === "unavailable" ? "warn" : ""}`}>{statusLabels[source.status]}</span></>}
          key={source.id}
        >
          <div className="rs-source-coverage-row">
            <div>
              <a href={`https://${source.domain}`} rel="noreferrer" target="_blank">{source.domain}<ExternalLink aria-hidden="true" size={12} /></a>
              <p>{source.note ?? `${source.side} · ${source.access} access`}</p>
            </div>
            <div className="actionsrow">
              {source.status === "connection_required" ? (
                <button className="btn btn-s btn-sm" disabled={!onConnect} onClick={() => onConnect?.(source.id)} type="button"><Link2 aria-hidden="true" size={13} />Connect</button>
              ) : null}
              <button
                aria-pressed={source.included}
                className={`btn btn-sm ${source.included ? "btn-s" : "btn-g"}`}
                disabled={!onScopeChange || source.status === "unavailable"}
                onClick={() => onScopeChange?.(source.id, !source.included)}
                type="button"
              >
                {source.status === "unavailable" ? <ShieldAlert aria-hidden="true" size={13} /> : null}
                {source.included ? "Included" : "Excluded"}
              </button>
            </div>
          </div>
        </LedgerCard>
      ))}
    </div>
  );
}
