import { optimisticallySendMessage, useUIMessages } from "@convex-dev/agent/react";
import type { UIMessage } from "@convex-dev/agent/react";
import type { StreamArgs, SyncStreamsReturnValue } from "@convex-dev/agent";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import type { FunctionReference, PaginationOptions, PaginationResult } from "convex/server";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { getSavedNeedActivationReadiness } from "../../../convex/lib/savedNeedLocation";
import { buildLiveDiscoveryContext } from "../../../convex/lib/liveDiscoveryContext";
import { Button } from "../../components/ui/button";
import { FactList } from "../../components/ui/fact-list";
import { DecisionCard } from "../../components/scout/DecisionCard";
import { LiveProviderOffer } from "../../components/opportunities/LiveProviderOffer";
import { LiveProfileMenu } from "../../components/navigation/LiveProfileMenu";
import { IndexedCandidatePanel, type IndexedCandidatePanelCandidate } from "../../ui/scout/live/IndexedCandidatePanel";
import type { CandidateRow } from "../../ui/scout/live/CandidateList";
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

function formatLiveDiscoveryContext(
  context: ReturnType<typeof buildLiveDiscoveryContext>,
): string {
  const phase = [
    `Authoritative RoomScout phase: mode=${context.mode}; phase=${context.phase}; discovery=${context.discovery}.`,
    context.discovery
      ? "Lead the discovery conversation and ask one useful independent question at a time."
      : "Stop discovery questions and follow the current search, candidate, or outreach task.",
  ];
  if (!context.search) {
    return [...phase, "Verified saved search: none."].join("\n");
  }
  const search = context.search;
  return [
    ...phase,
    `Verified saved search identity: id=${JSON.stringify(search.id)}; title=${JSON.stringify(search.title)}; status=${search.status}.`,
    `Verified saved location: query=${JSON.stringify(search.location.query)}; label=${JSON.stringify(search.location.label)}; radiusKm=${JSON.stringify(search.location.radiusKm)}.`,
    `Verified saved budget and sharing: maxBudgetEur=${JSON.stringify(search.maxBudgetEur)}; arrangement=${JSON.stringify(search.arrangement)}; openToSharing=${JSON.stringify(search.openToSharing)}; collaborationOpen=${JSON.stringify(search.collaborationOpen)}.`,
    `Verified saved schedule: ${JSON.stringify(search.schedule)}.`,
    `Verified saved band context: genres=${JSON.stringify(search.genres)}; instruments=${JSON.stringify(search.instruments)}.`,
    `Verified saved room requirements: requirements=${JSON.stringify(search.requirements)}; facets=${JSON.stringify(search.facets)}.`,
    `Authoritative activation state: canActivate=${search.activation.canActivate}; missingFields=${JSON.stringify(search.activation.missingFields)}.`,
    `Authoritative brief state: status=${search.brief.status}; readyForReview=${search.brief.readyForReview}; needRevision=${search.brief.needRevision}.`,
    "These are saved app values. Do not recap them automatically; use them to avoid repeat questions and never infer that unsaved speech is confirmed.",
  ].join("\n");
}

function formatLivePhaseInstruction(
  context: ReturnType<typeof buildLiveDiscoveryContext>,
  locale: "en" | "de",
): string {
  // A phase change arrives mid-call on the same provider session. Say so, or
  // the model reads the fresh directive as a session start and greets again.
  if (locale === "de") {
    const sameSession = "Dieselbe Sprachsitzung läuft weiter; das ist ein App-Update, keine neue Sitzung. Begrüße nicht erneut und wiederhole den SITZUNGSBEGINN nicht.";
    return context.discovery
      ? `${sameSession} Wende jetzt die aktuelle verbindliche App-Phase an: Modus ${context.mode}, Phase ${context.phase}. Führe das Discovery-Gespräch und stelle jeweils eine nützliche unabhängige Frage.`
      : `${sameSession} Wende jetzt die aktuelle verbindliche App-Phase an: Modus ${context.mode}, Phase ${context.phase}. Beende Discovery-Fragen und konzentriere dich auf die aktuelle Suche, den Kandidaten oder die Anbieteraufgabe.`;
  }
  const sameSession = "Same voice session continues; this is an app update, not a new session. Do not greet again and do not repeat the SESSION OPENING.";
  return context.discovery
    ? `${sameSession} Apply the latest authoritative app phase now: mode ${context.mode}, phase ${context.phase}. Lead discovery and ask one useful independent question at a time.`
    : `${sameSession} Apply the latest authoritative app phase now: mode ${context.mode}, phase ${context.phase}. Stop discovery questions and focus on the current search, candidate, or outreach task.`;
}

/** Live queries and actions; no scripted demo transitions or fabricated facts. */
export function ScoutPage() {
  const { t, locale } = useCopy();
  const voice = useVoiceSession();
  const noteVoiceActivity = voice.noteActivity;
  const liveConnected = voice.connected;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const retryAssessment = useMutation(api.providerConversations.retryFailedAssessment);
  const startInquiry = useMutation(api.providerConversations.startInitialInquiry);
  // The musician's own bubble is on screen before the mutation resolves; the
  // Scout's half of the turn arrives on the thread as deltas.
  const sendMessage = useMutation(api.scout.send).withOptimisticUpdate(
    optimisticallySendMessage(listScoutMessages),
  );
  const decisions = useQuery(api.decisions.listOpenMine);
  const answerDecision = useMutation(api.decisions.answer);
  const changingFocus = useRef(false);
  const [briefEdit, setBriefEdit] = useState<{ needId: Id<"savedNeeds">; revision: number; field: "budget" | "schedule"; value: string }>();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [profileRequired, setProfileRequired] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const [textDismissed, setTextDismissed] = useState(false);
  // One Entscheidung is answered at a time; the buttons on the stage go quiet
  // while the mutation is in flight.
  const [answeringDecision, setAnsweringDecision] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(() => voice.connected);
  const [manualBrief, setManualBrief] = useState(false);
  const [showAboveBudget, setShowAboveBudget] = useState(true);
  const [conversationSignalId, setConversationSignalId] = useState<Id<"signals">>();
  const [dismissedReady, setDismissedReady] = useState("");
  const draftStarting = useRef(false);
  const threadStarting = useRef<string | undefined>(undefined);
  const need = context === undefined ? undefined :
    needs?.find(row => row._id === context?.activeNeedId && row.status !== "archived") ??
    needs?.find(row => row.status !== "archived");
  const threadId = need && context?.activeNeedId === need._id ? context.threadId : undefined;
  const profileMissing = currentUser?.role === "musician" && (currentUser.profileCompleted === false || profileRequired);
  const activation = need
    ? getSavedNeedActivationReadiness(need)
    : { canActivate: false, missingFields: ["location", "radiusKm"] as const };
  const activationMissing = activation.canActivate
    ? undefined
    : activation.missingFields.length === 2
      ? t("liveScout.activateMissingLocationAndRadius")
      : activation.missingFields[0] === "location"
        ? t("liveScout.activateMissingLocation")
        : t("liveScout.activateMissingRadius");
  const history = useUIMessages(listScoutMessages, threadId ? { threadId } : "skip", { initialNumItems: 60, stream: true });
  const matches = useQuery(api.matches.listMine, need ? { savedNeedId: need._id, limit: 30 } : "skip");
  const indexedRows = useQuery(api.matches.listCandidatesMine, need ? { savedNeedId: need._id, limit: 50 } : "skip");
  const indexedCandidates = Array.isArray(indexedRows) ? indexedRows : [];
  const conversationRows = useQuery(api.providerConversations.listMine, need ? { savedNeedId: need._id, limit: 50 } : "skip");
  const conversations = Array.isArray(conversationRows) && need ? conversationRows.filter(row => row.savedNeedId === need._id) : [];
  // Keep this search's closed history available alongside the running candidates.
  const inboxRows = useQuery(api.conversations.listMine, need ? { savedNeedId: need._id, limit: 50 } : "skip");
  const candidates = (Array.isArray(inboxRows) && need ? inboxRows : [])
    .filter(row => row.savedNeedId === need?._id)
    .sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  const focusedConversationId = candidates.find(row => row.signalId === context?.focusedSignalId)?.conversationId;
  const focusedIndexed = indexedCandidates.find(row => row.signalId === context?.focusedSignalId);
  const conversationOpen = Boolean(focusedConversationId && conversationSignalId === context?.focusedSignalId);
  const focusedThread = useQuery(api.conversations.getMine, conversationOpen && focusedConversationId ? { conversationId: focusedConversationId } : "skip");
  const focusedPublicResult = useQuery(
    api.signals.get,
    context?.focusedSignalId && !focusedIndexed ? { signalId: context.focusedSignalId } : "skip",
  );
  const disclosureFor = (value: { isDemo?: boolean; providerSimulation?: "ai_simulated" }) =>
    value.isDemo === true || value.providerSimulation === "ai_simulated"
      ? undefined
      : t("liveScout.candidatePanel.contactDisabledDemo");
  const candidateMap = new Map<string, CandidateRow>(indexedCandidates.map(row => [row.candidateKey, {
    candidateKey: row.candidateKey, savedNeedId: row.savedNeedId, signalId: row.signalId,
    source: "indexed", matchKind: row.kind, title: row.signal.title,
    imageUrl: row.signal.imageUrl,
    subtitle: [row.signal.city, row.signal.district].filter(Boolean).join(" · "),
    lastActivityAt: row.updatedAt, unread: false, hasOpenDecision: false,
    disclosure: disclosureFor(row.signal),
  }]));
  for (const row of candidates) {
    const key = `${row.savedNeedId}:${row.signalId}`;
    if (candidateMap.get(key)?.source === "conversation") continue;
    const boundary = conversations.find((conversation) => conversation.conversationId === row.conversationId);
    candidateMap.set(key, {
      candidateKey: key, conversationId: row.conversationId, savedNeedId: row.savedNeedId,
      signalId: row.signalId, source: "conversation", title: row.title || row.providerLabel,
      imageUrl: boundary?.imageUrl ?? candidateMap.get(key)?.imageUrl,
      subtitle: row.subtitle, state: row.state, progress: row.progress,
      disposition: row.disposition, exclusionReason: row.exclusionReason,
      hasProviderReply: row.hasProviderReply, canRetryAssessment: row.canRetryAssessment,
      lastActivityAt: row.lastActivityAt, unread: row.unread, hasOpenDecision: row.openDecision !== undefined,
      disclosure: boundary && (boundary.providerSimulation || boundary.isDemo) ? disclosureFor(boundary) : undefined,
    });
  }
  const railCandidates = [...candidateMap.values()].sort((a, b) => b.lastActivityAt - a.lastActivityAt);
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
      source: (row as typeof row & { source?: "voice_transcript" }).source,
    }));
  // The turn in flight, read off the thread: a musician message the Scout has
  // not answered yet, or a reply that is still pending or streaming. Nothing
  // here survives a reload that the server does not also know about.
  const newestMessage = messages.at(-1);
  const threadBusy = newestMessage !== undefined && newestMessage.status !== "failed" &&
    ((newestMessage.author === "user" && newestMessage.source !== "voice_transcript") ||
      newestMessage.status === "pending" || newestMessage.status === "streaming");
  // Silent Live turns intentionally persist no fabricated assistant message.
  // Their authoritative completion state is the voice request state, so a
  // successful saved user turn must not leave the text surface busy forever.
  const scoutBusy = liveConnected
    ? voice.backendState === "queued" || voice.backendState === "processing"
    : threadBusy;
  const readiness = context?.briefReadiness;
  const liveDiscoveryContext = useMemo(
    () => buildLiveDiscoveryContext({
      need,
      mode: context?.mode,
      briefReadiness: readiness,
    }),
    [context?.mode, need, readiness],
  );
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
  const focusedCandidate = candidates.find(row => row.conversationId === focusedConversationId);
  const focusedOffer = conversations.find(row => row.conversationId === focusedConversationId);
  const { setFocus: setVoiceFocus, appendVerifiedBackgroundUpdate, clearBackgroundUpdate } = voice;
  const focusSignalId = focusedCandidate?.signalId ?? context?.focusedSignalId;
  const focusSummary = focusedCandidate ? `The user is viewing candidate ${focusedCandidate.title || focusedCandidate.providerLabel}, conversation ${focusedCandidate.conversationId}.` : undefined;
  const focusedCandidateId = focusedCandidate?.conversationId;
  const focusedActivityAt = focusedCandidate?.lastActivityAt;
  const relayed = useRef(new Map<string, string>());
  const liveDiscoveryContextVersion = JSON.stringify(liveDiscoveryContext);
  const backgroundUpdates = JSON.stringify([
    { id: "discovery-phase", version: `${locale}:${liveDiscoveryContext.mode}:${liveDiscoveryContext.phase}:${liveDiscoveryContext.discovery}`,
      speak: false, content: formatLivePhaseInstruction(liveDiscoveryContext, locale) },
    { id: `discovery:${need?._id ?? "none"}`, version: `${locale}:${liveDiscoveryContextVersion}`,
      speak: false, content: formatLiveDiscoveryContext(liveDiscoveryContext) },
    ...(liveDiscoveryContext.discovery && liveDiscoveryContext.search?.brief.readyForReview ? [{
      id: `brief-ready:${liveDiscoveryContext.search.id}`,
      version: `${locale}:${liveDiscoveryContext.search.brief.needRevision}`,
      speak: true,
      content: locale === "de"
        ? "Dein Suchauftrag ist bereit. Soll ich mit der Suche beginnen?"
        : "Your brief is ready. Shall I start looking?",
    }] : []),
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
    if (!liveConnected) return;
    const noteTrustedActivity = (event: Event) => {
      if (event.isTrusted) noteVoiceActivity();
    };
    document.addEventListener("pointerdown", noteTrustedActivity, true);
    document.addEventListener("keydown", noteTrustedActivity, true);
    document.addEventListener("input", noteTrustedActivity, true);
    return () => {
      document.removeEventListener("pointerdown", noteTrustedActivity, true);
      document.removeEventListener("keydown", noteTrustedActivity, true);
      document.removeEventListener("input", noteTrustedActivity, true);
    };
  }, [liveConnected, noteVoiceActivity]);
  useEffect(() => {
    if (!liveConnected) { relayed.current.clear(); return; }
    const updates = JSON.parse(backgroundUpdates) as Array<{ id: string; version: string; content: string; speak?: boolean; instruction?: boolean }>;
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
    if (!focusedCandidateId || !conversationOpen) return;
    void markConversationRead({ conversationId: focusedCandidateId }).catch(() => undefined);
  }, [conversationOpen, focusedCandidateId, focusedActivityAt, markConversationRead]);

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
    try { await task(); }
    catch (caught) {
      const data = caught instanceof ConvexError ? caught.data : undefined;
      if (typeof data === "object" && data !== null && "code" in data && (data as { code?: unknown }).code === "MUSICIAN_PROFILE_REQUIRED") {
        setProfileRequired(true);
      } else setError(t("liveScout.error"));
    } finally { setWorking(false); }
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
    setTextDismissed(false);
    setManualBrief(false); setDismissedReady(readyKey);
  }
  function openVoice() {
    setTextOpen(false);
    setVoiceOpen(true);
    if (!voice.connected) void voice.connect();
  }
  function closeChat() {
    setTextOpen(false);
    setTextDismissed(true);
  }
  async function openCandidate(targetId?: string) {
    if (!need || !threadId || changingFocus.current) return;
    const candidate = targetId ? railCandidates.find(row => row.conversationId === targetId || row.candidateKey === targetId) : undefined;
    if (targetId && !candidate) return;
    // A row that carries an open Entscheidung lands on its provider thread, where
    // the card is answerable, instead of the read-only room panel two clicks away.
    setConversationSignalId(candidate?.hasOpenDecision && candidate.conversationId ? (candidate.signalId as Id<"signals">) : undefined);
    changingFocus.current = true;
    setError("");
    // A manual selection supersedes a focus supplied by a previous deep link.
    if (searchParams.has("mode") || searchParams.has("signalId")) {
      const next = new URLSearchParams(searchParams);
      next.delete("mode"); next.delete("signalId");
      setSearchParams(next, { replace: true });
    }
    try {
      await setFocus({
        threadId,
        activeNeedId: need._id,
        mode: candidate?.signalId ? "signal_advisor" : "search_discovery",
        ...(candidate?.signalId ? { focusedSignalId: candidate.signalId as Id<"signals"> } : {}),
      });
      // Reactive server focus also opens rooms requested by the Scout’s navigation tool.
    } catch {
      setError(t("liveScout.error"));
    } finally {
      changingFocus.current = false;
    }
  }
  function editBrief() { setManualBrief(false); setDismissedReady(readyKey); openChat(); }
  // Answering closes the Entscheidung server-side; `listOpenMine` drops it and
  // the stage leaves „blocked“ on its own — nothing is hidden optimistically.
  async function answerOpenDecision(decisionId: Id<"decisions">, choice: string, text?: string, questionId?: string) {
    if (answeringDecision) return;
    setAnsweringDecision(true); setError("");
    try {
      await answerDecision({
        decisionId, choice,
        ...(text === undefined ? {} : { text }),
        ...(questionId ? { questionId } : {}),
      });
    }
    // The card only marks itself answered when the mutation resolved, so the
    // failure has to reach it — the message beside the stage is this page's.
    catch (cause) { setError(t("liveScout.error")); throw cause; }
    finally { setAnsweringDecision(false); }
  }
  function activateSearch() {
    if (!need || !activation.canActivate) return;
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
  const selectedSignal = matches?.find(row => row.signal._id === selected?.signalId)?.signal;
  const offerTitle = selectedSignal?.title;
  const selectedBoundary = {
    isDemo: selectedSignal?.isDemo ?? selected?.isDemo,
    providerSimulation: selectedSignal?.providerSimulation ?? selected?.providerSimulation,
  };
  const offerSlot = selected ? <LiveProviderOffer key={selected.conversationId} conversation={selected} title={offerTitle}
    disclosure={disclosureFor(selectedBoundary)} contactDisabled={selectedBoundary.isDemo !== true} /> : null;
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
    <div className="mx-auto flex w-full max-w-[var(--width-card)] flex-col items-center gap-[var(--space-7)]">
      <DecisionCard
        decision={openDecision}
        offerHash={decisionOfferHash}
        busy={answeringDecision}
        onAnswer={(choice, _label, text, questionId) => answerOpenDecision(openDecision._id, choice, text, questionId)}
      />
      <Button variant="ghost" size="sm" onClick={openChat}>{t("liveScout.decisionWrite")}</Button>
    </div>
  ) : undefined;
  // The rail belongs to the working stages; a draft has nobody to talk to yet,
  // so discovery gets the aside alone and the conversation keeps the room.
  const railSlot = need && need.status !== "draft" ? (
    <CandidateList
      candidates={railCandidates}
      copy={{
        title: t("liveScout.candidatesTitle"), empty: t("liveScout.candidatesEmpty"),
        question: t("liveScout.candidateState.question"), offer: t("liveScout.candidateState.offer"),
        reply: t("liveScout.candidateState.reply"), asked: t("liveScout.candidateState.asked"),
        checking: t("liveScout.candidateState.checking"), preparing: t("liveScout.candidateState.preparing"),
        failed: t("liveScout.candidateState.failed"), reviewing: t("liveScout.candidateState.reviewing"),
        attention: t("liveScout.candidateState.attention"), closed: t("liveScout.candidateState.closed"),
        fit: t("liveScout.candidateState.fit"), nearBudget: t("liveScout.candidateState.nearBudget"),
        showAboveBudget: t("liveScout.showAboveBudget"),
        groupActive: t("liveScout.candidateGroups.active"), groupAboveBudget: t("liveScout.candidateGroups.aboveBudget"),
        groupNotFit: t("liveScout.candidateGroups.notFit"), unavailable: t("liveScout.candidateState.unavailable"),
        notFit: t("liveScout.candidateState.notFit"), scheduleConflict: t("liveScout.candidateState.scheduleConflict"),
        requirementsConflict: t("liveScout.candidateState.requirementsConflict"),
      }}
      showAboveBudget={showAboveBudget}
      onShowAboveBudgetChange={setShowAboveBudget}
      formatStamp={at => formatMessageStamp(locale, at, now, { short: true })}
      onOpen={targetId => { void openCandidate(targetId); }}
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
      <Button size="sm" disabled={working || (!liveConnected && scoutBusy) || !activation.canActivate} onClick={activateSearch}>{t("liveScout.activate")}</Button>
      {activationMissing ? <p role="status" className="text-xs text-rs-ink-3">{activationMissing}</p> : null}
      <p className="text-xs text-rs-ink-4">{t("liveScout.activateNote")}</p>
    </> : null}
  </div>;
  const asideSlot = need ? <ArrivingFactList facts={asideFacts} animationKey={`${need._id}:${locale}`} title={t("liveScout.asideTitle")} className="w-full">
    {briefActions}
  </ArrivingFactList> : undefined;
  const focusedRailCandidate = railCandidates.find(row => row.signalId === context?.focusedSignalId);
  const focusedNotFit = focusedRailCandidate?.disposition === "not_fit" || focusedRailCandidate?.state === "closed";
  const focusedExclusion = focusedRailCandidate?.exclusionReason ?? (focusedRailCandidate?.state === "closed" ? "closed" : "not_fit");
  const exclusionLabels = {
    unavailable: t("liveScout.candidateState.unavailable"), schedule: t("liveScout.candidateState.scheduleConflict"),
    requirements: t("liveScout.candidateState.requirementsConflict"), closed: t("liveScout.candidateState.closed"),
    not_fit: t("liveScout.candidateState.notFit"),
  };
  const focusedPublicSignal = focusedPublicResult?.signal;
  const focusedDetailSignal = focusedIndexed?.signal ?? focusedPublicSignal;
  const focusedDetailPrice = focusedIndexed?.monthlyCostEur ??
    (focusedPublicSignal?.pricePeriod === "month" ? focusedPublicSignal.priceEur : undefined);
  const focusedDetail: IndexedCandidatePanelCandidate | undefined = context?.focusedSignalId && (focusedDetailSignal?.title || focusedRailCandidate?.title) ? {
    kind: focusedNotFit ? "room" : focusedRailCandidate?.disposition === "above_budget" ? "near_budget" : focusedIndexed?.kind ?? "room",
    statusLabel: focusedNotFit ? exclusionLabels[focusedExclusion] : undefined,
    title: focusedDetailSignal?.title ?? focusedRailCandidate?.title ?? "",
    imageUrl: focusedDetailSignal?.imageUrl ?? focusedRailCandidate?.imageUrl,
    subtitle: focusedDetailSignal
      ? [focusedDetailSignal.city, focusedDetailSignal.district].filter(Boolean).join(" · ")
      : focusedRailCandidate?.subtitle,
    summary: focusedDetailSignal?.summary,
    reasons: focusedNotFit ? [] : focusedIndexed?.reasons ?? [],
    uncertainties: focusedIndexed?.uncertainties ?? focusedPublicSignal?.unknowns ?? [],
    disclosure: focusedDetailSignal ? disclosureFor(focusedDetailSignal) : focusedRailCandidate?.disclosure,
    priceLabel: focusedDetailPrice === undefined ? undefined : t(
      focusedIndexed?.monthlyCostBasis === "assessed_monthly_minimum"
        ? "liveScout.candidatePanel.minimumPrice"
        : "liveScout.candidatePanel.monthlyPrice",
      { amount: new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(focusedDetailPrice) },
    ),
    budgetGapLabel: focusedIndexed?.kind !== "near_budget" || focusedIndexed.budgetDeltaEur === undefined ? undefined : t(
      focusedIndexed.monthlyCostBasis === "assessed_monthly_minimum"
        ? "liveScout.candidatePanel.minimumBudgetGap"
        : "liveScout.candidatePanel.budgetGap",
      { amount: new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(focusedIndexed.budgetDeltaEur) },
    ),
  } : undefined;
  const detailSlot = conversationOpen && focusedConversationId ? <section className="mx-auto flex h-[min(680px,70vh)] min-h-[360px] w-full max-w-[var(--width-card)] flex-col overflow-hidden rounded-card border border-rs-border-card bg-rs-surface-card" aria-label={t("liveInbox.title")}>
    <div className="flex items-center justify-between p-2">
      <Button variant="ghost" size="sm" onClick={() => setConversationSignalId(undefined)}>{t("liveScout.candidatePanel.backToRoom")}</Button>
      <Button variant="ghost" size="sm" onClick={() => { void openCandidate(); }}>{t("common.close")}</Button>
    </div>
    {focusedThread ? <ConversationThread key={focusedConversationId} header={focusedThread.header} items={focusedThread.items} now={now}
      offerConversation={focusedOffer} offerTitle={focusedThread.header.title || undefined} error={error || undefined}
      onSend={async body => { try { await replyToConversation({ conversationId: focusedConversationId, body }); return true; } catch { setError(t("liveInbox.errorGeneric")); return false; } }}
      onRetryAssessment={() => run(async () => {
        const result = await retryAssessment({ conversationId: focusedConversationId });
        if (result.status === "not_eligible") setError(t("liveScout.candidatePanel.actionUnavailable"));
      })}
      onAnswerDecision={answerOpenDecision} /> : <p role="status">{t("liveInbox.threadLoading")}</p>}
  </section> : focusedDetail ? <section className="mx-auto w-full max-w-[var(--width-card)]">
    <div className="flex justify-end p-2"><Button variant="ghost" size="sm" onClick={() => { void openCandidate(); }}>{t("common.close")}</Button></div>
    <IndexedCandidatePanel candidate={focusedDetail} copy={{
      room: t("liveScout.candidatePanel.room"),
      fit: t("liveScout.candidatePanel.fit"), nearBudget: t("liveScout.candidatePanel.nearBudget"),
      reasons: t("liveScout.candidatePanel.reasons"), uncertainties: t("liveScout.candidatePanel.uncertainties"),
      adjustBudget: t("liveScout.candidatePanel.adjustBudget"), contact: t("liveScout.candidatePanel.contact"),
      openConversation: t("liveScout.candidatePanel.openConversation"), retry: t("liveScout.candidatePanel.retry"),
      actionQueued: t("liveScout.candidatePanel.actionQueued"), actionUnavailable: t(
        profileMissing
          ? "liveScout.candidatePanel.profileRequired"
          : focusedDetailSignal?.isDemo === true
            ? "liveScout.candidatePanel.actionUnavailable"
            : "liveScout.candidatePanel.contactDisabledDemo",
      ),
    }} busy={working} onAdjustBudget={() => beginBriefEdit("budget")}
      onOpenConversation={focusedConversationId ? () => setConversationSignalId(context?.focusedSignalId) : undefined}
      onContact={!focusedNotFit && focusedIndexed?.contactEligible && focusedIndexed.signal.isDemo === true && !profileMissing ? () => { void run(async () => {
        const result = await startInquiry({ savedNeedId: focusedIndexed.savedNeedId, signalId: focusedIndexed.signalId });
        if (result.status === "not_eligible") setError(t("liveScout.candidatePanel.actionUnavailable"));
      }); } : undefined} />
    {error ? <p role="alert">{error}</p> : null}
  </section> : undefined;
  const brief = <FactList facts={facts} variant="card" title={t("scout.brief.title")}>
    <div className="mt-[var(--space-8)] flex flex-col items-center gap-[var(--space-6)]">
      {need?.status === "draft" ? <>
        {autoBrief ? <p role="status" className="text-sm text-rs-ink-4">{t("liveScout.ready")}</p> : null}
        <Button size="md" block disabled={working || scoutBusy || !activation.canActivate} onClick={activateSearch}>{t(working ? "liveScout.activating" : "liveScout.activate")}</Button>
        {activationMissing ? <p role="status" className="text-center text-sm text-rs-ink-3">{activationMissing}</p> : null}
        <p className="text-center text-sm leading-relaxed text-rs-ink-4">{t("liveScout.activateNote")}</p>
        <Button variant="link" size="sm" onClick={editBrief}>{t("liveScout.editBrief")}</Button>
      </> : null}
    </div>
  </FactList>;
  const showScoutChat =
    (!voiceOpen && stage === "discovery" && !textDismissed) ||
    (chatOpen && (voiceOpen || stage !== "brief")) ||
    (!voiceOpen && Boolean(voice.pendingTextDraft));
  const focusedThreadShowsDecision = Boolean(openDecision && focusedThread?.items.some(item =>
    item.kind === "decision" && item.decision.status === "open" && item.decision._id === openDecision._id));
  // With voice active, the centre companion already contains the actionable
  // card when text chat or the selected provider thread shows this decision.
  // Keep the global card only as the fallback when neither panel owns it.
  // While the opened thread is still loading, hold the global card back too so
  // it does not flash above the thread and vanish once the thread's own arrives.
  const surfaceDecisionSlot = showScoutChat || focusedThreadShowsDecision || (conversationOpen && focusedThread === undefined) ? undefined : decisionSlot;
  const voicePrimary = voiceOpen && !showScoutChat && !focusedConversationId && !focusedIndexed && !offerSlot && !openDecision;
  // Opening, connecting and connected calls share one transparent 720px shell;
  // provider state changes must not make the centre pane jump between cards.
  const voiceCompact = voiceOpen;
  const profileNotice = profileMissing ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-rs-border-accent-soft bg-rs-surface-card px-5 py-4" role="status">
    <span className="text-sm text-rs-ink-2">{t("liveScout.profileIncomplete.title")}</span>
    <Button asChild size="sm"><Link to="/onboarding?returnTo=%2Fapp%2Fscout">{t("liveScout.profileIncomplete.action")}</Link></Button>
  </div> : undefined;
  const chatSlot = showScoutChat ? <div className="relative mx-auto h-full min-h-0 w-full max-w-[var(--width-card)]">
    {stage === "discovery" ? <Button className="absolute right-2 top-2 z-10" variant="ghost" size="sm" aria-label={t("common.close")} onClick={closeChat}>×</Button> : null}
    <ScoutChat key={threadId ?? "loading"} className={voiceOpen ? "h-full max-h-full min-h-[18rem]" : undefined} messages={messages.length ? messages : [{ id: "intro", author: "scout", body: t("liveScout.intro") }]} onSend={send} replying={(!liveConnected && scoutBusy) || !threadId} restoredDraft={voice.pendingTextDraft || undefined} onDraftRestored={voice.clearPendingTextDraft} onActivity={voice.noteActivity} labels={chatLabels} error={error} onVoice={openVoice} autoFocus decision={openDecision} decisionOfferHash={decisionOfferHash} onAnswerDecision={async (decisionId, choice, text, questionId) => { voice.noteActivity(); await answerOpenDecision(decisionId, choice, text, questionId); }} decisionAnsweredText={t("liveScout.decisionAnswered")} hasMoreHistory={history.status === "CanLoadMore"} historyBusy={history.status === "LoadingMore"} onLoadHistory={() => history.loadMore(60)} />
  </div> : undefined;
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
    chatSlot={chatSlot}
    voiceSlot={voiceOpen ? <LiveVoiceChat compact={voiceCompact} primary={voicePrimary} showTranscript={!showScoutChat} onText={openChat} onEnd={() => { setVoiceOpen(false); setTextOpen(false); setTextDismissed(true); }} /> : undefined}
    providerUpdateSlot={offerSlot} offerSlot={offerSlot} detailSlot={detailSlot}
    decisionSlot={surfaceDecisionSlot} railSlot={railSlot} asideSlot={asideSlot}
    completeSlot={<Link className="text-rs-ink-2 underline underline-offset-4" to="/app/inbox">{t("liveScout.viewMessages")}</Link>}
    errorSlot={profileNotice || error ? <>{profileNotice}{error ? <p role="alert">{error}</p> : null}</> : undefined}
    onChat={openChat} onCloseChat={closeChat} onVoice={openVoice} onReviewBrief={() => setManualBrief(value => !value)}
    onActivate={activateSearch}
    onPause={() => { if (need) void run(() => setStatus({ needId: need._id, status: "paused" })); }}
    onResume={() => { if (need) void run(() => setStatus({ needId: need._id, status: "active" })); }}
    onSettings={() => { if (voiceOpen || voice.connected) voice.disconnect(); navigate("/app/settings"); }}
  />;
}
