import { Bell, Pause, Pencil } from "lucide-react";
import { WorkspaceShell } from "../../components/navigation/WorkspaceShell";
import { SearchProfileCard } from "../../components/scout/SearchProfileCard";
import { SignalCard } from "../../components/signals/SignalCard";
import { FixtureNotice, LedgerCard, PageHeader } from "../../components/ui/LedgerCard";
import { demoSearch, demoSignals } from "../../mocks/demoData";

export function MySearchPage() {
  return (
    <WorkspaceShell mode="musician">
      <PageHeader meta={<FixtureNotice />} title="My search" />
      <div className="cols rs-search-page__layout">
        <div className="stack">
          <SearchProfileCard search={demoSearch} />
          <div className="actionsrow">
            <button className="btn btn-s" type="button"><Pencil aria-hidden="true" size={14} />Edit criteria</button>
            <button className="btn btn-g" type="button"><Pause aria-hidden="true" size={14} />Pause search</button>
          </div>
          <LedgerCard header={<span className="type">Alert settings</span>}>
            <table className="facts"><tbody>
              <tr><td>Channel</td><td>In-app + email</td></tr>
              <tr><td>Cadence</td><td>As matching signals arrive</td></tr>
              <tr><td>Outreach</td><td>Always requires exact approval</td></tr>
            </tbody></table>
          </LedgerCard>
        </div>
        <div className="stack">
          <LedgerCard accent header={<><span className="type t-scout">Current matches</span><span className="mono">Prototype examples</span></>}>
            <p className="brief"><Bell aria-hidden="true" size={15} /><span>These signals explain why they fit and what remains unknown.</span></p>
          </LedgerCard>
          {demoSignals.slice(0, 2).map((signal) => <SignalCard compact key={signal.id} signal={signal} />)}
        </div>
      </div>
    </WorkspaceShell>
  );
}
