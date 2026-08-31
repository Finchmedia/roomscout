import { ArrowLeft, Bookmark, ExternalLink, HelpCircle } from "lucide-react";
import { useQuery } from "convex/react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PublicHeader } from "../../components/navigation/PublicHeader";
import { Freshness, SignalBadge } from "../../components/signals/SignalBadge";
import { ActionDialog } from "../../components/ui/ActionDialog";
import { EmptyState, LedgerCard } from "../../components/ui/LedgerCard";
import { formatMessageTime, publicSignalToMarketSignal } from "../../data/convexAdapters";

export function SignalDetailPage() {
  const { signalId } = useParams();
  const detail = useQuery(
    api.signals.get,
    signalId ? { signalId: signalId as Id<"signals"> } : "skip",
  );
  const [gateOpen, setGateOpen] = useState(false);

  if (detail === undefined) {
    return <><PublicHeader /><main className="wrap"><EmptyState body="RoomScout is loading the current record and its provenance." title="Loading signal…" /></main></>;
  }
  if (detail === null) {
    return (
      <><PublicHeader /><main className="wrap"><Link className="back" to="/explore"><ArrowLeft aria-hidden="true" size={14} />Back to explorer</Link><EmptyState body="This signal is not public, no longer available, or the link is invalid." title="Signal not found" /></main></>
    );
  }

  const primaryEvidence = detail.evidence[0];
  const signal = publicSignalToMarketSignal(
    detail.signal,
    primaryEvidence?.sourceName,
  );

  return (
    <>
      <PublicHeader />
      <main className="wrap rs-signal-detail">
        <Link className="back" to="/explore"><ArrowLeft aria-hidden="true" size={14} />Back to explorer</Link>
        <SignalBadge signal={signal} />
        <div className="headrow">
          <h1>{signal.title}</h1>
          <Freshness signal={signal} />
        </div>
        <div className="lloc">{signal.location}{signal.arrangement ? ` · ${signal.arrangement}` : ""}</div>
        <div className="cols rs-signal-detail__columns">
          <div className="stack">
            <LedgerCard header={<span className={`type t-${signal.side}`}>Known facts</span>}>
              <table className="facts"><tbody>{signal.facts.map((fact) => <tr key={fact.label}><td>{fact.label}</td><td className={fact.unknown ? "unknown" : undefined}>{fact.value}</td></tr>)}</tbody></table>
              <p>{signal.summary}</p>
            </LedgerCard>
            <LedgerCard header={<span className="type">Unknown or unclear</span>}>
              {signal.unknowns?.length ? (
                <ul className="rs-unknown-list">
                  {signal.unknowns.map((unknown) => <li className="check" key={unknown}><HelpCircle aria-hidden="true" size={15} />{unknown}</li>)}
                </ul>
              ) : <p>No unresolved fields were recorded during normalization.</p>}
            </LedgerCard>
            <section aria-labelledby="freshness-heading">
              <h2 className="sub" id="freshness-heading">Freshness</h2>
              <div className="timeline">
                <div><div className="k">First observed</div><div className="v">{formatMessageTime(detail.signal.firstSeenAt)}</div></div>
                <div><div className="k">Last checked</div><div className="v">{formatMessageTime(detail.signal.lastSeenAt)}</div></div>
                <div><div className="k">Index status</div><div className="v">{detail.signal.status === "stale" ? "Possibly stale" : "Published"}</div></div>
              </div>
            </section>
          </div>
          <div className="stack">
            <LedgerCard accent header={<span className="type t-scout">Fit — sign in for yours</span>}>
              <p>Create or activate a saved search to see structured match reasons and uncertainties for this signal.</p>
            </LedgerCard>
            <LedgerCard header={<span className="type">Provenance</span>}>
              <table className="facts"><tbody>
                <tr><td>Source</td><td>{primaryEvidence?.sourceName ?? `${detail.signal.sourceCount} indexed source${detail.signal.sourceCount === 1 ? "" : "s"}`}</td></tr>
                <tr><td>Evidence records</td><td>{detail.evidence.length}</td></tr>
                <tr><td>Verification</td><td>{detail.signal.verification.replace("_", " ")}</td></tr>
              </tbody></table>
              {primaryEvidence ? (
                <>
                  <p className="evidence">{primaryEvidence.excerpt}</p>
                  <a className="btn btn-s btn-sm" href={primaryEvidence.sourceUrl} rel="noreferrer" target="_blank"><ExternalLink aria-hidden="true" size={14} />Open source</a>
                </>
              ) : <p>No public evidence excerpt is attached to this record yet.</p>}
            </LedgerCard>
            <div className="actions">
              <Link className="btn btn-p" to={`/app/scout?mode=signal_advisor&signalId=${signal.id}`}>Ask Room Scout about this</Link>
              <button className="btn btn-s" onClick={() => setGateOpen(true)} type="button"><Bookmark aria-hidden="true" size={14} />Save</button>
            </div>
            <p className="mono">Exact recipient and message approval is required before any inquiry is sent.</p>
          </div>
        </div>
      </main>
      <ActionDialog footer={<><button className="btn btn-g" onClick={() => setGateOpen(false)} type="button">Not now</button><Link className="btn btn-s" to="/sign-up">Create account</Link><Link className="btn btn-p" to={`/sign-in?returnTo=${encodeURIComponent(`/signals/${signal.id}`)}`}>Sign in</Link></>} onOpenChange={setGateOpen} open={gateOpen} title="Continue with your Scout">
        <p>Sign in so RoomScout can keep your search, Scout thread, saved signal, and approvals together.</p>
      </ActionDialog>
    </>
  );
}
