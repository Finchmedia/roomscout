import { optimisticallySendMessage, useUIMessages } from "@convex-dev/agent/react";
import type { UIMessage } from "@convex-dev/agent/react";
import type { StreamArgs, SyncStreamsReturnValue } from "@convex-dev/agent";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReference, PaginationOptions, PaginationResult } from "convex/server";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "../../components/ui/button";
import { FactList } from "../../components/ui/fact-list";
import { DecisionCard } from "../../components/scout/DecisionCard";
import { LiveProviderOffer } from "../../components/opportunities/LiveProviderOffer";
import { LiveProfileMenu } from "../../components/navigation/LiveProfileMenu";
import { ConversationThread } from "../../ui/inbox/ConversationThread";
import { LiveVoiceChat } from "../../ui/chat/LiveVoiceChat";
import { useVoiceSession } from "../../components/voice/VoiceSessionContext";
import { factsFromNeed } from "../../features/scout/viewModel";
import { useCopy } from "../../ui/copy";
import { formatMessageStamp } from "../../ui/copy/format";
import { ScoutChat } from "../../ui/chat/ScoutChat";
import { THINKING_VERB_KEYS } from "../../ui/chat/thinkingVerbs";
import { ArrivingFactList, CandidateList, LiveScoutSurface, deriveLiveScoutStage } from "../../ui/scout/live";

/**
 * `api.scout.listMessages` returns UIMessages whose parts are deliberately
 * narrower than the Agent's: the server keeps the prose and the fact that a
 * tool ran, and drops every tool input and output before they leave Convex.
 * The Agent's hooks are typed against the full shape, so the reference is
 * restated here. Only the fields both shapes really carry are read below:
 * `key`, `role`, `text`, `status`, `order`, `stepOrder` and a part's
 * `type` / `toolCallId` / `state`.
 */
type ScoutMessagesQuery = FunctionReference<
  "query",
  "public",
  { threadId: string; paginationOpts: PaginationOptions; streamArgs?: StreamArgs },
  PaginationResult<UIMessage> & { streams: SyncStreamsReturnValue }
>;
const listScoutMessages = api.scout.listMessages as unknown as ScoutMessagesQuery;

/** Live queries and actions; no scripted demo transitions or fabricated facts. */
export function ScoutPage() {
  const { t, locale } = useCopy();
  const voice = useVoiceSession();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentUser = useQuery(api.users.current);
  const needs = useQuery(api.savedNeeds.listMine, { limit: 10 });
  const context = useQuery(api.scout.getMine);
  const getOrCreateDraft = useMutation(api.savedNeeds.getOrCreateDraft);
  const getOrCreateThread = useMutation(api.scout.getOrCreateThread);
  const setFocus = useMutation(api.scout.setFocus);
  const setStatus = useMutation(api.savedNeeds.setStatus);
  const activate = useMutation(api.savedNeeds.activate);
  const updateNeed = useMutation(api.savedNeeds.update);
  const replyToConversation = useMutation(api.conversations.reply);
  const markConversationRead = useMutation(api.conversations.markRead);
  // The musician's own bubble is on screen before the mutation resolves; the
  // Scout's half of the turn arrives on the thread as deltas.
  const sendMessage = useMutation(api.scout.send).withOptimisticUpdate(
    optimisticallySendMessage(listScoutMessages),
  );
  const decisions = useQuery(api.decisions.listOpenMine);
  const answerDecision = useMutation(api.decisions.answer);
  const [focusedConversationId, setFocusedConversationId] = useState<Id<"providerConversations">>();
  const focusedThread = useQuery(api.conversations.getMine, focusedConversationId ? { conversationId: focusedConversationId } : "skip");
  const [briefEdit, setBriefEdit] = useState<{ needId: Id<"savedNeeds">; revision: number; field: "budget" | "schedule"; value: string }>();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [textOpen, setTextOpen] = useState(false);
  // One Entscheidung is answered at a time; the buttons on the stage go quiet
  // while the mutation is in flight.
  const [answeringDecision, setAnsweringDecision] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(() => voice.connected);
  const [manualBrief, setManualBrief] = useState(false);
  const [dismissedReady, setDismissedReady] = useState("");
  const draftStarting = useRef(false);
  const threadStarting = useRef<string | undefined>(undefined);
  const need = context === undefined ? undefined :
    needs?.find(row => row._id === context?.activeNeedId && row.status !== "archived") ??
    needs?.find(row => row.status !== "archived");
  const threadId = need && context?.activeNeedId === need._id ? context.threadId : undefined;
  const history = useUIMessages(listScoutMessages, threadId ? { threadId } : "skip", { initialNumItems: 60, stream: true });
  const matches = useQuery(api.matches.listMine, need ? { savedNeedId: need._id, limit: 30 } : "skip");
  const conversationRows = useQuery(api.providerConversations.listMine, need ? { savedNeedId: need._id, limit: 50 } : "skip");
  const conversations = Array.isArray(conversationRows) && need ? conversationRows.filter(row => row.savedNeedId === need._id) : [];
  // The candidate rail: the same rows the Nachrichten list shows, narrowed to
  // this Suchauftrag and to the conversations that are still running.
  const inboxRows = useQuery(api.conversations.listMine, { limit: 20 });
  const candidates = (Array.isArray(inboxRows) && need ? inboxRows : [])
    .filter(row => row.savedNeedId === need?._id && row.state !== "closed")
    .sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  const actions = useQuery(api.externalActions.listMine, need ? { savedNeedId: need._id, limit: 50 } : "skip");
  const latestSend = (actions ?? []).find(row => row.savedNeedId === need?._id && ["send_email", "submit_webform", "send_platform_dm"].includes(row.requestedActionType));
  const ready = conversations.find(row => row.offer?.current && row.offer.ready);
  const accepted = conversations.find(row => (row.acceptedOfferId && row.acceptedAt !== undefined) || row.acceptanceStatus === "executed");
  const updated = conversations.find(row => row.offer?.current && row.assessmentFromProviderReply);
  const selected = accepted ?? ready ?? updated;
  // The newest open Entscheidung; every gate ask_user, provider question and portal human step raises one.
  const openDecision = Array.isArray(decisions) && decisions.length ? decisions[0] : undefined;
  const decisionOfferHash = openDecision?.kind === "offer_ready" && openDecision.refs.offerId
    ? (Array.isArray(conversationRows) ? conversationRows : []).find(row => row.offer?.offerId === openDecision.refs.offerId)?.offer?.contentHash
    : undefined;
  // The Entscheidung is answered on the stage now, so a new one no longer
  // opens the chat by itself — „Lieber schreiben“ is the way in.
  const chatOpen = textOpen;
  // One clock reading per mount: the rail's stamps must not re-render on their own.
  const [now] = useState(() => Date.now());
  // „Euer Suchauftrag“ in one place: the view model owns the German labels, the
  // facet allowlist and the deduplication, so nothing here can put a raw facet
  // key or a repeated genre on screen (issue 3 of the 2026-09-15 test run).
  const facts = useMemo(
    () => (need ? factsFromNeed(need, t).map(fact => ({ id: fact.key, label: fact.value })) : []),
    [need, t],
  );
  const asideFacts = facts;
  const messages = [...history.results]
    .sort((a, b) => a.order - b.order || a.stepOrder - b.stepOrder)
    .map(row => ({
      id: row.key, author: row.role === "assistant" ? "scout" as const : row.role, body: row.text,
      status: row.status, parts: row.parts,
    }));
  // The turn in flight, read off the thread: a musician message the Scout has
  // not answered yet, or a reply that is still pending or streaming. Nothing
  // here survives a reload that the server does not also know about.
  const newestMessage = messages.at(-1);
  const scoutBusy = newestMessage !== undefined && newestMessage.status !== "failed" &&
    (newestMessage.author === "user" || newestMessage.status === "pending" || newestMessage.status === "streaming");
  const readiness = context?.briefReadiness;
  const readyKey = readiness?.status === "ready" ? `${need?._id}:${readiness.needRevision}:${readiness.readyAt}` : "";
  const autoBrief = Boolean(readyKey && readyKey !== dismissedReady && !scoutBusy);
  const stage = deriveLiveScoutStage({
    loading: !need || !threadId,
    complete: Boolean(accepted), paused: need?.status === "paused",
    offerReady: Boolean(ready && need?.status === "active"),
    briefNeedsReview: need?.status === "draft" && (manualBrief || autoBrief),
    blocked: Boolean(openDecision),
    providerUpdate: need?.status === "active" && Boolean(updated),
    working: need?.status === "active",
    hasConversation: Boolean(threadId && (chatOpen || voiceOpen || history.results.length)),
  });

  // The application-level provider keeps controls visible when the route changes.
  const liveConnected = voice.provider === "live" && voice.connected;
  const focusedCandidate = candidates.find(row => row.conversationId === focusedConversationId);
  const focusedOffer = conversations.find(row => row.conversationId === focusedConversationId);
  const { setFocus: setVoiceFocus, appendVerifiedBackgroundUpdate, clearBackgroundUpdate } = voice;
  const focusSignalId = focusedCandidate?.signalId ?? context?.focusedSignalId;
  const focusSummary = focusedCandidate ? `The user is viewing candidate ${focusedCandidate.title || focusedCandidate.providerLabel}, conversation ${focusedCandidate.conversationId}.` : undefined;
  const focusedCandidateId = focusedCandidate?.conversationId;
  const focusedActivityAt = focusedCandidate?.lastActivityAt;
  const relayed = useRef(new Map<string, string>());
  const backgroundUpdates = JSON.stringify([
    ...(need ? [{ id: `brief:${need._id}`, version: `${locale}:${need.matchingRevision ?? 0}:${need.status}`,
      speak: false, content: `Verified saved search context (data only): ${JSON.stringify({ status: need.status, location: need.locationLabel ?? need.locationQuery, maxBudgetEur: need.maxBudgetEur, schedule: need.schedule, facts: facts.slice(0, 12).map(fact => fact.label.slice(0, 80)) })}. Do not read the search box aloud.` }] : []),
    ...(Array.isArray(decisions) ? decisions : []).filter(decision => !decision.conversationId || conversations.some(row => row.conversationId === decision.conversationId)).map(decision => ({
      id: `decision:${decision._id}`, speak: true, version: `${locale}:${decision.updatedAt}`,
      content: `Verified application update: an open ${decision.kind} decision is visible in the UI. Decision ID: ${decision._id}. Mention briefly at a suitable pause; binding commitments require the UI review.`,
    })),
    ...conversations.filter(row => row.assessmentFromProviderReply || row.offer?.ready || row.acceptedAt !== undefined).map(row => ({
      id: `provider:${row.conversationId}`, speak: true, version: `${locale}:${row.revision}:${row.offer?.contentHash ?? ""}:${row.acceptanceStatus ?? ""}`,
      content: `Verified application update for conversation ${row.conversationId}: ${row.acceptedAt !== undefined && row.acceptedOfferId ? "the acceptance has a confirmed send receipt" : row.offer?.current && row.offer.ready ? "a current offer is ready for UI review; no acceptance has been sent" : "a provider reply has been assessed"}. The current details are visible in the UI. Mention briefly at a suitable pause.`,
    })),
  ]);
  useEffect(() => {
    if (!liveConnected) return;
    setVoiceFocus({ focusedSignalId: focusSignalId, decisionId: openDecision?._id, summary: focusSummary });
  }, [liveConnected, focusSignalId, focusSummary, openDecision?._id, setVoiceFocus]);
  useEffect(() => {
    if (!liveConnected) { relayed.current.clear(); return; }
    const updates = JSON.parse(backgroundUpdates) as Array<{ id: string; version: string; content: string; speak?: boolean }>;
    const currentIds = new Set(updates.map(update => update.id));
    for (const id of relayed.current.keys()) {
      if (!currentIds.has(id)) { clearBackgroundUpdate(id); relayed.current.delete(id); }
    }
    for (const update of updates) {
      if (relayed.current.get(update.id) === update.version) continue;
      appendVerifiedBackgroundUpdate(update);
      relayed.current.set(update.id, update.version);
    }
  }, [liveConnected, backgroundUpdates, appendVerifiedBackgroundUpdate, clearBackgroundUpdate]);
  useEffect(() => {
    if (!focusedCandidateId) return;
    void markConversationRead({ conversationId: focusedCandidateId }).catch(() => undefined);
  }, [focusedCandidateId, focusedActivityAt, markConversationRead]);

  useEffect(() => {
    if (needs === undefined || needs.some(row => row.status !== "archived") || draftStarting.current) return;
    draftStarting.current = true;
    void getOrCreateDraft().catch(() => { draftStarting.current = false; setError(t("liveScout.error")); });
  }, [needs, getOrCreateDraft, t]);
  useEffect(() => {
    if (!need || context === undefined || context?.activeNeedId === need._id || threadStarting.current === need._id) return;
    threadStarting.current = need._id;
    void getOrCreateThread({ activeNeedId: need._id }).catch(() => { threadStarting.current = undefined; setError(t("liveScout.error")); });
  }, [need, context, getOrCreateThread, t]);
  useEffect(() => {
    if (!threadId || !need) return;
    const mode = searchParams.get("mode");
    const signalId = searchParams.get("signalId") as Id<"signals"> | null;
    if (mode === "search_discovery" && context?.mode !== mode) {
      void setFocus({ threadId, mode, activeNeedId: need._id }).catch(() => setError(t("liveScout.error")));
    } else if ((mode === "signal_advisor" || mode === "outreach_drafting") && signalId && (context?.mode !== mode || context.focusedSignalId !== signalId)) {
      void setFocus({ threadId, mode, activeNeedId: need._id, focusedSignalId: signalId }).catch(() => setError(t("liveScout.error")));
    }
  }, [context, need, searchParams, setFocus, threadId, t]);

  async function run(task: () => Promise<unknown>) {
    if (working) return;
    setWorking(true); setError("");
    try { await task(); } catch { setError(t("liveScout.error")); } finally { setWorking(false); }
  }
  async function send(body: string) {
    if (!threadId) return false;
    setError("");
    if (liveConnected) return voice.sendText(body);
    try { await sendMessage({ threadId, prompt: body }); return true; }
    catch { setError(t("liveScout.error")); return false; }
  }
  function openChat() {
    setTextOpen(true);
    setManualBrief(false); setDismissedReady(readyKey);
  }
  function openVoice() { setVoiceOpen(true); if (!voice.connected) void voice.connect(); }
  function editBrief() { setManualBrief(false); setDismissedReady(readyKey); openChat(); }
  // Answering closes the Entscheidung server-side; `listOpenMine` drops it and
  // the stage leaves „blocked“ on its own — nothing is hidden optimistically.
  async function answerOpenDecision(decisionId: Id<"decisions">, choice: string, text?: string) {
    if (answeringDecision) return;
    setAnsweringDecision(true); setError("");
    try { await answerDecision(text === undefined ? { decisionId, choice } : { decisionId, choice, text }); }
    // The card only marks itself answered when the mutation resolved, so the
    // failure has to reach it — the message beside the stage is this page's.
    catch (cause) { setError(t("liveScout.error")); throw cause; }
    finally { setAnsweringDecision(false); }
  }
  function activateSearch() {
    if (!need) return;
    setManualBrief(false); setDismissedReady(readyKey);
    if (liveConnected) {
      if (!voice.sendText(locale === "de" ? "Starte die Suche jetzt mit meinen aktuellen Angaben." : "Start the search now using my current requirements.")) setError(t("liveScout.error"));
      return;
    }
    void run(() => activate({ savedNeedId: need._id }));
  }
  function beginBriefEdit(field: "budget" | "schedule") {
    if (!need) return;
    setError("");
    setBriefEdit({ needId: need._id, revision: need.matchingRevision ?? 0, field,
      value: field === "budget" ? String(need.maxBudgetEur ?? "") : (need.schedule ?? []).join(", ") });
  }
  async function saveBriefEdit() {
    if (!briefEdit || !need || briefEdit.needId !== need._id || working) return;
    const budget = Number(briefEdit.value);
    if (briefEdit.field === "budget" && (!briefEdit.value.trim() || !Number.isFinite(budget) || budget < 0)) { setError(t("liveScout.error")); return; }
    setWorking(true); setError("");
    try {
      await updateNeed({ needId: briefEdit.needId, expectedRevision: briefEdit.revision,
        ...(briefEdit.field === "budget" ? { maxBudgetEur: budget } : { schedule: briefEdit.value.split(",").map(value => value.trim()).filter(Boolean) }) });
      setBriefEdit(undefined);
    } catch { setError(t("liveScout.error")); }
    finally { setWorking(false); }
  }
  const offerTitle = matches?.find(row => row.signal._id === selected?.signalId)?.signal.title;
  const offerSlot = selected ? <LiveProviderOffer key={selected.conversationId} conversation={selected} title={offerTitle} /> : null;
  // Approval waits are Entscheidungen now (stage "blocked"); only a failed send still blocks here.
  const blocked = latestSend?.status === "failed";
  const workHeading = blocked ? t("liveScout.blocked") : latestSend?.status === "executed" ? t("liveScout.waiting") :
    latestSend && ["approved", "queued", "executing"].includes(latestSend.status) ? t("liveScout.sending") : t("liveScout.working");
  // The chat's live states; the tool line names what the Scout is doing, never
  // what it passed or got back.
  const chatLabels = {
    thinking: t("liveScout.thinking"), replying: t("liveScout.replying"),
    scrollToEnd: t("liveScout.scrollToEnd"),
    // The rotating status verbs come from the dictionary, not from the chat's
    // own German fallback — `THINKING_VERB_KEYS` is the rotation order.
    thinkingVerbs: THINKING_VERB_KEYS.map(key => t(key)),
    failed: t("liveScout.failed"), retry: t("liveScout.retry"),
    toolDefault: t("liveScout.tools.default"),
    tools: {
      rememberFact: t("liveScout.tools.rememberFact"),
      updateSearchDraft: t("liveScout.tools.updateSearchDraft"),
      markSearchBriefReady: t("liveScout.tools.markSearchBriefReady"),
      answerDecision: t("liveScout.tools.answerDecision"),
      replyToProvider: t("liveScout.tools.replyToProvider"),
      createOutreachDraft: t("liveScout.tools.createOutreachDraft"),
      createWebformDraft: t("liveScout.tools.createWebformDraft"),
      continueAutopilot: t("liveScout.tools.continueAutopilot"),
    },
  };
  // The Entscheidung on the stage is the same card the chat shows — prepared
  // answers, the Entscheidung's own text field, and for `offer_ready` the one
  // „Angebot prüfen“ that opens the acceptance review right here instead of
  // routing the musician through the chat for a second click (issue 7).
  const decisionSlot = openDecision ? (
    <div className="flex flex-col items-center gap-[var(--space-7)]">
      <DecisionCard
        decision={openDecision}
        offerHash={decisionOfferHash}
        busy={answeringDecision}
        onAnswer={(choice, _label, text) => answerOpenDecision(openDecision._id, choice, text)}
      />
      <Button variant="ghost" size="sm" onClick={openChat}>{t("liveScout.decisionWrite")}</Button>
    </div>
  ) : undefined;
  // The rail belongs to the working stages; a draft has nobody to talk to yet,
  // so discovery gets the aside alone and the conversation keeps the room.
  const railSlot = need && need.status !== "draft" ? (
    <CandidateList
      candidates={candidates.map(row => ({
        conversationId: row.conversationId, title: row.title || row.providerLabel, subtitle: row.subtitle,
        state: row.state, lastActivityAt: row.lastActivityAt, unread: row.unread,
        hasOpenDecision: row.openDecision !== undefined,
      }))}
      copy={{
        title: t("liveScout.candidatesTitle"), empty: t("liveScout.candidatesEmpty"),
        question: t("liveScout.candidateState.question"), offer: t("liveScout.candidateState.offer"),
        reply: t("liveScout.candidateState.reply"), asked: t("liveScout.candidateState.asked"),
      }}
      formatStamp={at => formatMessageStamp(locale, at, now, { short: true })}
      onOpen={conversationId => setFocusedConversationId(conversationId as Id<"providerConversations">)}
    />
  ) : undefined;
  const briefActions = <div className="mt-[var(--space-5)] flex flex-col gap-[var(--space-4)]">
    {briefEdit && briefEdit.needId === need?._id ? <form onSubmit={event => { event.preventDefault(); void saveBriefEdit(); }} className="flex flex-col gap-3 text-left">
      <label className="text-sm text-rs-ink-2">{t(briefEdit.field === "budget" ? "liveScout.budgetLabel" : "liveScout.scheduleLabel")}
        <input autoFocus type={briefEdit.field === "budget" ? "number" : "text"} min={0} step="any" value={briefEdit.value}
          onChange={event => setBriefEdit({ ...briefEdit, value: event.target.value })}
          className="mt-2 w-full rounded-chip border border-rs-border-control bg-rs-surface-card p-2 text-rs-ink" />
      </label>
      <Button size="sm" type="submit" disabled={working}>{t("liveScout.saveChanges")}</Button>
      <Button variant="ghost" size="sm" type="button" onClick={() => setBriefEdit(undefined)}>{t("liveScout.cancelChanges")}</Button>
    </form> : <div className="flex flex-wrap gap-2">
      <Button variant="link" size="sm" onClick={() => beginBriefEdit("budget")}>{t("liveScout.editBudget")}</Button>
      <Button variant="link" size="sm" onClick={() => beginBriefEdit("schedule")}>{t("liveScout.editSchedule")}</Button>
    </div>}
    {need?.status === "draft" && voiceOpen ? <>
      {autoBrief ? <p role="status" className="text-sm text-rs-ink-4">{t("liveScout.ready")}</p> : null}
      <Button size="sm" disabled={working || (!liveConnected && scoutBusy) || !need.locationQuery?.trim() || need.radiusKm === undefined} onClick={activateSearch}>{t("liveScout.activate")}</Button>
      <p className="text-xs text-rs-ink-4">{t("liveScout.activateNote")}</p>
    </> : null}
  </div>;
  const asideSlot = need ? <ArrivingFactList facts={asideFacts} animationKey={`${need._id}:${locale}`} title={t("liveScout.asideTitle")} className="w-full">
    {briefActions}
  </ArrivingFactList> : undefined;
  const detailSlot = focusedConversationId ? <section className="flex h-[min(680px,70vh)] min-h-[360px] flex-col overflow-hidden rounded-card border border-rs-border-card bg-rs-surface-card" aria-label={t("liveInbox.title")}>
    <div className="flex justify-end p-2"><Button variant="ghost" size="sm" onClick={() => setFocusedConversationId(undefined)}>{t("common.close")}</Button></div>
    {focusedThread ? <ConversationThread key={focusedConversationId} header={focusedThread.header} items={focusedThread.items} now={now}
      offerConversation={focusedOffer} offerTitle={focusedThread.header.title || undefined}
      onSend={async body => { try { await replyToConversation({ conversationId: focusedConversationId, body }); return true; } catch { setError(t("liveInbox.errorGeneric")); return false; } }}
      onAnswerDecision={answerOpenDecision} /> : <p role="status">{t("liveInbox.threadLoading")}</p>}
  </section> : undefined;
  const brief = <FactList facts={facts} variant="card" title={t("scout.brief.title")}>
    <div className="mt-[var(--space-8)] flex flex-col items-center gap-[var(--space-6)]">
      {need?.status === "draft" ? <>
        {autoBrief ? <p role="status" className="text-sm text-rs-ink-4">{t("liveScout.ready")}</p> : null}
        <Button size="md" block disabled={working || scoutBusy || !need.locationQuery?.trim() || need.radiusKm === undefined} onClick={activateSearch}>{t(working ? "liveScout.activating" : "liveScout.activate")}</Button>
        <p className="text-center text-sm leading-relaxed text-rs-ink-4">{t("liveScout.activateNote")}</p>
        <Button variant="link" size="sm" onClick={editBrief}>{t("liveScout.editBrief")}</Button>
      </> : null}
    </div>
  </FactList>;
  return <LiveScoutSurface stage={stage} band={{ displayName: currentUser?.displayName ?? currentUser?.username ?? "" }}
    profileMenuSlot={<LiveProfileMenu name={currentUser?.displayName ?? currentUser?.username ?? ""} operator={currentUser?.role === "operator"} />}
    copy={{
      avatarLabel: t("scout.chrome.avatar.aria"), welcomeGreeting: name => t("scout.welcome.greeting", { name }),
      welcomeHeadline: t("scout.welcome.headline"), welcomeVoiceAction: t("scout.welcome.cta.voice"), welcomeChatAction: t("scout.welcome.cta.text"),
      discoveryLabel: t("scout.discovery.speaker.scout"), loadingHeadline: t("liveScout.preparing"), loadingStatus: "",
      briefHeadline: t("scout.brief.headline"),
      workingHeadline: workHeading, workingStatus: t(blocked ? "liveScout.blockedDetail" : "liveScout.workingDetail"),
      // The card states the question; the stage only frames it.
      blockedHeadline: t("liveScout.blocked"), blockedStatus: openDecision ? "" : t("liveScout.blockedDetail"),
      providerUpdateHeadline: t("liveScout.reply"), providerUpdateStatus: t("liveScout.replyDetail"),
      pausedHeadline: t("liveScout.paused"), pausedStatus: t("liveScout.pausedDetail"),
      pauseAction: t("scout.chrome.pause.pause"), resumeAction: t("scout.chrome.pause.resume"), settingsAction: t("scout.chrome.menu.settings"),
      briefReviewAction: t("liveScout.briefReviewAction"), activeStatus: t("liveScout.activeStatus"), pausedLabel: t("liveScout.pausedLabel"),
      chatTitle: t("liveScout.chatTitle"),
      openCandidates: t("liveScout.openCandidates"), openBrief: t("liveScout.openBrief"),
      offerHeadline: t("liveScout.offer"), completeHeadline: t("liveScout.complete"), completeStatus: t("liveScout.completeDetail"),
    }}
    briefReviewSlot={brief}
    briefExpanded={manualBrief}
    chatSlot={((!voiceOpen && stage === "discovery") || (chatOpen && (voiceOpen || stage !== "brief")) || Boolean(voice.pendingTextDraft)) ? <ScoutChat key={threadId ?? "loading"} messages={messages.length ? messages : [{ id: "intro", author: "scout", body: t("liveScout.intro") }]} onSend={send} replying={(!liveConnected && scoutBusy) || !threadId} restoredDraft={voice.pendingTextDraft || undefined} onDraftRestored={voice.clearPendingTextDraft} labels={chatLabels} error={error} onVoice={openVoice} autoFocus decision={openDecision} decisionOfferHash={decisionOfferHash} onAnswerDecision={async (decisionId, choice, text) => { await answerOpenDecision(decisionId, choice, text); }} decisionAnsweredText={t("liveScout.decisionAnswered")} hasMoreHistory={history.status === "CanLoadMore"} historyBusy={history.status === "LoadingMore"} onLoadHistory={() => history.loadMore(60)} /> : undefined}
    voiceSlot={voiceOpen ? <LiveVoiceChat onText={openChat} onEnd={() => { setVoiceOpen(false); setTextOpen(true); }} /> : undefined}
    providerUpdateSlot={offerSlot} offerSlot={offerSlot} detailSlot={detailSlot}
    decisionSlot={decisionSlot} railSlot={railSlot} asideSlot={asideSlot}
    completeSlot={<Link className="text-rs-ink-2 underline underline-offset-4" to="/app/inbox">{t("liveScout.viewMessages")}</Link>}
    errorSlot={error ? <p role="alert">{error}</p> : undefined}
    onChat={openChat} onCloseChat={() => setTextOpen(false)} onVoice={openVoice} onReviewBrief={() => setManualBrief(value => !value)}
    onActivate={activateSearch}
    onPause={() => { if (need) void run(() => setStatus({ needId: need._id, status: "paused" })); }}
    onResume={() => { if (need) void run(() => setStatus({ needId: need._id, status: "active" })); }}
    onSettings={() => { if (voiceOpen || voice.connected) voice.disconnect(); navigate("/app/settings"); }}
  />;
}
