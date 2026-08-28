import { WorkspaceShell } from "../../components/navigation/WorkspaceShell";
import { FixtureNotice, LedgerCard, PageHeader } from "../../components/ui/LedgerCard";

export function OpsAuditPage() {
  return (
    <WorkspaceShell mode="ops">
      <PageHeader meta={<FixtureNotice />} title="Audit log" />
      <LedgerCard header={<><span className="type">Communication safeguards</span><span className="mono">Thin scaffold surface</span></>}>
        <ol className="stream rs-event-stream"><li className="ev"><span className="mono">15:01</span><span><b>Approval captured</b> — exact recipient and message version recorded</span><span className="pill">Approval</span></li><li className="ev"><span className="mono">15:02</span><span><b>Delivery fixture</b> — no external request is made by this screen</span><span className="pill">Demo</span></li></ol>
      </LedgerCard>
    </WorkspaceShell>
  );
}
