import { ArrowRight, Bot, MailCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { WorkspaceShell } from "../../components/navigation/WorkspaceShell";
import { FixtureNotice, LedgerCard, PageHeader } from "../../components/ui/LedgerCard";
import { demoThread } from "../../mocks/demoData";

export function OpsInboxPage() {
  return (
    <WorkspaceShell mode="ops">
      <PageHeader meta={<FixtureNotice />} title="Inbox routing" />
      <div className="cols rs-ops-inbox-layout">
        <LedgerCard header={<><span className="type">Replies needing review</span><span className="mono">1 prototype item</span></>}>
          <article className="qrow rs-routing-item"><div className="t"><strong>{demoThread.correspondent}</strong><span className="mono">Inbound reply · parsed · high confidence</span><p>{demoThread.preview}</p></div><span className="pill new">Parsed</span></article>
        </LedgerCard>
        <div className="stack">
          <LedgerCard accent header={<><span className="type t-scout">Routing decision</span><Bot aria-hidden="true" size={15} /></>}>
            <table className="facts"><tbody><tr><td>Owner</td><td>Vera · prototype user</td></tr><tr><td>Search</td><td>{demoThread.searchTitle}</td></tr><tr><td>Thread</td><td>{demoThread.correspondent}</td></tr><tr><td>Confidence</td><td>High · message/thread ID match</td></tr></tbody></table>
            <p className="fitline">Original private email remains restricted. This operator surface shows only the minimum routing context.</p>
          </LedgerCard>
          <div className="actionsrow"><button className="btn btn-p" type="button"><MailCheck aria-hidden="true" size={14} />Confirm route</button><Link className="btn btn-s" to="/app/inbox">Open musician view <ArrowRight aria-hidden="true" size={14} /></Link></div>
        </div>
      </div>
    </WorkspaceShell>
  );
}
