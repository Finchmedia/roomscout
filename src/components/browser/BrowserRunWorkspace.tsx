import { CircleStop, Hand, Play, RotateCcw, ShieldAlert } from "lucide-react";
import type { BrowserRun } from "../../features/agentOperations/types";
import { EmptyState, LedgerCard } from "../ui/LedgerCard";

type BrowserRunWorkspaceProps = {
  run: BrowserRun | null;
  onTakeControl?: () => void;
  onReturnControl?: () => void;
  onStop?: () => void;
  onRetry?: () => void;
  browserProvider?: "firecrawl" | "browserbase";
  providerMismatch?: boolean;
};

export function BrowserRunWorkspace({ run, onTakeControl, onReturnControl, onStop, onRetry, browserProvider = "browserbase", providerMismatch = false }: BrowserRunWorkspaceProps) {
  if (!run) {
    return <EmptyState body="No authorized browser session was found. RoomScout does not create a fake Live View when no provider session exists." title="Browser run unavailable" />;
  }

  const needsHuman = run.state === "human_required";
  const humanControlling = run.state === "human_controlling";
  const failed = run.state === "failed";

  return (
    <div className="rs-browser-run">
      <header className="rs-browser-run__bar">
        <div><span className="type t-scout">Scout run · {run.sourceName}</span><h1>{run.searchTitle}</h1><span className="mono">{browserProvider === "firecrawl" ? "Firecrawl" : "Browserbase"} · {run.sourceDomain ? `${run.sourceDomain} · ` : ""}{run.mandateLabel}</span></div>
        <div className="actionsrow"><span className={`pill ${needsHuman || failed ? "warn" : "new"}`}>{run.state.replaceAll("_", " ")}</span><button className="btn btn-g btn-sm" disabled={!onStop} onClick={onStop} type="button"><CircleStop aria-hidden="true" size={14} />Stop run</button></div>
      </header>

      {needsHuman || humanControlling ? (
        <div className="rs-human-takeover"><ShieldAlert aria-hidden="true" size={17} /><div><strong>{needsHuman ? "Scout needs you" : "You have control"}</strong><p>{run.humanPrompt ?? "Complete the human-only step. The Scout remains paused until you explicitly return control."}</p></div></div>
      ) : null}
      {providerMismatch ? <p className="rs-form-error" role="alert">This run belongs to a different portal provider. Reconnect the portal before starting new work; this run cannot be resumed.</p> : null}

      <div className="rs-browser-run__grid">
        <section className="rs-live-view">
          {run.liveViewUrl ? (
            <iframe allow="clipboard-read; clipboard-write" referrerPolicy="no-referrer" src={run.liveViewUrl} title={`Live browser session for ${run.sourceName}`} />
          ) : <EmptyState body="The run exists, but no provider Live View URL is available. The Scout remains unable to claim browser progress visually." title="Live View not connected" />}
        </section>
        <LedgerCard className="rs-run-rail" header={<span className="type">Run plan</span>}>
          <ol>{run.steps.map((step) => <li className={`rs-run-step rs-run-step--${step.state}`} key={step.id}><span />{step.label}</li>)}</ol>
          <div className="rs-run-controls">
            {needsHuman && onTakeControl ? <button className="btn btn-p" onClick={onTakeControl} type="button"><Hand aria-hidden="true" size={14} />Take control</button> : null}
            {humanControlling ? <button className="btn btn-p" disabled={!onReturnControl} onClick={onReturnControl} type="button"><Play aria-hidden="true" size={14} />Return control to Scout</button> : null}
            {(failed || (needsHuman && !onTakeControl)) ? <button className="btn btn-s" disabled={!onRetry} onClick={onRetry} type="button"><RotateCcw aria-hidden="true" size={14} />{needsHuman ? "Open a new session" : "Retry safely"}</button> : null}
          </div>
          <p className="hint">Returning control is explicit. The Scout may not resume merely because the browser becomes idle.</p>
        </LedgerCard>
      </div>
    </div>
  );
}
