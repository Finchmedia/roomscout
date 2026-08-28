import { Bookmark } from "lucide-react";
import { Link } from "react-router-dom";
import type { MarketSignal } from "../../mocks/demoData";
import { Freshness, SignalBadge } from "./SignalBadge";

type SignalCardProps = {
  signal: MarketSignal;
  compact?: boolean;
  showActions?: boolean;
  onSave?: (signalId: string) => void;
  onDraftOutreach?: (signal: MarketSignal) => void;
  onDismiss?: (signalId: string) => void;
};

export function SignalCard({
  signal,
  compact = false,
  showActions = false,
  onSave,
  onDraftOutreach,
  onDismiss,
}: SignalCardProps) {
  return (
    <article className={`lcard hov rs-signal-card rs-signal-card--${signal.side}${compact ? " rs-signal-card--compact" : ""}`}>
      <div className="lcard-top">
        <SignalBadge signal={signal} />
        <Freshness signal={signal} />
      </div>
      <div className="lcard-body">
        <Link className="rs-signal-card__link" to={`/signals/${signal.id}`}>
          <h2 className="ltitle">{signal.title}</h2>
        </Link>
        <div className="lloc">{signal.location}{signal.arrangement ? ` · ${signal.arrangement}` : ""}</div>
        {!compact ? (
          <table className="facts">
            <tbody>
              {signal.facts.map((fact) => (
                <tr key={fact.label}>
                  <td>{fact.label}</td>
                  <td className={fact.unknown ? "unknown" : undefined}>{fact.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {signal.fit ? <p className="fitline">{signal.fit}</p> : null}
        {showActions ? (
          <div className="actionsrow rs-signal-card__actions">
            {onDraftOutreach ? <button className="btn btn-p" onClick={() => onDraftOutreach(signal)} type="button">Draft inquiry</button> : null}
            <Link className="btn btn-s" to={`/signals/${signal.id}`}>Open detail</Link>
            {onSave ? (
              <button className="btn btn-g" onClick={() => onSave(signal.id)} type="button">
                <Bookmark aria-hidden="true" size={14} />Save
              </button>
            ) : null}
            {onDismiss ? <button className="btn btn-g" onClick={() => onDismiss(signal.id)} type="button">Dismiss</button> : null}
          </div>
        ) : null}
      </div>
      <div className="lcard-foot">
        <span className="mono">SRC {signal.source}</span>
        <span className="mono">{signal.firstSeen}</span>
      </div>
    </article>
  );
}
