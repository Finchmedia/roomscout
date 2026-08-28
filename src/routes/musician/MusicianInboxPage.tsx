import { Archive, Bot, Send } from "lucide-react";
import { Link } from "react-router-dom";
import { WorkspaceShell } from "../../components/navigation/WorkspaceShell";
import { FixtureNotice } from "../../components/ui/LedgerCard";
import { demoSignals, demoThread } from "../../mocks/demoData";

export function MusicianInboxPage() {
  const signal = demoSignals.find((item) => item.id === demoThread.signalId);

  return (
    <WorkspaceShell mode="musician">
      <div className="threepane rs-inbox">
        <section className="pane rs-inbox__threads">
          <header className="phead"><h1>Inbox</h1><span className="mono">External email · separate from Scout chat</span></header>
          <button aria-current="true" className="titem on" type="button">
            <span className="who"><strong>{demoThread.correspondent}</strong><span className="mono">Reply</span></span>
            <span className="prev">{demoThread.preview}</span>
            <span className="mono">Signal · {demoThread.updatedAt}</span>
          </button>
          <p className="rs-inbox__hint">Threads appear after an approved inquiry or inbound reply.</p>
        </section>
        <section className="pane rs-inbox__conversation">
          <header className="phead rs-inbox__conversation-head"><div><h1>{demoThread.correspondent}</h1><span className="mono">{demoThread.status}</span></div><FixtureNotice /></header>
          <div className="convo">
            {demoThread.messages.map((message) => (
              <article className={`mail ${message.direction === "outbound" ? "out" : "in"}`} key={message.id}>
                <header className="mail-top"><span className="mono">{message.sender}{message.status ? ` · ${message.status}` : ""}</span><time className="mono">{message.timestamp}</time></header>
                <div className="mail-body">{message.subject ? `Subject: ${message.subject}\n\n` : ""}{message.body}</div>
              </article>
            ))}
            <section className="parsed" aria-labelledby="parsed-reply-heading">
              <header className="rs-parsed-header"><h2 className="type t-scout" id="parsed-reply-heading">Scout · Parsed reply</h2><span className="mono">AI interpretation · original stays above</span></header>
              <table className="facts"><tbody>{demoThread.parsedFacts.map((fact) => <tr key={fact.label}><td>{fact.label}</td><td className={fact.unknown ? "unknown" : undefined}>{fact.value}</td></tr>)}</tbody></table>
              <p className="fitline">{demoThread.interpretation}</p>
            </section>
          </div>
          <div className="cactions">
            <button className="btn btn-p" type="button"><Send aria-hidden="true" size={14} />Draft reply</button>
            <button className="btn btn-s" type="button"><Bot aria-hidden="true" size={14} />Ask Scout</button>
            <Link className="btn btn-s" to="/app/search">Update search</Link>
            <button className="btn btn-g" type="button"><Archive aria-hidden="true" size={14} />Archive</button>
          </div>
        </section>
        <aside className="pane ctx rs-inbox__context">
          <section><h2>Related search</h2><strong>{demoThread.searchTitle}</strong><span className="mono rs-brand-accent">Active</span></section>
          <section><h2>Related signal</h2>{signal ? <Link to={`/signals/${signal.id}`}>{signal.title} — {signal.source}</Link> : null}</section>
          <section><h2>Changed by this reply</h2><table className="facts"><tbody><tr><td>Drums</td><td>Unknown → Allowed</td></tr><tr><td>Storage</td><td>Mentioned → Confirmed</td></tr><tr><td>Availability</td><td>Now → Possibly next month</td></tr></tbody></table></section>
          <section><h2>Communication</h2><table className="facts"><tbody><tr><td>Approval</td><td>Recorded before send</td></tr><tr><td>Delivery</td><td>Delivered</td></tr><tr><td>Status</td><td>Replied · awaiting user</td></tr></tbody></table></section>
        </aside>
      </div>
    </WorkspaceShell>
  );
}
