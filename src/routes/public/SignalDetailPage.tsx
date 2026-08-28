import { ArrowLeft, Bookmark, ExternalLink, HelpCircle } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PublicHeader } from "../../components/navigation/PublicHeader";
import { Freshness, SignalBadge } from "../../components/signals/SignalBadge";
import { ActionDialog } from "../../components/ui/ActionDialog";
import { LedgerCard } from "../../components/ui/LedgerCard";
import { demoSignals } from "../../mocks/demoData";

export function SignalDetailPage() {
  const { signalId } = useParams();
  const signal = demoSignals.find((item) => item.id === signalId) ?? demoSignals[0];
  const [gateOpen, setGateOpen] = useState(false);

  if (!signal) return null;

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
              <ul className="rs-unknown-list">
                {(signal.unknowns ?? ["No additional unknowns were extracted from this prototype record."]).map((unknown) => <li className="check" key={unknown}><HelpCircle aria-hidden="true" size={15} />{unknown}</li>)}
              </ul>
            </LedgerCard>
            <section aria-labelledby="freshness-heading">
              <h2 className="sub" id="freshness-heading">Freshness</h2>
              <div className="timeline">
                <div><div className="k">First observed</div><div className="v">Today · 09:14</div></div>
                <div><div className="k">Last checked</div><div className="v">18 min ago</div></div>
                <div><div className="k">Source status</div><div className="v">Reachable</div></div>
              </div>
            </section>
          </div>
          <div className="stack">
            <LedgerCard accent header={<span className="type t-scout">Fit — sign in for yours</span>}>
              <p>{signal.fit ?? "Create a saved search to see an evidence-grounded fit explanation."}</p>
            </LedgerCard>
            <LedgerCard header={<span className="type">Provenance</span>}>
              <table className="facts"><tbody>
                <tr><td>Source</td><td>{signal.source}</td></tr>
                <tr><td>Record</td><td>Prototype fixture</td></tr>
                <tr><td>Verification</td><td>{signal.verification.replace("_", " ")}</td></tr>
              </tbody></table>
              <a className="btn btn-s btn-sm" href="https://example.com" rel="noreferrer" target="_blank"><ExternalLink aria-hidden="true" size={14} />Open example source</a>
            </LedgerCard>
            <div className="actions">
              <button className="btn btn-p" onClick={() => setGateOpen(true)} type="button">Ask Room Scout about this</button>
              <button className="btn btn-s" onClick={() => setGateOpen(true)} type="button"><Bookmark aria-hidden="true" size={14} />Save</button>
              <button className="btn btn-g" onClick={() => setGateOpen(true)} type="button">Dismiss</button>
            </div>
            <p className="mono">Exact recipient and message approval is required before any inquiry is sent.</p>
          </div>
        </div>
      </main>
      <ActionDialog footer={<><button className="btn btn-g" onClick={() => setGateOpen(false)} type="button">Not now</button><Link className="btn btn-s" to="/sign-up">Create account</Link><Link className="btn btn-p" to="/sign-in">Sign in</Link></>} onOpenChange={setGateOpen} open={gateOpen} title="Continue with your Scout">
        <p>Sign in so RoomScout can keep your search, Scout thread, and approvals together. You can return to this signal afterward.</p>
      </ActionDialog>
    </>
  );
}
