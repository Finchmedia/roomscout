import { Bell, Pause, Pencil, Play, Send } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { getSavedNeedActivationReadiness } from "../../../convex/lib/savedNeedLocation";
import { WorkspaceShell } from "../../components/navigation/WorkspaceShell";
import { SearchProfileCard } from "../../components/scout/SearchProfileCard";
import { SearchSourcesPanel } from "../../components/search/SearchSourcesPanel";
import { EmptyState, LedgerCard, PageHeader } from "../../components/ui/LedgerCard";
import { Table, TableBody, TableCell, TableRow } from "../../components/ui/table";
import { savedNeedToSearch } from "../../data/convexAdapters";
import { useCopy } from "../../ui/copy";

type SearchTab = "overview" | "sources" | "activity";

function activityTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(timestamp));
}

export function MySearchPage() {
  const { t } = useCopy();
  const [searchParams, setSearchParams] = useSearchParams();
  const needs = useQuery(api.savedNeeds.listMine, { limit: 10 });
  const scoutContext = useQuery(api.scout.getMine);
  const need = needs !== undefined && scoutContext !== undefined
    ? needs.find((candidate) => candidate._id === scoutContext?.activeNeedId && candidate.status !== "archived") ?? needs.find((candidate) => candidate.status !== "archived")
    : undefined;
  const matches = useQuery(api.matches.listMine, need ? { savedNeedId: need._id, limit: 30 } : "skip");
  const indexedSignals = useQuery(api.signals.list, need?.locationQuery ? { city: need.locationQuery, limit: 50 } : "skip");
  const sourceCoverage = useQuery(api.searchSources.listForNeed, need ? { savedNeedId: need._id, limit: 100 } : "skip");
  const setNeedStatus = useMutation(api.savedNeeds.setStatus);
  const activateNeed = useMutation(api.savedNeeds.activate);
  const updateMatchStatus = useMutation(api.matches.updateStatus);
  const setSourcePreference = useMutation(api.searchSources.setPreference);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const requestedTab = searchParams.get("tab");
  const activeTab: SearchTab = requestedTab === "sources" || requestedTab === "activity" ? requestedTab : "overview";

  async function toggleSearch() {
    if (!need) return;
    setWorking(true);
    setError("");
    try {
      await setNeedStatus({ needId: need._id, status: need.status === "paused" ? "active" : "paused" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The search status could not be changed.");
    } finally {
      setWorking(false);
    }
  }

  /** "Schick mich los": the search becomes active within the user's Handlungsspielraum. */
  async function startSearch() {
    if (!need || !getSavedNeedActivationReadiness(need).canActivate) return;
    setWorking(true);
    setError("");
    try {
      await activateNeed({ savedNeedId: need._id });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The search could not be started.");
    } finally {
      setWorking(false);
    }
  }

  async function setMatchStatus(matchId: Id<"signalMatches">, status: "saved" | "dismissed" | "seen") {
    try {
      await updateMatchStatus({ matchId, status });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The match could not be updated.");
    }
  }

  async function changeSourceScope(platformId: string, included: boolean) {
    if (!need) return;
    setError("");
    try {
      await setSourcePreference({
        savedNeedId: need._id,
        platformId: platformId as Id<"sourcePlatforms">,
        preference: included ? "include" : "exclude",
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The source preference could not be saved.");
    }
  }

  if (needs === undefined || scoutContext === undefined || (need && matches === undefined)) {
    return <WorkspaceShell mode="musician"><PageHeader title="My search" /><EmptyState body="RoomScout is loading your saved criteria and current matches." title="Loading your search…" /></WorkspaceShell>;
  }

  if (!need) {
    return <WorkspaceShell mode="musician"><PageHeader title="My search" /><EmptyState body="Talk to your Scout to turn your rehearsal-room needs into an editable search." title="No saved search yet" /><div className="actionsrow"><Link className="btn btn-p" to="/app/scout">Start with your Scout</Link></div></WorkspaceShell>;
  }

  const search = savedNeedToSearch(need);
  const activation = getSavedNeedActivationReadiness(need);
  const activationMissing = activation.canActivate
    ? undefined
    : activation.missingFields.length === 2
      ? t("liveScout.activateMissingLocationAndRadius")
      : activation.missingFields[0] === "location"
        ? t("liveScout.activateMissingLocation")
        : t("liveScout.activateMissingRadius");
  const needMatches = matches ?? [];
  const coverageSources = (sourceCoverage?.sources ?? []).map((source) => {
    const coverageStates = [source.supplyStatus, source.demandStatus].filter(Boolean);
    const side = source.supplyStatus && source.demandStatus ? "both" as const : source.supplyStatus ? "supply" as const : "demand" as const;
    const status = source.platformStatus === "active"
      ? coverageStates.some((state) => state === "verified" || state === "probed") ? "watching" as const : "partial" as const
      : source.platformStatus === "candidate" || source.platformStatus === "reviewing" ? "under_review" as const : "unavailable" as const;
    return {
      id: source.platformId,
      name: source.name,
      domain: source.domain,
      side,
      status,
      access: "public" as const,
      included: source.preference !== "exclude",
      lastCheckedLabel: source.lastObservedAt ? activityTime(source.lastObservedAt) : undefined,
      note: `${coverageStates.join(" + ") || "Coverage status unavailable"} · ${Math.round(source.confidence * 100)}% confidence`,
    };
  });
  const maxEvidenceSources = Math.max(0, ...(indexedSignals ?? []).map((signal) => signal.sourceCount));

  return (
    <WorkspaceShell mode="musician">
      <PageHeader
        meta={<div className="actionsrow"><span className="mono live"><span className="dot dot-pulse" />Convex live query</span>{need.status === "draft" ? <button className="btn btn-p btn-sm" disabled={working || !activation.canActivate} onClick={() => void startSearch()} type="button"><Send aria-hidden="true" size={14} />{working ? "Starting…" : "Schick mich los"}</button> : need.status !== "archived" ? <button className="btn btn-g btn-sm" disabled={working} onClick={() => void toggleSearch()} type="button">{need.status === "paused" ? <Play aria-hidden="true" size={14} /> : <Pause aria-hidden="true" size={14} />}{working ? "Updating…" : need.status === "paused" ? "Weiter" : "Pause"}</button> : null}</div>}
        title="My search"
      />
      {need.status === "draft" && activationMissing ? <p className="rs-form-error" role="status">{activationMissing}</p> : null}
      <div aria-label="Search sections" className="rs-page-tabs" role="tablist">
        {(["overview", "sources", "activity"] as const).map((tab) => <button aria-selected={activeTab === tab} className={activeTab === tab ? "on" : undefined} key={tab} onClick={() => setSearchParams({ tab })} role="tab" type="button">{tab}{tab === "sources" && indexedSignals ? ` · ${indexedSignals.length}` : ""}</button>)}
      </div>
      {error ? <p className="rs-form-error" role="alert">{error}</p> : null}

      {activeTab === "overview" ? (
        <div className="cols rs-search-page__layout">
          <div className="stack">
            <SearchProfileCard search={search} />
            <div className="actionsrow"><Link className="btn btn-s" to="/app/scout?mode=search_discovery"><Pencil aria-hidden="true" size={14} />Edit with Scout</Link></div>
            <LedgerCard header={<><span className="type">Scout</span><span className="mono">{need.status === "active" ? "Suche aktiv" : need.status === "paused" ? "Pausiert" : need.status}</span></>}><p className="brief"><span>Der Scout arbeitet innerhalb deines Handlungsspielraums. Verbindliche Zusagen bleiben bei dir.</span></p></LedgerCard>
            <LedgerCard header={<span className="type">Updates</span>}><Table className="facts"><TableBody><TableRow><TableCell>Channel</TableCell><TableCell>In-app notifications</TableCell></TableRow><TableRow><TableCell>Cadence</TableCell><TableCell>As matches and replies arrive</TableCell></TableRow><TableRow><TableCell>Decision point</TableCell><TableCell>Agreements, bookings, or money</TableCell></TableRow></TableBody></Table></LedgerCard>
          </div>
          <div className="stack">
            <LedgerCard accent header={<><span className="type t-scout">Current matches</span><span className="mono">{needMatches.length} live</span></>}><p className="brief"><Bell aria-hidden="true" size={15} /><span>Matches use structured constraints plus semantic compatibility. Unknown facts remain visible as uncertainty.</span></p></LedgerCard>
            {need.status === "draft" ? <EmptyState body="Finish and activate the draft with your Scout before RoomScout starts matching it." title="Search is still a draft" /> : needMatches.length === 0 ? <EmptyState body="No indexed signal currently clears this search's match threshold. RoomScout will update this page when the index changes." title="No matches yet" /> : needMatches.map((match) => (
              <LedgerCard accent={match.status === "new"} footer={<><span className="mono">{Math.round(match.score * 100)}% match</span><span className="mono">{match.kind === "need_supply" ? "Room signal" : "Potential band connection"}</span></>} header={<><span className={`type t-${match.signalSide}`}>{match.signalSide} · {match.status}</span><span className="mono">{match.signalCity}</span></>} key={match._id}>
                <h2 className="ltitle"><Link to={`/signals/${match.signalId}`}>{match.signalTitle}</Link></h2>
                {match.reasons.length ? <ul className="rs-unknown-list">{match.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul> : null}
                {match.uncertainties.length ? <p className="unknown">Still unclear: {match.uncertainties.join(" · ")}</p> : null}
                <div className="actionsrow"><Link className="btn btn-p btn-sm" onClick={() => void setMatchStatus(match._id, "seen")} to={`/signals/${match.signalId}`}>Open detail</Link><button className="btn btn-s btn-sm" onClick={() => void setMatchStatus(match._id, "saved")} type="button">Save</button><button className="btn btn-g btn-sm" onClick={() => void setMatchStatus(match._id, "dismissed")} type="button">Dismiss</button></div>
              </LedgerCard>
            ))}
          </div>
        </div>
      ) : null}

      {activeTab === "sources" ? sourceCoverage === undefined ? <EmptyState body="Loading reviewed source coverage and your saved source preferences." title="Loading source coverage…" /> : <SearchSourcesPanel city={need.locationLabel ?? need.locationQuery ?? "this area"} disclosure={sourceCoverage.disclosure} indexedSignalCount={indexedSignals?.length ?? 0} indexedSourceCount={maxEvidenceSources} onScopeChange={(sourceId, included) => void changeSourceScope(sourceId, included)} sources={coverageSources} /> : null}

      {activeTab === "activity" ? (
        <LedgerCard header={<><span className="type">Search activity</span><span className="mono">Persisted search + match events</span></>}>
          <ol className="stream rs-event-stream">
            <li className="ev"><time className="mono">{activityTime(need.updatedAt)}</time><span><b>Search updated</b> — {need.title}</span><span className="pill new">{need.status}</span></li>
            {needMatches.map((match) => <li className="ev" key={match._id}><time className="mono">{activityTime(match.updatedAt)}</time><span><b>{match.status === "new" ? "New match" : "Match updated"}</b> — {match.signalTitle}</span><span className="pill">{Math.round(match.score * 100)}%</span></li>)}
          </ol>
        </LedgerCard>
      ) : null}
    </WorkspaceShell>
  );
}
