import { CheckCircle2, Clock3, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { WorkspaceShell } from "../../components/navigation/WorkspaceShell";
import { FixtureNotice, LedgerCard, PageHeader } from "../../components/ui/LedgerCard";

export function OpsOutreachPage() {
  const [selected, setSelected] = useState("pending-approval");

  return (
    <WorkspaceShell mode="ops">
      <PageHeader meta={<FixtureNotice />} title="Outreach control" />
      <div className="cols rs-outreach-layout">
        <LedgerCard header={<><span className="type">Approval queue</span><span className="mono">No automatic sends</span></>}>
          <div className="rs-queue-list">
            <button className={`qrow rs-queue-button${selected === "pending-approval" ? " on" : ""}`} onClick={() => setSelected("pending-approval")} type="button"><span className="t">Klangraum West inquiry<span className="mono">Awaiting user approval · exact version 3</span></span><Clock3 aria-hidden="true" size={16} /></button>
            <button className={`qrow rs-queue-button${selected === "approved" ? " on" : ""}`} onClick={() => setSelected("approved")} type="button"><span className="t">Example approved inquiry<span className="mono">Approval captured · not sent in this fixture</span></span><CheckCircle2 aria-hidden="true" size={16} /></button>
          </div>
        </LedgerCard>
        <LedgerCard accent header={<><span className="type t-scout">Exact approval record</span><span className="mono">Prototype detail</span></>}>
          <div className="mailbox">To: Klangraum West &lt;contact@room-owner.example&gt;</div>
          <table className="facts"><tbody><tr><td>Version</td><td>3 · immutable after approval</td></tr><tr><td>Subject</td><td>Rehearsal-room availability</td></tr><tr><td>Status</td><td>{selected === "approved" ? "Approved fixture" : "Awaiting user"}</td></tr><tr><td>Send rule</td><td>Exact recipient + subject + body hash must match</td></tr></tbody></table>
          <blockquote className="evidence">Hi, we are looking for a permanent rehearsal room in Stuttgart. Are drums workable, and is secure storage included?</blockquote>
          <p className="fitline"><ShieldCheck aria-hidden="true" size={15} /> Operators can inspect state, but only the owning user can approve this exact message.</p>
        </LedgerCard>
      </div>
    </WorkspaceShell>
  );
}
