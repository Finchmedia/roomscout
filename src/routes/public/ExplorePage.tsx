import { Bookmark } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PublicHeader } from "../../components/navigation/PublicHeader";
import { WorkspaceShell } from "../../components/navigation/WorkspaceShell";
import { SignalCard } from "../../components/signals/SignalCard";
import { ActionDialog } from "../../components/ui/ActionDialog";
import { FixtureNotice, PageHeader } from "../../components/ui/LedgerCard";
import { SelectField } from "../../components/ui/SelectField";
import { demoSignals } from "../../mocks/demoData";
import type { SignalSide } from "../../mocks/demoData";

type ExplorePageProps = {
  authenticated?: boolean;
};

const filterChips = ["Fixed monthly", "Hourly", "≤ €250/month", "Evenings", "Storage", "Fresh this week"];
const sortOptions = [
  { value: "relevant", label: "Most relevant" },
  { value: "newest", label: "Newest" },
] as const;

function ExploreContent({ authenticated = false }: ExplorePageProps) {
  const [location, setLocation] = useState("Stuttgart");
  const [side, setSide] = useState<SignalSide | "all">("all");
  const [selectedFilters, setSelectedFilters] = useState(() => new Set(["Fixed monthly", "≤ €250/month"]));
  const [sort, setSort] = useState("relevant");
  const [saveGateOpen, setSaveGateOpen] = useState(false);

  const visibleSignals = useMemo(
    () => demoSignals.filter((signal) => side === "all" || signal.side === side),
    [side],
  );

  function toggleFilter(filter: string) {
    setSelectedFilters((current) => {
      const next = new Set(current);
      if (next.has(filter)) next.delete(filter);
      else next.add(filter);
      return next;
    });
  }

  return (
    <div className="wrap rs-explore">
      <PageHeader
        meta={<span className="rs-page-meta"><FixtureNotice /> <span className="mono">{demoSignals.length} indexed examples</span></span>}
        title="Market explorer"
      />
      <div className="tools rs-explore__tools">
        <label className="sr-only" htmlFor="explore-location">Location</label>
        <input className="input" id="explore-location" onChange={(event) => setLocation(event.target.value)} value={location} />
        <div aria-label="Signal side" className="seg" role="group">
          {(["all", "supply", "demand"] as const).map((value) => (
            <button className={side === value ? "on" : undefined} key={value} onClick={() => setSide(value)} type="button">
              {value[0]?.toUpperCase()}{value.slice(1)}
            </button>
          ))}
        </div>
        <SelectField ariaLabel="Sort signals" onValueChange={setSort} options={sortOptions} value={sort} />
        <button className="btn btn-s rs-explore__save" onClick={() => setSaveGateOpen(true)} type="button">
          <Bookmark aria-hidden="true" size={14} />Save this search
        </button>
      </div>
      <div aria-label="Search filters" className="fchips">
        {filterChips.map((filter) => (
          <button aria-pressed={selectedFilters.has(filter)} className={`fchip${selectedFilters.has(filter) ? " on" : ""}`} key={filter} onClick={() => toggleFilter(filter)} type="button">{filter}</button>
        ))}
      </div>
      <div className="rescount">
        <span><b>{visibleSignals.length}</b> example signals in {location || "your location"}</span>
        <span className="mono">Filters are visual in this scaffold</span>
      </div>
      <div className="list rs-signal-grid">
        {visibleSignals.map((signal) => <SignalCard key={signal.id} signal={signal} />)}
      </div>
      <ActionDialog
        footer={
          <>
            <button className="btn btn-g" onClick={() => setSaveGateOpen(false)} type="button">Not now</button>
            {authenticated ? <Link className="btn btn-p" to="/app/search">Review saved search</Link> : <><Link className="btn btn-s" to="/sign-up">Create account</Link><Link className="btn btn-p" to="/sign-in">Sign in</Link></>}
          </>
        }
        onOpenChange={setSaveGateOpen}
        open={saveGateOpen}
        title={authenticated ? "Review before saving" : "Save it to your account"}
      >
        <p>{authenticated ? "The current location and filters will become an editable saved search." : "Sign in so RoomScout can preserve this search and alert you. Browsing remains public."}</p>
      </ActionDialog>
    </div>
  );
}

export function ExplorePage() {
  return <><PublicHeader /><main><ExploreContent /></main></>;
}

export function AppExplorePage() {
  return <WorkspaceShell mode="musician"><ExploreContent authenticated /></WorkspaceShell>;
}
