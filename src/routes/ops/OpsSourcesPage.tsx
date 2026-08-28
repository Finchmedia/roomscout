import { WorkspaceShell } from "../../components/navigation/WorkspaceShell";
import { FixtureNotice, LedgerCard, PageHeader } from "../../components/ui/LedgerCard";

export function OpsSourcesPage() {
  return (
    <WorkspaceShell mode="ops">
      <PageHeader meta={<FixtureNotice />} title="Sources" />
      <LedgerCard header={<><span className="type">Reviewed prototype sources</span><span className="mono">Thin scaffold surface</span></>}>
        <table className="q"><thead><tr><th>Source</th><th>Side</th><th>Health</th><th>Last check</th></tr></thead><tbody><tr><td>Musikboard Süd</td><td>Supply</td><td><span className="pill new">Healthy fixture</span></td><td>18 min ago</td></tr><tr><td>Musikerbörse</td><td>Demand</td><td><span className="pill">Healthy fixture</span></td><td>Today</td></tr><tr><td>Kleinanzeigen BW</td><td>Supply</td><td><span className="pill warn">Degraded fixture</span></td><td>11 days ago</td></tr></tbody></table>
      </LedgerCard>
    </WorkspaceShell>
  );
}
