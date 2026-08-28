import { Pause, Play, Sparkles, SlidersHorizontal } from "lucide-react";
import { useAction, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { ContextImportDialog } from "../../components/memory/ContextImportDialog";
import { WorkspaceShell } from "../../components/navigation/WorkspaceShell";
import { ApprovalComposer } from "../../components/outreach/ApprovalComposer";
import { ScoutConversation } from "../../components/scout/ScoutConversation";
import type { ScoutConversationMessage } from "../../components/scout/ScoutConversation";
import { SearchProfileCard } from "../../components/scout/SearchProfileCard";
import { SignalCard } from "../../components/signals/SignalCard";
import { FixtureNotice, LedgerCard, PageHeader } from "../../components/ui/LedgerCard";
import { demoNewSignal, demoSignals } from "../../mocks/demoData";
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
  if (need.schedule.length > 0) fields.push({ label: "Schedule", value: need.schedule.join(" · "), source: "you" });
  if (need.requirements.length > 0) fields.push({ label: "Essential", value: need.requirements.join(" · "), source: "you" });
  if (need.openToSharing !== undefined) fields.push({ label: "Sharing", value: need.openToSharing ? "Open to compatible room-sharing" : "Not looking to share", source: "you" });
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

export function ScoutPage() {
  const currentUser = useQuery(api.users.current);
  const needs = useQuery(api.savedNeeds.listMine, { limit: 10 });
  const scoutContext = useQuery(api.scout.getMine);
  const memory = useQuery(api.memory.listMine);
  const getOrCreateDraft = useMutation(api.savedNeeds.getOrCreateDraft);
  const getOrCreateThread = useMutation(api.scout.getOrCreateThread);
  const setNeedStatus = useMutation(api.savedNeeds.setStatus);
  const sendScoutMessage = useAction(api.scout.sendMessage);
  const initDraftRef = useRef(false);
  const initThreadForRef = useRef<string | undefined>(undefined);
  const [sending, setSending] = useState(false);
  const [activating, setActivating] = useState(false);
  const [scoutError, setScoutError] = useState("");
  const [contextImportOpen, setContextImportOpen] = useState(false);
  const [newSignalVisible, setNewSignalVisible] = useState(false);
  const [draftSignal, setDraftSignal] = useState<MarketSignal>();
  const [dismissedIds, setDismissedIds] = useState(() => new Set<string>());
  const [approvalRecorded, setApprovalRecorded] = useState(false);

  const need = needs?.[0];
  const threadId = need && scoutContext?.activeNeedId === need._id
    ? scoutContext.threadId
    : undefined;
  const paginatedMessages = usePaginatedQuery(
    api.scout.listMessages,
    threadId ? { threadId } : "skip",
    { initialNumItems: 60 },
  );

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
          <ScoutConversation
            busy={sending || !threadId}
            error={scoutError}
            messages={messages}
            onSend={send}
            starters={paginatedMessages.results.length === 0 ? starters : []}
          />
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

  const primarySignal = demoSignals[0];
  if (!primarySignal) return null;
  const displayName = currentUser?.displayName ?? currentUser?.username ?? "musician";

  return (
    <WorkspaceShell mode="musician">
      <PageHeader
        meta={<span className="rs-page-meta"><FixtureNotice /><span className="mono live"><span className="dot dot-pulse" />{need.status === "paused" ? "Search paused" : "Search active"}</span></span>}
        title={`Good evening, ${displayName}`}
      />
      <div className="cols rs-scout-home-layout">
        <div className="stack">
          <ScoutConversation busy={sending} compact error={scoutError} messages={messages} onSend={send} />
          <LedgerCard accent header={<><span className="type t-scout">Market preview</span><span className="mono">Example signals until ingestion is connected</span></>}>
            <p className="brief">The live Scout and memory above use your real data. The signal cards below still demonstrate the next market-data connection.</p>
          </LedgerCard>
          {!dismissedIds.has(primarySignal.id) ? <SignalCard onDismiss={dismissSignal} onDraftOutreach={setDraftSignal} onSave={() => undefined} showActions signal={primarySignal} /> : null}
          {newSignalVisible && !dismissedIds.has(demoNewSignal.id) ? <SignalCard onDismiss={dismissSignal} onDraftOutreach={setDraftSignal} showActions signal={demoNewSignal} /> : null}
          <LedgerCard header={<><span className="type">Also new</span><Link className="mono" to="/app/explore">All results →</Link></>}>
            <ul className="tl rs-activity-list">
              {demoSignals.slice(1, 3).map((signal) => <li key={signal.id}><span className="mono">{signal.side}</span><Link to={`/signals/${signal.id}`}>{signal.title}</Link></li>)}
            </ul>
          </LedgerCard>
          {approvalRecorded ? <div className="rs-memory-notice"><span className="dot" />Approval captured in the prototype; no email was sent.</div> : null}
        </div>
        <div className="stack">
          <SearchProfileCard search={search} />
          <div className="actionsrow">
            <Link className="btn btn-s btn-sm" to="/app/search"><SlidersHorizontal aria-hidden="true" size={14} />Edit search</Link>
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
      <button className="demo-trigger" disabled={newSignalVisible} onClick={() => setNewSignalVisible(true)} type="button"><Play aria-hidden="true" size={12} />{newSignalVisible ? "Demo signal shown" : "Demo: reveal new signal"}</button>
      <ApprovalComposer
        onApprove={() => { setApprovalRecorded(true); setDraftSignal(undefined); }}
        onOpenChange={(open) => { if (!open) setDraftSignal(undefined); }}
        open={Boolean(draftSignal)}
        search={search}
        signal={draftSignal ?? primarySignal}
      />
    </WorkspaceShell>
  );
}

function LoaderState() {
  return <span className="mono live"><span className="dot dot-pulse" />Preparing your private Scout workspace…</span>;
}
