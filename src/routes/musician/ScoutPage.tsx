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
  // The musician's own bubble is on screen before the mutation resolves; the
  // Scout's half of the turn arrives on the thread as deltas.
  const sendMessage = useMutation(api.scout.send).withOptimisticUpdate(
    optimisticallySendMessage(listScoutMessages),
  );
  const decisions = useQuery(api.decisions.listOpenMine);
  const answerDecision = useMutation(api.decisions.answer);
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
  // The aside is the brief at a glance: at most five rows with the DS fact
  // glyphs, and the equipment cut to its first entry so the column stays a
  // list and not a paragraph.
  const asideFacts = useMemo(
    () => ["ort", "budget", "band", "zeit", "equip"]
      .map(id => facts.find(row => row.id === id))
      .filter((row): row is { id: string; label: string } => row !== undefined)
      .map(row => row.id === "equip" ? { id: row.id, label: row.label.split(" · ")[0]! } : row),
    [facts],
  );
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

  // Leaving the scene must never leave an invisible microphone session running.
  useEffect(() => voice.disconnect, [voice.disconnect]);

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
    try { await sendMessage({ threadId, prompt: body }); return true; }
    catch { setError(t("liveScout.error")); return false; }
  }
  function openChat() {
    if (voiceOpen || voice.connected) voice.disconnect();
    setVoiceOpen(false); setTextOpen(true);
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
  /**
   * „Scout losschicken“ — the one step that ends discovery. The conversation
   * closes with it (chat dialog and voice), because from here the stage says
   * „Ich kümmere mich darum“ and the Scout is no longer waiting for the brief.
   */
  function activateSearch() {
    if (!need) return;
    if (voiceOpen || voice.connected) voice.disconnect();
    setVoiceOpen(false); setTextOpen(false); setManualBrief(false); setDismissedReady(readyKey);
    void run(() => activate({ savedNeedId: need._id }));
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
      onOpen={conversationId => navigate(`/app/inbox/${conversationId}`)}
    />
  ) : undefined;
  // Discovery gets the mock's floating list with the §4.3 arrival: a fact the
  // Scout just understood flies from the conversation into the column and
  // lights up there, instead of being read back as prose in the chat (issue 2).
  // The working stages keep the quiet compact list beside the stage.
  const asideSlot = stage === "discovery"
    ? asideFacts.length
      ? <ArrivingFactList facts={asideFacts} title={t("liveScout.asideTitle")} className="w-full" />
      : undefined
    : need ? (
      <FactList facts={asideFacts} variant="compact" title={t("liveScout.asideTitle")} className="w-full">
        <Button variant="link" size="sm" className="mt-[var(--space-5)] self-start" onClick={() => navigate("/app/search")}>
          {t("liveScout.asideEdit")}
        </Button>
      </FactList>
    ) : undefined;
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
    chatSlot={!voiceOpen && (stage === "discovery" || (chatOpen && stage !== "brief")) ? <ScoutChat key={threadId ?? "loading"} messages={messages.length ? messages : [{ id: "intro", author: "scout", body: t("liveScout.intro") }]} onSend={send} replying={scoutBusy || !threadId} labels={chatLabels} error={error} onVoice={openVoice} autoFocus decision={openDecision} decisionOfferHash={decisionOfferHash} onAnswerDecision={async (decisionId, choice, text) => { await answerOpenDecision(decisionId, choice, text); }} decisionAnsweredText={t("liveScout.decisionAnswered")} hasMoreHistory={history.status === "CanLoadMore"} historyBusy={history.status === "LoadingMore"} onLoadHistory={() => history.loadMore(60)} /> : undefined}
    voiceSlot={voiceOpen ? <LiveVoiceChat onText={openChat} onEnd={() => { setVoiceOpen(false); setTextOpen(true); }} /> : undefined}
    providerUpdateSlot={offerSlot} offerSlot={offerSlot}
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
