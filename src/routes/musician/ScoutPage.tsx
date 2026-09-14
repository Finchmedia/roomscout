import { optimisticallySendMessage, useUIMessages } from "@convex-dev/agent/react";
import type { UIMessage } from "@convex-dev/agent/react";
import type { StreamArgs, SyncStreamsReturnValue } from "@convex-dev/agent";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReference, PaginationOptions, PaginationResult } from "convex/server";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "../../components/ui/button";
import { FactList } from "../../components/ui/fact-list";
import { LiveProviderOffer } from "../../components/opportunities/LiveProviderOffer";
import { LiveProfileMenu } from "../../components/navigation/LiveProfileMenu";
import { LiveVoiceChat } from "../../ui/chat/LiveVoiceChat";
import { useVoiceSession } from "../../components/voice/VoiceSessionContext";
import { factsFromNeed } from "../../features/scout/viewModel";
import { useCopy } from "../../ui/copy";
import { ScoutChat } from "../../ui/chat/ScoutChat";
import { LiveScoutSurface, deriveLiveScoutStage } from "../../ui/scout/live";

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
  const { t } = useCopy();
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
  // The Entscheidung the musician closed the chat on; a newer one opens the chat again.
  const [dismissedDecisionId, setDismissedDecisionId] = useState<string | undefined>(undefined);
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
  // A new Entscheidung opens the chat by itself unless the musician is talking or closed it already.
  const chatOpen = textOpen || Boolean(openDecision && openDecision._id !== dismissedDecisionId && !voiceOpen && !voice.connected);
  const rawFacts = need ? factsFromNeed(need) : [];
  const facts = rawFacts.map(fact => {
    let value = fact.value;
    if (need && fact.key === "arrangement") value = need.arrangement.map(item => t(`liveScout.${item}`)).join(" · ");
    if (need && fact.key === "budget") value = `Bis ${need.maxBudgetEur} € / Monat`;
    if (need && fact.key === "sharing") value = t(need.openToSharing ? "liveScout.sharingYes" : "liveScout.sharingNo");
    if (need && fact.key === "connections") value = t(need.collaborationOpen ? "liveScout.connectionsYes" : "liveScout.connectionsNo");
    return { id: ({ location: "ort", budget: "budget", schedule: "zeit", requirements: "equip" } as Record<string, string>)[fact.key] ?? fact.key, label: value };
  });
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
  const brief = <FactList facts={facts} variant="card" title={t("scout.brief.title")}>
    <div className="mt-[var(--space-8)] flex flex-col items-center gap-[var(--space-6)]">
      {need?.status === "draft" ? <>
        {autoBrief ? <p role="status" className="text-sm text-rs-ink-4">{t("liveScout.ready")}</p> : null}
        <Button size="md" block disabled={working || scoutBusy || !need.locationQuery?.trim() || need.radiusKm === undefined} onClick={() => void run(() => activate({ savedNeedId: need._id }))}>{t(working ? "liveScout.activating" : "liveScout.activate")}</Button>
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
      blockedHeadline: t("liveScout.blocked"), blockedStatus: openDecision?.question || t("liveScout.blockedDetail"),
      providerUpdateHeadline: t("liveScout.reply"), providerUpdateStatus: t("liveScout.replyDetail"),
      pausedHeadline: t("liveScout.paused"), pausedStatus: t("liveScout.pausedDetail"),
      pauseAction: t("scout.chrome.pause.pause"), resumeAction: t("scout.chrome.pause.resume"), settingsAction: t("scout.chrome.menu.settings"),
      briefReviewAction: t("liveScout.briefReviewAction"), activeStatus: t("liveScout.activeStatus"), pausedLabel: t("liveScout.pausedLabel"),
      chatTitle: t("liveScout.chatTitle"),
      offerHeadline: t("liveScout.offer"), completeHeadline: t("liveScout.complete"), completeStatus: t("liveScout.completeDetail"),
    }}
    briefReviewSlot={brief}
    briefExpanded={manualBrief}
    chatSlot={!voiceOpen && (stage === "discovery" || (chatOpen && stage !== "brief")) ? <ScoutChat key={threadId ?? "loading"} messages={messages.length ? messages : [{ id: "intro", author: "scout", body: t("liveScout.intro") }]} onSend={send} replying={scoutBusy || !threadId} labels={chatLabels} error={error} onVoice={openVoice} autoFocus decision={openDecision} decisionOfferHash={decisionOfferHash} onAnswerDecision={async (decisionId, choice) => { await answerDecision({ decisionId, choice }); }} decisionAnsweredText={t("liveScout.decisionAnswered")} hasMoreHistory={history.status === "CanLoadMore"} historyBusy={history.status === "LoadingMore"} onLoadHistory={() => history.loadMore(60)} /> : undefined}
    voiceSlot={voiceOpen ? <LiveVoiceChat onText={openChat} onEnd={() => { setVoiceOpen(false); setTextOpen(true); }} /> : undefined}
    providerUpdateSlot={offerSlot} offerSlot={offerSlot}
    completeSlot={<Link className="text-rs-ink-2 underline underline-offset-4" to="/app/inbox">{t("liveScout.viewMessages")}</Link>}
    errorSlot={error ? <p role="alert">{error}</p> : undefined}
    onChat={openChat} onCloseChat={() => { setTextOpen(false); setDismissedDecisionId(openDecision?._id); }} onVoice={openVoice} onReviewBrief={() => setManualBrief(value => !value)}
    onActivate={() => { if (need) void run(() => activate({ savedNeedId: need._id })); }}
    onPause={() => { if (need) void run(() => setStatus({ needId: need._id, status: "paused" })); }}
    onResume={() => { if (need) void run(() => setStatus({ needId: need._id, status: "active" })); }}
    onSettings={() => { if (voiceOpen || voice.connected) voice.disconnect(); navigate("/app/settings"); }}
  />;
}
