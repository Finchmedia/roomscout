import { Bell, Pause, Pencil, Play } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { MandatePanel } from "../../components/mandate/MandatePanel";
import { WorkspaceShell } from "../../components/navigation/WorkspaceShell";
import { SearchProfileCard } from "../../components/scout/SearchProfileCard";
import { SearchSourcesPanel } from "../../components/search/SearchSourcesPanel";
import { EmptyState, LedgerCard, PageHeader } from "../../components/ui/LedgerCard";
import { savedNeedToSearch } from "../../data/convexAdapters";
import type { ScoutMandate } from "../../features/agentOperations/types";

type SearchTab = "overview" | "sources" | "activity";

function activityTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(timestamp));
}

export function MySearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const needs = useQuery(api.savedNeeds.listMine, { limit: 10 });
  const matches = useQuery(api.matches.listMine, { limit: 30 });
  const need = needs?.find((candidate) => candidate.status !== "archived");
  const indexedSignals = useQuery(api.signals.list, need?.city ? { city: need.city, limit: 50 } : "skip");
  const sourceCoverage = useQuery(api.searchSources.listForNeed, need ? { savedNeedId: need._id, limit: 100 } : "skip");
  const activeMandate = useQuery(api.mandates.getActiveMine, need ? { savedNeedId: need._id } : "skip");
  const setNeedStatus = useMutation(api.savedNeeds.setStatus);
  const updateMatchStatus = useMutation(api.matches.updateStatus);
  const setSourcePreference = useMutation(api.searchSources.setPreference);
  const createMandateDraft = useMutation(api.mandates.createDraft);
  const activateMandate = useMutation(api.mandates.activate);
  const revokeMandate = useMutation(api.mandates.revoke);
  const killMandates = useMutation(api.mandates.killSwitch);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [defaultMandateExpiry] = useState(() => Date.now() + 30 * 24 * 60 * 60 * 1_000);
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

  async function changeMandateStatus(status: "draft" | "active" | "paused" | "killed" | "expired") {
    if (!need) return;
    setError("");
    try {
      if (status === "killed") {
        await killMandates({ savedNeedId: need._id });
      } else if (status === "paused" && activeMandate) {
        await revokeMandate({ mandateId: activeMandate._id });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The mandate could not be updated.");
    }
  }

  async function saveMandate(next: ScoutMandate) {
    if (!need) return;
    setError("");
    const mode = next.mode === "research" ? "research_autopilot" as const : next.mode === "outreach" ? "outreach_autopilot" as const : next.mode === "negotiation" ? "negotiation_autopilot" as const : "guided" as const;
    const externalActions = new Set(["send_email", "submit_webform", "send_platform_dm", "create_portal_account", "publish_listing", "share_contact_details", "propose_visit"]);
    const allowedActionTypes = mode === "guided" || mode === "research_autopilot" ? [] : next.allowedActionTypes
      .filter((action) => externalActions.has(action))
      .map((action) => action === "propose_visit" ? "propose_visit_time" as const : action as "send_email" | "submit_webform" | "send_platform_dm" | "create_portal_account" | "publish_listing" | "share_contact_details");
    const personalData = new Set(["band_name", "member_first_names", "reply_email", "phone", "precise_location", "availability", "budget", "music_profile"]);
    const allowedPersonalData = next.dataScopes.filter((scope) => personalData.has(scope)) as Array<"band_name" | "member_first_names" | "reply_email" | "phone" | "precise_location" | "availability" | "budget" | "music_profile">;
    try {
      const created = await createMandateDraft({
        savedNeedId: need._id,
        mode,
        platformIds: next.platformAllowlist.map((id) => id as Id<"sourcePlatforms">),
        allowedActionTypes,
        allowedPersonalData,
        maxContactsPerDay: Math.max(0, Math.floor(next.dailyContactLimit)),
        maxBrowserMinutesPerDay: Math.max(0, Math.floor(next.dailyBrowserMinutes)),
        maxMonthlyPriceEur: next.maxMonthlyPriceEur,
        expiresAt: next.expiresAt ?? defaultMandateExpiry,
        stopOnComplaint: true,
        stopWhenSuitableRoomConfirmed: true,
      });
      await activateMandate({ mandateId: created.mandateId, expectedContentHash: created.contentHash });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "The mandate could not be saved and activated.";
      setError(message);
      throw caught instanceof Error ? caught : new Error(message);
    }
  }

  if (needs === undefined || matches === undefined) {
    return <WorkspaceShell mode="musician"><PageHeader title="My search" /><EmptyState body="RoomScout is loading your saved criteria and current matches." title="Loading your search…" /></WorkspaceShell>;
  }

  if (!need) {
    return <WorkspaceShell mode="musician"><PageHeader title="My search" /><EmptyState body="Talk to your Scout to turn your rehearsal-room needs into an editable search." title="No saved search yet" /><div className="actionsrow"><Link className="btn btn-p" to="/app/scout">Start with your Scout</Link></div></WorkspaceShell>;
  }

  const search = savedNeedToSearch(need);
  const needMatches = matches.filter((match) => match.savedNeedId === need._id && match.status !== "dismissed");
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
  const mandate: ScoutMandate = activeMandate ? {
    id: activeMandate._id,
    contentHash: activeMandate.contentHash,
    mode: activeMandate.mode === "research_autopilot" ? "research" : activeMandate.mode === "outreach_autopilot" ? "outreach" : activeMandate.mode === "negotiation_autopilot" ? "negotiation" : "guided",
    status: "active",
    version: activeMandate.version,
    goal: need.title,
    sourceAllowlist: coverageSources.filter((source) => source.included).map((source) => source.domain),
    platformAllowlist: activeMandate.platformIds,
    allowedActionTypes: activeMandate.allowedActionTypes.map((action) => action === "propose_visit_time" ? "propose_visit" as const : action),
    dataScopes: activeMandate.allowedPersonalData,
    dailyContactLimit: activeMandate.maxContactsPerDay,
    dailyBrowserMinutes: activeMandate.maxBrowserMinutesPerDay,
    maxMonthlyPriceEur: activeMandate.maxMonthlyPriceEur,
    expiresAt: activeMandate.expiresAt,
    killSwitchEnabled: true,
    stopConditions: [activeMandate.stopOnComplaint ? "A complaint is received" : "Complaint stop disabled", activeMandate.stopWhenSuitableRoomConfirmed ? "A suitable room is confirmed" : "Confirmation stop disabled"],
    persisted: true,
  } : {
    mode: "guided", status: "draft", goal: need.title,
    sourceAllowlist: coverageSources.filter((source) => source.included).map((source) => source.domain),
    platformAllowlist: [], allowedActionTypes: [], dataScopes: [], dailyContactLimit: 0,
    dailyBrowserMinutes: 0, maxMonthlyPriceEur: need.maxBudgetEur,
    expiresAt: defaultMandateExpiry, killSwitchEnabled: true,
    stopConditions: ["Search is paused", "A login or human-only step is required", "A suitable room reaches agreement handoff"], persisted: false,
  };
  const maxEvidenceSources = Math.max(0, ...(indexedSignals ?? []).map((signal) => signal.sourceCount));

  return (
    <WorkspaceShell mode="musician">
      <PageHeader
        meta={<div className="actionsrow"><span className="mono live"><span className="dot dot-pulse" />Convex live query</span>{need.status !== "draft" ? <button className="btn btn-g btn-sm" disabled={working} onClick={toggleSearch} type="button">{need.status === "paused" ? <Play aria-hidden="true" size={14} /> : <Pause aria-hidden="true" size={14} />}{working ? "Updating…" : need.status === "paused" ? "Resume" : "Pause"}</button> : null}</div>}
        title="My search"
      />
      <div aria-label="Search sections" className="rs-page-tabs" role="tablist">
        {(["overview", "sources", "activity"] as const).map((tab) => <button aria-selected={activeTab === tab} className={activeTab === tab ? "on" : undefined} key={tab} onClick={() => setSearchParams({ tab })} role="tab" type="button">{tab}{tab === "sources" && indexedSignals ? ` · ${indexedSignals.length}` : ""}</button>)}
      </div>
      {error ? <p className="rs-form-error" role="alert">{error}</p> : null}

      {activeTab === "overview" ? (
        <div className="cols rs-search-page__layout">
          <div className="stack">
            <SearchProfileCard search={search} />
            <div className="actionsrow"><Link className="btn btn-s" to="/app/scout?mode=search_discovery"><Pencil aria-hidden="true" size={14} />Edit with Scout</Link></div>
            {activeMandate === undefined ? <EmptyState body="Loading the active version and authorization limits." title="Loading Scout mandate…" /> : <MandatePanel mandate={mandate} onSave={saveMandate} onStatusChange={changeMandateStatus} platformOptions={coverageSources.map((source) => ({ id: source.id, label: source.name }))} />}
            <LedgerCard header={<span className="type">Alert settings</span>}><table className="facts"><tbody><tr><td>Channel</td><td>In-app notifications</td></tr><tr><td>Cadence</td><td>As matching signals arrive</td></tr><tr><td>External action</td><td>Guided approval or active standing mandate</td></tr></tbody></table></LedgerCard>
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

      {activeTab === "sources" ? sourceCoverage === undefined ? <EmptyState body="Loading reviewed source coverage and your saved source preferences." title="Loading source coverage…" /> : <SearchSourcesPanel city={need.city} disclosure={sourceCoverage.disclosure} indexedSignalCount={indexedSignals?.length ?? 0} indexedSourceCount={maxEvidenceSources} onScopeChange={(sourceId, included) => void changeSourceScope(sourceId, included)} sources={coverageSources} /> : null}

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
