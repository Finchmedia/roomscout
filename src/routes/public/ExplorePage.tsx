import { Bookmark } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import { publicSignalToMarketSignal } from "../../data/convexAdapters";
import { PublicHeader } from "../../components/navigation/PublicHeader";
import { CoverageTrustNotice } from "../../components/coverage/CoverageTrustNotice";
import { WorkspaceShell } from "../../components/navigation/WorkspaceShell";
import { SignalCard } from "../../components/signals/SignalCard";
import { ActionDialog } from "../../components/ui/ActionDialog";
import { EmptyState, PageHeader } from "../../components/ui/LedgerCard";
import { SelectField } from "../../components/ui/SelectField";
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
  const routeLocation = useLocation();
  const navigate = useNavigate();
  const initialCity = new URLSearchParams(routeLocation.search).get("city") ?? "Stuttgart";
  const [location, setLocation] = useState(initialCity);
  const [side, setSide] = useState<SignalSide | "all">("all");
  const [selectedFilters, setSelectedFilters] = useState(() => new Set<string>());
  const [sort, setSort] = useState("relevant");
  const [referenceTime] = useState(() => Date.now());
  const [saveGateOpen, setSaveGateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const createNeed = useMutation(api.savedNeeds.create);
  const signals = useQuery(api.signals.list, {
    city: location.trim() || undefined,
    side: side === "all" ? undefined : side,
    limit: 50,
  });

  const visibleSignals = useMemo(() => {
    if (!signals) return [];
    const filtered = signals.filter((signal) => {
      if (selectedFilters.has("Fixed monthly") && signal.arrangement !== "permanent" && signal.arrangement !== "shared") return false;
      if (selectedFilters.has("Hourly") && signal.arrangement !== "hourly") return false;
      if (selectedFilters.has("≤ €250/month") && (signal.pricePeriod !== "month" || signal.priceEur === undefined || signal.priceEur > 250)) return false;
      if (selectedFilters.has("Evenings") && !signal.requirements.some((value) => /evening|abend/i.test(value))) return false;
      if (selectedFilters.has("Storage") && !signal.requirements.some((value) => /storage|lager/i.test(value))) return false;
      if (selectedFilters.has("Fresh this week") && referenceTime - signal.lastSeenAt > 7 * 86_400_000) return false;
      return true;
    });
    return [...filtered]
      .sort((left, right) => sort === "newest"
        ? right.lastSeenAt - left.lastSeenAt
        : Number(right.verification === "verified") - Number(left.verification === "verified") || right.lastSeenAt - left.lastSeenAt)
      .map((signal) => publicSignalToMarketSignal(signal));
  }, [referenceTime, selectedFilters, signals, sort]);

  function toggleFilter(filter: string) {
    setSelectedFilters((current) => {
      const next = new Set(current);
      if (next.has(filter)) next.delete(filter);
      else next.add(filter);
      return next;
    });
  }

  async function saveSearch() {
    const city = location.trim();
    if (!city) {
      setSaveError("Add a city before saving this search.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      await createNeed({
        title: `Rehearsal-room search in ${city}`,
        city,
        districts: [],
        arrangement: [
          ...(selectedFilters.has("Fixed monthly") ? ["permanent" as const, "shared" as const] : []),
          ...(selectedFilters.has("Hourly") ? ["hourly" as const] : []),
        ],
        schedule: selectedFilters.has("Evenings") ? ["Evenings"] : [],
        requirements: selectedFilters.has("Storage") ? ["Storage"] : [],
        maxBudgetEur: selectedFilters.has("≤ €250/month") ? 250 : undefined,
      });
      setSaveGateOpen(false);
      navigate("/app/search");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "The search could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="wrap rs-explore">
      <PageHeader
        meta={<span className="rs-page-meta"><span className="mono live"><span className="dot dot-pulse" />Live index</span><span className="mono">{signals?.length ?? 0} indexed signals</span></span>}
        title="Market explorer"
      />
      <CoverageTrustNotice compact />
      <div className="tools rs-explore__tools">
        <label className="sr-only" htmlFor="explore-location">Location</label>
        <input className="input" id="explore-location" onChange={(event) => setLocation(event.target.value)} placeholder="City" value={location} />
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
        <span><b>{visibleSignals.length}</b> signals in {location || "all indexed locations"}</span>
        <span className="mono">Public, provenance-linked observations</span>
      </div>
      {signals === undefined ? (
        <EmptyState body="RoomScout is loading the current public index." title="Loading signals…" />
      ) : visibleSignals.length === 0 ? (
        <EmptyState body="No indexed signal currently matches this location and filter combination. Try removing a filter or searching another city." title="No matching signals yet" />
      ) : (
        <div className="list rs-signal-grid">
          {visibleSignals.map((signal) => <SignalCard key={signal.id} signal={signal} />)}
        </div>
      )}
      <ActionDialog
        footer={
          <>
            <button className="btn btn-g" onClick={() => setSaveGateOpen(false)} type="button">Not now</button>
            {authenticated
              ? <button className="btn btn-p" disabled={saving} onClick={saveSearch} type="button">{saving ? "Saving…" : "Save draft search"}</button>
              : <><Link className="btn btn-s" to="/sign-up">Create account</Link><Link className="btn btn-p" to="/sign-in">Sign in</Link></>}
          </>
        }
        onOpenChange={setSaveGateOpen}
        open={saveGateOpen}
        title={authenticated ? "Review before saving" : "Save it to your account"}
      >
        <p>{authenticated ? "The current city and supported filters will become an editable draft search. Your Scout can refine it with you before activation." : "Sign in so RoomScout can preserve this search and alert you. Browsing remains public."}</p>
        {saveError ? <p className="rs-form-error" role="alert">{saveError}</p> : null}
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
