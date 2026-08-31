import { Mic, Pause, Sparkles, SlidersHorizontal, X } from "lucide-react";
import { useAction, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { ContextImportDialog } from "../../components/memory/ContextImportDialog";
import { WorkspaceShell } from "../../components/navigation/WorkspaceShell";
import { ApprovalComposer } from "../../components/outreach/ApprovalComposer";
import { ScoutConversation } from "../../components/scout/ScoutConversation";
import type { ScoutConversationMessage } from "../../components/scout/ScoutConversation";
import { SearchProfileCard } from "../../components/scout/SearchProfileCard";
import { SignalCard } from "../../components/signals/SignalCard";
import { LedgerCard, PageHeader } from "../../components/ui/LedgerCard";
import { RealtimeVoiceScout } from "../../components/voice";
import type { MarketSignal, SavedSearch, SearchField } from "../../mocks/demoData";

const starters = [
  "We need a permanent room for our band",
  "We are open to sharing with a musically compatible band",
  "Help me work out what matters before we search",
];

const arrangementLabels = {
  permanent: "Permanent",
  shared: "Shared",
  hourly: "Hourly",
} as const;

function needToSearch(need: Doc<"savedNeeds">): SavedSearch {
  const fields: SearchField[] = [];
  const location = [need.city, ...need.districts].filter(Boolean).join(" · ");
  if (location) fields.push({ label: "Location", value: location, source: "you" });
  if (need.arrangement.length > 0) {
    fields.push({ label: "Arrangement", value: need.arrangement.map((item) => arrangementLabels[item]).join(" · "), source: "you" });
  }
  if (need.maxBudgetEur !== undefined) fields.push({ label: "Budget", value: `≤ €${need.maxBudgetEur} / month`, source: "you" });
  if (need.radiusKm !== undefined) fields.push({ label: "Radius", value: `${need.radiusKm} km`, source: "you" });
  if (need.schedule.length > 0) fields.push({ label: "Schedule", value: need.schedule.join(" · "), source: "you" });
  if (need.requirements.length > 0) fields.push({ label: "Essential", value: need.requirements.join(" · "), source: "you" });
  if (need.openToSharing !== undefined) fields.push({ label: "Sharing", value: need.openToSharing ? "Open to compatible room-sharing" : "Not looking to share", source: "you" });
  if (need.genres?.length) fields.push({ label: "Music", value: need.genres.join(" · "), source: "you" });
  if (need.instruments?.length) fields.push({ label: "Instruments", value: need.instruments.join(" · "), source: "you" });
  if (need.collaborationOpen !== undefined) fields.push({ label: "Connections", value: need.collaborationOpen ? "Open to compatible band connections" : "Room search only", source: "you" });
  return {
    id: need._id,
    title: need.title === "My rehearsal-room search" && fields.length === 0
      ? "Your search takes shape here as you talk"
      : need.title,
    status: need.status === "draft" ? "draft" : need.status === "paused" ? "paused" : "active",
    fields,
  };
}

function readableError(error: unknown): string {
  if (error instanceof Error) return error.message.replace(/^.*?ConvexError:\s*/, "");
  return "Room Scout could not answer. Please try again.";
}

function signalToCard(signal: {
  _id: Id<"signals">;
  side: "supply" | "demand";
  title: string;
  city: string;
  district?: string;
  summary: string;
  arrangement: "permanent" | "shared" | "hourly" | "unknown";
  priceEur?: number;
  pricePeriod?: "hour" | "month" | "unknown";
  requirements: string[];
  unknowns: string[];
  status: "published" | "stale";
  verification: "observed" | "verified" | "conflicting";
  sourceCount: number;
  firstSeenAt: number;
  lastSeenAt: number;
}, fit?: string): MarketSignal {
  const ageHours = Math.max(0, Math.floor((Date.now() - signal.lastSeenAt) / 3_600_000));
  const arrangement = signal.arrangement === "unknown"
    ? undefined
    : signal.arrangement === "permanent"
      ? "Fixed monthly"
      : signal.arrangement.charAt(0).toUpperCase() + signal.arrangement.slice(1);
  return {
    id: signal._id,
    side: signal.side,
    verification: signal.verification === "verified" ? "source_verified" : "observed",
    freshness: signal.status === "stale" ? "possibly_stale" : ageHours < 24 ? "fresh" : "current",
    freshnessLabel: signal.status === "stale" ? "Possibly stale" : ageHours < 1 ? "Checked within the hour" : `Checked ${ageHours} h ago`,
    title: signal.title,
    location: [signal.district, signal.city].filter(Boolean).join(", "),
    arrangement,
    source: `${signal.sourceCount} public source${signal.sourceCount === 1 ? "" : "s"}`,
    firstSeen: `First seen ${new Date(signal.firstSeenAt).toLocaleDateString()}`,
    facts: [
      ...(signal.priceEur === undefined ? [] : [{ label: "Price", value: `€${signal.priceEur} / ${signal.pricePeriod ?? "unknown"}` }]),
      ...(signal.requirements.length ? [{ label: "Requirements", value: signal.requirements.join(" · ") }] : []),
    ],
    summary: signal.summary,
    fit,
    unknowns: signal.unknowns,
  };
}

export function ScoutPage() {
  const [searchParams] = useSearchParams();
  const currentUser = useQuery(api.users.current);
  const needs = useQuery(api.savedNeeds.listMine, { limit: 10 });
  const scoutContext = useQuery(api.scout.getMine);
  const memory = useQuery(api.memory.listMine);
  const getOrCreateDraft = useMutation(api.savedNeeds.getOrCreateDraft);
  const getOrCreateThread = useMutation(api.scout.getOrCreateThread);
  const setNeedStatus = useMutation(api.savedNeeds.setStatus);
  const setScoutFocus = useMutation(api.scout.setFocus);
  const sendScoutMessage = useAction(api.scout.sendMessage);
  const initDraftRef = useRef(false);
  const initThreadForRef = useRef<string | undefined>(undefined);
  const [sending, setSending] = useState(false);
  const [activating, setActivating] = useState(false);
  const [scoutError, setScoutError] = useState("");
  const [contextImportOpen, setContextImportOpen] = useState(false);
  const [draftSignal, setDraftSignal] = useState<MarketSignal>();
  const [dismissedIds, setDismissedIds] = useState(() => new Set<string>());
  const [voiceOpen, setVoiceOpen] = useState(false);

  const need = needs?.[0];
  const threadId = need && scoutContext?.activeNeedId === need._id
    ? scoutContext.threadId
    : undefined;
  const paginatedMessages = usePaginatedQuery(
    api.scout.listMessages,
    threadId ? { threadId } : "skip",
    { initialNumItems: 60 },
  );
  const publicSignals = useQuery(
    api.signals.list,
    need?.city ? { city: need.city, limit: 12 } : "skip",
  );
  const matches = useQuery(api.matches.listMine, { limit: 30 });
  const outreachDrafts = useQuery(api.outreach.listMine, { limit: 50 });

  useEffect(() => {
    if (needs === undefined || needs.length > 0 || initDraftRef.current) return;
    initDraftRef.current = true;
    void getOrCreateDraft().catch((error: unknown) => {
      initDraftRef.current = false;
      setScoutError(readableError(error));
    });
  }, [getOrCreateDraft, needs]);

  useEffect(() => {
    if (!need || scoutContext === undefined) return;
    if (scoutContext?.activeNeedId === need._id) return;
    if (initThreadForRef.current === need._id) return;
    initThreadForRef.current = need._id;
    void getOrCreateThread({ activeNeedId: need._id }).catch((error: unknown) => {
      initThreadForRef.current = undefined;
      setScoutError(readableError(error));
    });
  }, [getOrCreateThread, need, scoutContext]);

  useEffect(() => {
    if (!threadId || !need) return;
    const mode = searchParams.get("mode");
    const signalId = searchParams.get("signalId") as Id<"signals"> | null;
    if (mode === "search_discovery") {
      if (scoutContext?.mode === mode) return;
      void setScoutFocus({ threadId, mode, activeNeedId: need._id }).catch((error: unknown) => setScoutError(readableError(error)));
      return;
    }
    if ((mode !== "signal_advisor" && mode !== "outreach_drafting") || !signalId) return;
    if (scoutContext?.mode === mode && scoutContext.focusedSignalId === signalId) return;
    void setScoutFocus({
      threadId,
      mode,
      activeNeedId: need._id,
      focusedSignalId: signalId,
    }).catch((error: unknown) => setScoutError(readableError(error)));
  }, [need, scoutContext?.focusedSignalId, scoutContext?.mode, searchParams, setScoutFocus, threadId]);

  const messages = useMemo<ScoutConversationMessage[]>(() => {
    const realMessages = [...paginatedMessages.results]
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((message) => ({
        id: message.key,
        author: message.role === "assistant" ? "scout" as const : message.role,
        body: message.text,
      }));
    if (realMessages.length > 0) return realMessages;
    return [{
      id: "scout-intro",
      author: "scout",
      body: memory?.facts.length
        ? "I have your saved music context with me. Tell me what kind of rehearsal situation you want now, and I’ll turn it into a search you control."
        : "Tell me about your band and the room you need — in your own words. I’ll remember the useful context and build a search you can review.",
    }];
  }, [memory?.facts.length, paginatedMessages.results]);

  async function send(message: string) {
    if (!threadId) return;
    setSending(true);
    setScoutError("");
    try {
      await sendScoutMessage({ threadId, message });
    } catch (error) {
      setScoutError(readableError(error));
    } finally {
      setSending(false);
    }
  }

  async function activateSearch() {
    if (!need) return;
    setActivating(true);
    setScoutError("");
    try {
      await setNeedStatus({ needId: need._id, status: "active" });
    } catch (error) {
      setScoutError(readableError(error));
    } finally {
      setActivating(false);
    }
  }

  async function focusForOutreach(signal: MarketSignal) {
    if (!threadId || !need) return;
    setScoutError("");
    try {
      await setScoutFocus({
        threadId,
        mode: "outreach_drafting",
        activeNeedId: need._id,
        focusedSignalId: signal.id as Id<"signals">,
      });
      setDraftSignal(signal);
      await sendScoutMessage({
        threadId,
        message: `Help me draft a careful inquiry about “${signal.title}”. First identify any missing recipient information. Do not approve or send anything.`,
      });
    } catch (error) {
      setScoutError(readableError(error));
    }
  }

  function dismissSignal(signalId: string) {
    setDismissedIds((current) => new Set([...current, signalId]));
  }

  if (!need) {
    return (
      <WorkspaceShell mode="musician">
        <PageHeader title="Your Room Scout" />
        <div className="rs-route-state"><LoaderState /></div>
      </WorkspaceShell>
    );
  }

  const search = needToSearch(need);
  const isDiscovery = need.status === "draft";
  const canActivate = need.city.trim().length > 0;

  if (isDiscovery) {
    return (
      <WorkspaceShell mode="musician">
        <PageHeader
          meta={
            <span className="rs-page-meta">
              {memory && memory.facts.length > 0 ? <span className="chip"><Sparkles aria-hidden="true" size={11} />{memory.facts.length} memories</span> : (
                <button className="btn btn-s btn-sm" onClick={() => setContextImportOpen(true)} type="button"><Sparkles aria-hidden="true" size={14} />Bring music context</button>
              )}
              <span className="mono live"><span className="dot dot-pulse" />Search discovery mode</span>
            </span>
          }
          title="Your Room Scout"
        />
        <div className="cols rs-scout-layout">
          <div className="stack">
            <button className="btn btn-s btn-sm" onClick={() => setVoiceOpen((value) => !value)} type="button">
              {voiceOpen ? <X aria-hidden="true" size={14} /> : <Mic aria-hidden="true" size={14} />}{voiceOpen ? "Close voice" : "Talk to Scout"}
            </button>
            {voiceOpen ? <RealtimeVoiceScout /> : (
              <ScoutConversation
                busy={sending || !threadId}
                error={scoutError}
                messages={messages}
                onSend={send}
                starters={paginatedMessages.results.length === 0 ? starters : []}
              />
            )}
          </div>
          <SearchProfileCard
            canConfirm={canActivate}
            confirming={activating}
            confirmationHint={canActivate ? "You can activate now and refine the rest with your Scout." : "Tell your Scout which city or area to search before activating."}
            fields={search.fields}
            onConfirm={activateSearch}
            progress={search.fields.length}
            search={search}
            totalFields={6}
          />
        </div>
        <ContextImportDialog onOpenChange={setContextImportOpen} open={contextImportOpen} />
      </WorkspaceShell>
    );
  }

  const matchBySignal = new Map((matches ?? []).map((match) => [match.signalId, match]));
  const realSignalCards = (publicSignals ?? []).map((signal) => {
    const match = matchBySignal.get(signal._id);
    const fit = match
      ? [...match.reasons, ...match.uncertainties.map((item) => `Uncertain: ${item}`)].join(" · ")
      : undefined;
    return signalToCard(signal, fit);
  });
  const displayName = currentUser?.displayName ?? currentUser?.username ?? "musician";
  const selectedDraft = draftSignal
    ? outreachDrafts?.find((draft) => draft.signalId === draftSignal.id && draft.savedNeedId === need._id)
    : undefined;

  return (
    <WorkspaceShell mode="musician">
      <PageHeader
        meta={<span className="rs-page-meta"><span className="mono live"><span className="dot dot-pulse" />{need.status === "paused" ? "Search paused" : "Search active"}</span></span>}
        title={`Good evening, ${displayName}`}
      />
      <div className="cols rs-scout-home-layout">
        <div className="stack">
          <button className="btn btn-s btn-sm" onClick={() => setVoiceOpen((value) => !value)} type="button"><Mic aria-hidden="true" size={14} />{voiceOpen ? "Use text Scout" : "Use voice Scout"}</button>
          {voiceOpen ? <RealtimeVoiceScout /> : <ScoutConversation busy={sending} compact error={scoutError} messages={messages} onSend={send} />}
          {draftSignal && !selectedDraft ? <div className="rs-memory-notice"><span className="dot dot-pulse" />The Scout is preparing a draft. The exact approval composer opens only after a real recipient and message have been persisted.</div> : null}
          {publicSignals === undefined || matches === undefined ? (
            <div className="rs-route-state">Matching the live index to your search…</div>
          ) : realSignalCards.length === 0 ? (
            <LedgerCard accent header={<span className="type t-scout">Scout briefing</span>}>
              <p className="brief">No indexed signals match {need.city || "this search"} yet. Your search remains active and will react when ingestion publishes a new signal.</p>
            </LedgerCard>
          ) : realSignalCards.filter((signal) => !dismissedIds.has(signal.id)).slice(0, 4).map((signal) => (
            <SignalCard key={signal.id} onDismiss={dismissSignal} onDraftOutreach={focusForOutreach} showActions signal={signal} />
          ))}
        </div>
        <div className="stack">
          <SearchProfileCard search={search} />
          <div className="actionsrow">
            <Link className="btn btn-s btn-sm" to="/app/scout?mode=search_discovery"><SlidersHorizontal aria-hidden="true" size={14} />Edit search</Link>
            <button className="btn btn-g btn-sm" onClick={() => setNeedStatus({ needId: need._id, status: need.status === "paused" ? "active" : "paused" })} type="button"><Pause aria-hidden="true" size={14} />{need.status === "paused" ? "Resume" : "Pause"}</button>
          </div>
          <LedgerCard header={<span className="type">Scout context</span>}>
            <table className="facts"><tbody>
              <tr><td>Facts</td><td>{memory?.facts.length ?? 0} durable memories</td></tr>
              <tr><td>Context</td><td>Version {memory?.profile?.contextVersion ?? 0}</td></tr>
              <tr><td>Semantics</td><td>{memory?.facts.filter((fact) => fact.embeddingState === "ready").length ?? 0} facts embedded</td></tr>
              <tr><td>Outreach</td><td>Exact approval required</td></tr>
            </tbody></table>
          </LedgerCard>
        </div>
      </div>
      {draftSignal && selectedDraft ? <ApprovalComposer
        draftId={selectedDraft._id}
        onApprove={() => setDraftSignal(undefined)}
        onOpenChange={(open) => { if (!open) setDraftSignal(undefined); }}
        open
        search={search}
        signal={draftSignal}
      /> : null}
    </WorkspaceShell>
  );
}

function LoaderState() {
  return <span className="mono live"><span className="dot dot-pulse" />Preparing your private Scout workspace…</span>;
}
