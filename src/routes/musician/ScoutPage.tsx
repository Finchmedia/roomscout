import { Mic, MessageSquare, Pause, RefreshCw, Settings2 } from "lucide-react";
import {
  useAction,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ContextImportDialog } from "../../components/memory/ContextImportDialog";
import { WorkspaceShell } from "../../components/navigation/WorkspaceShell";
import { ApprovalComposer } from "../../components/outreach/ApprovalComposer";
import { ProviderOfferPanel } from "../../components/opportunities/ProviderOfferPanel";
import { ScoutBlob } from "../../components/scout/ScoutBlob";
import { ScoutBrief } from "../../components/scout/ScoutBrief";
import { DemoSourceCheckControls } from "../../components/scout/DemoSourceCheckControls";
import { ScoutFactList } from "../../components/scout/ScoutFactList";
import {
  ScoutConversation,
  type ScoutConversationMessage,
} from "../../components/scout/ScoutConversation";
import { RealtimeVoiceScout } from "../../components/voice";
import { useVoiceSession } from "../../components/voice/VoiceSessionContext";
import {
  factsFromNeed,
  getScoutWorkspaceMode,
} from "../../features/scout/viewModel";
import type { MarketSignal, SavedSearch } from "../../mocks/demoData";
import styles from "./ScoutPage.module.css";

const starters = [
  "We need a permanent room for our band",
  "We are open to sharing with a compatible band",
  "Help me work out what matters before we search",
];

function readableError(error: unknown): string {
  if (error instanceof Error && /rate.?limit|too many/i.test(error.message))
    return "Kurz durchatmen: Bitte versuche es in einer Minute noch einmal.";
  return "Der Scout konnte diesen Schritt gerade nicht abschließen. Bitte versuche es erneut. Dein Suchauftrag bleibt gespeichert.";
}

function isControlledPortal(baseUrl: string): boolean {
  try {
    return new URL(baseUrl).hostname.replace(/^www\./, "") === "roomscout.dev";
  } catch {
    return false;
  }
}

export function ScoutPage() {
  const voice = useVoiceSession();
  const [searchParams] = useSearchParams();
  const currentUser = useQuery(api.users.current);
  const needs = useQuery(api.savedNeeds.listMine, { limit: 10 });
  const scoutContext = useQuery(api.scout.getMine);
  const memory = useQuery(api.memory.listMine);
  const getOrCreateDraft = useMutation(api.savedNeeds.getOrCreateDraft);
  const getOrCreateThread = useMutation(api.scout.getOrCreateThread);
  const setNeedStatus = useMutation(api.savedNeeds.setStatus);
  const enableDefaultAutopilot = useMutation(
    api.mandates.enableDefaultAutopilot,
  );
  const setScoutFocus = useMutation(api.scout.setFocus);
  const updateMatchStatus = useMutation(api.matches.updateStatus);
  const sendScoutMessage = useAction(api.scout.sendMessage);
  const refreshMatches = useAction(api.matches.recomputeMine);
  const initDraftRef = useRef(false);
  const initThreadForRef = useRef<string | undefined>(undefined);
  const [sending, setSending] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [voiceOpen, setVoiceOpen] = useState(() => voice.connected);
  const [textOpen, setTextOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [contextImportOpen, setContextImportOpen] = useState(false);
  const [draftSignal, setDraftSignal] = useState<MarketSignal>();

  const need =
    scoutContext === undefined
      ? undefined
      : (needs?.find(
          (candidate) =>
            candidate._id === scoutContext?.activeNeedId &&
            candidate.status !== "archived",
        ) ?? needs?.find((candidate) => candidate.status !== "archived"));
  const threadId =
    need && scoutContext?.activeNeedId === need._id
      ? scoutContext.threadId
      : undefined;
  const paginatedMessages = usePaginatedQuery(
    api.scout.listMessages,
    threadId ? { threadId } : "skip",
    { initialNumItems: 60 },
  );
  const matches = useQuery(
    api.matches.listMine,
    need ? { savedNeedId: need._id, limit: 30 } : "skip",
  );
  const opportunityRows = useQuery(
    api.opportunities.listMine,
    need ? { savedNeedId: need._id, limit: 20 } : "skip",
  );
  const opportunities = Array.isArray(opportunityRows)
    ? opportunityRows
    : undefined;
  const providerConversationRows = useQuery(
    api.providerConversations.listMine,
    { limit: 30 },
  );
  const providerConversations =
    Array.isArray(providerConversationRows) && need
      ? providerConversationRows.filter((row) => row.savedNeedId === need._id)
      : [];
  const outreachDrafts = useQuery(api.outreach.listMine, { limit: 50 });
  const externalActions = useQuery(api.externalActions.listMine, { limit: 30 });
  const portalConnections = useQuery(api.portalConnections.listMine);
  const controlledPortalConnection = portalConnections?.find((row) =>
    isControlledPortal(row.baseUrl),
  );
  const controlledPortalRuns = useQuery(
    api.portalConnections.listRunsMine,
    controlledPortalConnection
      ? { connectionId: controlledPortalConnection._id }
      : "skip",
  );
  const activeMandate = useQuery(
    api.mandates.getActiveMine,
    need ? { savedNeedId: need._id } : "skip",
  );

  useEffect(() => {
    if (
      needs === undefined ||
      needs.some((row) => row.status !== "archived") ||
      initDraftRef.current
    )
      return;
    initDraftRef.current = true;
    void getOrCreateDraft().catch((caught: unknown) => {
      initDraftRef.current = false;
      setError(readableError(caught));
    });
  }, [getOrCreateDraft, needs]);

  useEffect(() => {
    if (
      !need ||
      scoutContext === undefined ||
      scoutContext?.activeNeedId === need._id ||
      initThreadForRef.current === need._id
    )
      return;
    initThreadForRef.current = need._id;
    void getOrCreateThread({ activeNeedId: need._id }).catch(
      (caught: unknown) => {
        initThreadForRef.current = undefined;
        setError(readableError(caught));
      },
    );
  }, [getOrCreateThread, need, scoutContext]);

  useEffect(() => {
    if (!threadId || !need) return;
    const mode = searchParams.get("mode");
    const signalId = searchParams.get("signalId") as Id<"signals"> | null;
    if (mode === "search_discovery" && scoutContext?.mode !== mode)
      void setScoutFocus({ threadId, mode, activeNeedId: need._id }).catch(
        (caught: unknown) => setError(readableError(caught)),
      );
    if (
      (mode === "signal_advisor" || mode === "outreach_drafting") &&
      signalId &&
      (scoutContext?.mode !== mode || scoutContext.focusedSignalId !== signalId)
    ) {
      void setScoutFocus({
        threadId,
        mode,
        activeNeedId: need._id,
        focusedSignalId: signalId,
      }).catch((caught: unknown) => setError(readableError(caught)));
    }
  }, [
    need,
    scoutContext?.focusedSignalId,
    scoutContext?.mode,
    searchParams,
    setScoutFocus,
    threadId,
  ]);

  const messages = useMemo<ScoutConversationMessage[]>(() => {
    const rows = [...paginatedMessages.results]
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((message) => ({
        id: message.key,
        author:
          message.role === "assistant" ? ("scout" as const) : message.role,
        body: message.text,
      }));
    if (rows.length) return rows;
    return [
      {
        id: "scout-intro",
        author: "scout",
        body: memory?.facts.length
          ? "I have your saved music context. Tell me what kind of rehearsal situation you want now."
          : "Tell me about your band and the room you need. I’ll turn the useful details into a search you can review.",
      },
    ];
  }, [memory?.facts.length, paginatedMessages.results]);

  async function send(message: string) {
    if (!threadId) return false;
    setSending(true);
    setError("");
    try {
      await sendScoutMessage({ threadId, message });
      return true;
    } catch (caught) {
      setError(readableError(caught));
      return false;
    } finally {
      setSending(false);
    }
  }

  async function run(task: () => Promise<unknown>) {
    setWorking(true);
    setError("");
    try {
      await task();
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setWorking(false);
    }
  }

  if (!need)
    return (
      <WorkspaceShell mode="musician">
        <section className={styles.page}>
          <div className={styles.center}>
            <ScoutBlob active={!error} />
            <p className={styles.greeting}>
              {error || "Dein Scout macht sich bereit …"}
            </p>
            {error ? (
              <button
                className={styles.ghost}
                onClick={() => void run(() => getOrCreateDraft())}
                type="button"
              >
                Erneut versuchen
              </button>
            ) : null}
          </div>
        </section>
      </WorkspaceShell>
    );

  const activeNeed = need;
  const facts = factsFromNeed(need);
  const isAutopilot = Boolean(
    activeMandate &&
    (activeMandate.mode === "outreach_autopilot" ||
      activeMandate.mode === "negotiation_autopilot"),
  );
  const baseMode = getScoutWorkspaceMode(need, matches, opportunities);
  const readyProviderOffer = providerConversations.find(
    (row) => row.offer?.current && row.offer.ready,
  );
  const providerUpdate = providerConversations.some(
    (row) => row.offer?.current && (row.platformThreadId || row.mailThreadId),
  );
  const showProviderOffer = baseMode !== "paused" && baseMode !== "discovery" &&
    Boolean(readyProviderOffer || providerUpdate);
  const autopilotClarifying = !showProviderOffer && baseMode === "attention" && isAutopilot;
  const mode =
    showProviderOffer
      ? "results"
      : autopilotClarifying
      ? "waiting"
      : baseMode === "waiting" && providerConversations.some((row) => row.offer)
        ? "results"
        : baseMode;
  const name = currentUser?.displayName ?? currentUser?.username ?? "there";
  const search: SavedSearch = {
    id: need._id,
    title: need.title,
    status:
      need.status === "draft"
        ? "draft"
        : need.status === "paused"
          ? "paused"
          : "active",
    fields: facts.map((fact) => ({
      label: fact.label,
      value: fact.value,
      source: "you",
    })),
  };
  const selectedDraft = draftSignal
    ? outreachDrafts?.find(
        (draft) =>
          draft.signalId === draftSignal.id && draft.savedNeedId === need._id,
      )
    : undefined;
  const attention = opportunities?.find(
    (row) =>
      ["new", "reviewing", "contacted"].includes(row.status) &&
      row.uncertainties.length,
  );
  const needActions = (externalActions ?? []).filter(
    (row) => row.savedNeedId === need._id,
  );
  const latestOutreachAction = needActions.find((row) =>
    ["send_email", "submit_webform", "send_platform_dm"].includes(
      row.requestedActionType,
    ),
  );
  const latestRegistrationAction = (externalActions ?? []).find(
    (row) => row.requestedActionType === "create_portal_account",
  );
  const latestRegistrationRun = controlledPortalRuns?.find(
    (row) => row.kind === "authenticate",
  );
  const providerThreadExists = providerConversations.some(
    (row) => row.mailThreadId || row.platformThreadId,
  );
  const outreachStatus = (() => {
    if (latestOutreachAction?.status === "failed") return "blocked" as const;
    if (latestOutreachAction?.status === "executed")
      return "waiting_reply" as const;
    if (
      latestOutreachAction &&
      ["approved", "queued", "executing"].includes(latestOutreachAction.status)
    )
      return "sending" as const;
    if (
      latestOutreachAction &&
      ["drafted", "awaiting_approval"].includes(latestOutreachAction.status)
    )
      return "pending" as const;
    if (!latestOutreachAction && providerThreadExists)
      return "waiting_reply" as const;
    if (
      latestRegistrationRun?.status === "human_required" ||
      latestRegistrationRun?.onboardingStage === "human_required"
    )
      return "blocked" as const;
    if (
      latestRegistrationRun &&
      ["queued", "running"].includes(latestRegistrationRun.status)
    )
      return "registering" as const;
    if (controlledPortalConnection?.status === "active") return "ready" as const;
    if (
      latestRegistrationAction &&
      ["approved", "queued", "executing"].includes(
        latestRegistrationAction.status,
      )
    )
      return "registering" as const;
    if (
      latestRegistrationRun?.status === "failed" ||
      latestRegistrationAction?.status === "failed" ||
      controlledPortalConnection?.lastErrorCode
    )
      return "blocked" as const;
    return "not_started" as const;
  })();
  const autopilotHeading =
    outreachStatus === "waiting_reply"
      ? "Die Anfrage ist gesendet. Ich warte auf die Antwort."
      : outreachStatus === "sending"
        ? "Die Anfrage wird gerade gesendet."
        : outreachStatus === "pending"
          ? "Die Anfrage ist vorbereitet, aber noch nicht gesendet."
          : outreachStatus === "registering"
            ? "Der Portalzugang wird gerade eingerichtet."
            : outreachStatus === "blocked"
              ? "Der nächste Schritt ist blockiert."
              : "Ich habe einen passenden Raum gefunden.";
  const autopilotDetail =
    outreachStatus === "waiting_reply"
      ? "Der Anbieter wurde kontaktiert; eine Antwort ist noch offen."
      : outreachStatus === "sending"
        ? "Der Versand läuft. Erst die bestätigte Ausführung gilt als gesendet."
        : outreachStatus === "pending"
          ? "Es gibt einen Entwurf oder eine ausstehende Freigabe."
          : outreachStatus === "registering"
            ? "Die Registrierung läuft; der Anbieter wurde noch nicht kontaktiert."
            : outreachStatus === "blocked"
              ? "Der Anbieter wurde nicht kontaktiert. Prüft den Portalzugang oder den fehlgeschlagenen Versand."
              : outreachStatus === "ready"
                ? "Der Portalzugang ist bereit; der Anbieter wurde noch nicht kontaktiert."
                : `Offen ist: ${attention?.uncertainties[0] ?? "wie der Anbieter kontaktiert werden kann."}`;

  function marketSignal(
    match: NonNullable<typeof matches>[number],
    now: number,
  ): MarketSignal {
    const signal = match.signal;
    const ageHours = Math.max(
      0,
      Math.floor((now - signal.lastSeenAt) / 3_600_000),
    );
    return {
      id: signal._id,
      isDemo: signal.isDemo === true,
      side: signal.side,
      verification:
        signal.verification === "verified"
          ? "source_verified"
          : signal.verification,
      freshness:
        signal.status === "stale"
          ? "possibly_stale"
          : ageHours < 24
            ? "fresh"
            : "current",
      freshnessLabel:
        signal.status === "stale"
          ? "Possibly stale"
          : ageHours < 1
            ? "Checked within the hour"
            : `Checked ${ageHours} h ago`,
      title: signal.title,
      location: [signal.district, signal.city].filter(Boolean).join(", "),
      arrangement:
        signal.arrangement === "unknown"
          ? undefined
          : signal.arrangement === "permanent"
            ? "Fixed monthly"
            : `${signal.arrangement.charAt(0).toUpperCase()}${signal.arrangement.slice(1)}`,
      source: `${signal.sourceCount} public source${signal.sourceCount === 1 ? "" : "s"}`,
      firstSeen: `First seen ${new Date(signal.firstSeenAt).toLocaleDateString()}`,
      facts:
        signal.priceEur === undefined
          ? []
          : [
              {
                label: "Price",
                value: `€${signal.priceEur} / ${signal.pricePeriod ?? "unknown"}`,
              },
            ],
      summary: signal.summary,
      fit: [
        ...match.reasons,
        ...match.uncertainties.map((item) => `Uncertain: ${item}`),
      ].join(" · "),
      unknowns: signal.unknowns,
    };
  }

  async function prepareOutreach(match: NonNullable<typeof matches>[number]) {
    if (!threadId) return;
    // This function runs only in the inquiry button's event handler, never during render.
    // eslint-disable-next-line react-hooks/purity
    const signal = marketSignal(match, Date.now());
    setDraftSignal(signal);
    await setScoutFocus({
      threadId,
      mode: "outreach_drafting",
      activeNeedId: activeNeed._id,
      focusedSignalId: match.signal._id,
    });
    await sendScoutMessage({
      threadId,
      message: `Handle the next appropriate inquiry about “${signal.title}”. Use only the active persisted mandate for eligible non-binding outreach. Any commitment or human-only step must come back to me.`,
    });
  }

  async function discussAttention() {
    if (!threadId || !attention) return;
    setTextOpen(true);
    const question = attention.uncertainties[0];
    if (attention.signalId) {
      await setScoutFocus({
        threadId,
        mode: "signal_advisor",
        activeNeedId: activeNeed._id,
        focusedSignalId: attention.signalId,
      });
    }
    await send(
      `Hilf mir, diese offene Frage zur aktuellen Gelegenheit zu klären: ${question}`,
    );
  }

  function openVoice() {
    setVoiceOpen(true);
    if (!voice.connected) void voice.connect();
  }

  function finishVoice() {
    setVoiceOpen(false);
    setReviewOpen(facts.length > 0);
  }

  return (
    <WorkspaceShell mode="musician">
      <section className={styles.page}>
        {!voiceOpen ? (
          <header className={styles.topline}>
            <span className={styles.status}>
              <i className={styles.dot} />
              {mode === "discovery"
                ? "Wir lernen euch kennen"
                : mode === "paused"
                  ? "Suche pausiert"
                  : isAutopilot
                    ? "Autopilot aktiv"
                    : "Begleitete Suche"}
            </span>
            <nav className={styles.topActions}>
              <Link className={styles.ghost} to="/app/settings">
                <Settings2 aria-hidden="true" size={14} />
                <span>Einstellungen</span>
              </Link>
            </nav>
          </header>
        ) : null}

        {mode === "discovery" && !voiceOpen ? (
          <div
            className={`${styles.center} ${textOpen && facts.length && !reviewOpen ? styles.withFacts : ""}`}
          >
            <ScoutBlob active={sending} compact={reviewOpen} />
            <p className={styles.greeting}>
              {reviewOpen ? "Aus unserem Gespräch" : `Hey ${name}.`}
            </p>
            <h1 className={styles.title}>
              {reviewOpen
                ? "So suche ich für euch."
                : "Euer Proberaum beginnt mit einem Gespräch."}
            </h1>
            {!reviewOpen ? (
              <>
                <p className={styles.subtitle}>
                  Erzählt mir, was euch wichtig ist. Ich kümmere mich um die
                  Suche.
                </p>
                {!textOpen ? (
                  <div className={styles.entryActions}>
                    <button
                      className={styles.primary}
                      disabled={!threadId}
                      onClick={openVoice}
                      type="button"
                    >
                      <Mic size={18} />
                      Mit Scout sprechen
                    </button>
                    <button
                      className={styles.ghost}
                      onClick={() => setTextOpen(true)}
                      type="button"
                    >
                      <MessageSquare size={16} />
                      Lieber schreiben
                    </button>
                  </div>
                ) : (
                  <div className={styles.conversation}>
                    <ScoutConversation
                      busy={sending || !threadId}
                      error={error}
                      messages={messages}
                      onSend={send}
                      onVoice={openVoice}
                      starters={
                        paginatedMessages.results.length ? [] : starters
                      }
                    />
                  </div>
                )}
                {facts.length ? (
                  <>
                    <aside
                      className={
                        textOpen ? styles.factRail : styles.collapsedBrief
                      }
                    >
                      {textOpen ? (
                        <ScoutFactList facts={facts} />
                      ) : (
                        <ScoutBrief facts={facts} />
                      )}
                    </aside>
                    <button
                      className={styles.ghost}
                      onClick={() => setReviewOpen(true)}
                      type="button"
                    >
                      Suchauftrag ansehen
                    </button>
                  </>
                ) : null}
                <button
                  className={styles.quietButton}
                  onClick={() => setContextImportOpen(true)}
                  type="button"
                >
                  Musik-Kontext aus ChatGPT oder Claude mitbringen
                </button>
              </>
            ) : (
              <div className={styles.reviewCard}>
                <ScoutFactList expanded facts={facts} />
                <button
                  className={styles.primary}
                  disabled={working || !need.locationQuery?.trim() || need.radiusKm === undefined}
                  onClick={() =>
                    void run(() =>
                      enableDefaultAutopilot({ savedNeedId: need._id }),
                    )
                  }
                  type="button"
                >
                  {working ? "Scout startet …" : "Scout losschicken"}
                </button>
                <p className={styles.hint}>
                  Ich suche und frage im Rahmen eures Auftrags selbstständig an.
                  Eine verbindliche Zusage gebt nur ihr.
                </p>
                <button
                  className={styles.quietButton}
                  onClick={() => {
                    setReviewOpen(false);
                    setTextOpen(true);
                  }}
                  type="button"
                >
                  Noch etwas ändern
                </button>
                {error ? (
                  <p className={styles.error} role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        {mode !== "discovery" && !voiceOpen ? (
          <div className={styles.workspace}>
            <ScoutBlob active={sending || working} compact />
            <h1 className={styles.workspaceTitle}>
              {showProviderOffer
                ? readyProviderOffer
                  ? "Ich habe einen passenden Raum für euch geklärt."
                  : "Der Anbieter hat geantwortet."
                : autopilotClarifying
                ? autopilotHeading
                : mode === "paused"
                ? "Eure Suche macht eine Pause."
                : mode === "attention"
                  ? "Eine kurze Rückfrage an euch."
                  : mode === "results"
                    ? "Diese Räume könnten passen."
                    : "Ich kümmere mich darum."}
            </h1>
            <p className={styles.workspaceText}>
              {showProviderOffer
                ? readyProviderOffer
                  ? "Der Anbieter hat die offenen Punkte bestätigt. Prüft das Angebot – zugesagt oder gebucht ist noch nichts."
                  : "Hier seht ihr die Antwort und welche Punkte noch offen sind."
                : autopilotClarifying
                ? autopilotDetail
                : mode === "paused"
                ? "Euer Suchauftrag bleibt gespeichert. Macht weiter, wenn ihr bereit seid."
                : mode === "waiting"
                  ? `Ich behalte passende Räume in ${need.locationLabel ?? need.locationQuery ?? "eurer Gegend"} im Blick. Ihr könnt die App schließen.`
                  : mode === "results"
                    ? "Hier findet ihr die aktuellen Treffer und Antworten zu eurem Suchauftrag."
                    : "Ein Detail ist noch offen. Sagt mir, was für euch passt."}
            </p>
            <DemoSourceCheckControls variant="musician" />
            {mode === "attention" && attention ? (
              <section className={styles.attention}>
                <span className={styles.attentionLabel}>Offene Frage</span>
                <h2>{attention.uncertainties[0]}</h2>
                <p>
                  {attention.reasons[0] ??
                    "Scout braucht eure Einschätzung, bevor es weitergeht."}
                </p>
                <div className={styles.attentionActions}>
                  <button
                    className={styles.ghost}
                    disabled={working || sending || !threadId}
                    onClick={() => void run(discussAttention)}
                    type="button"
                  >
                    Mit Scout klären
                  </button>
                </div>
              </section>
            ) : null}
            {mode === "results" ? (
              <>
                <div className={styles.results}>
                  {providerConversations
                    .filter((row) => row.offer)
                    .sort((left, right) => Number(Boolean(right.offer?.current && right.offer.ready)) - Number(Boolean(left.offer?.current && left.offer.ready)))
                    .slice(0, 2)
                    .map((conversation) => (
                      <ProviderOfferPanel
                        conversation={conversation}
                        key={conversation.conversationId}
                      />
                    ))}
                  {matches?.slice(0, 6).map((match) => {
                    const signal = match.signal;
                    return (
                      <article className={styles.result} key={match._id}>
                        <div className={styles.resultMeta}>
                          <span>{signal.verification}</span>
                          <span>
                            {signal.sourceCount} source
                            {signal.sourceCount === 1 ? "" : "s"}
                          </span>
                        </div>
                        <h2>{signal.title}</h2>
                        <p>
                          {[signal.district, signal.city]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                        <div className={styles.resultFacts}>
                          {signal.priceEur !== undefined ? (
                            <span>
                              €{signal.priceEur} / {signal.pricePeriod}
                            </span>
                          ) : null}
                          {match.reasons.slice(0, 2).map((reason) => (
                            <span key={reason}>{reason}</span>
                          ))}
                        </div>
                        <p>{signal.summary}</p>
                        <div className={styles.resultActions}>
                          <button
                            onClick={() =>
                              void run(() => prepareOutreach(match))
                            }
                            type="button"
                          >
                            Ask Scout to inquire
                          </button>
                          <button
                            onClick={() =>
                              void run(() =>
                                updateMatchStatus({
                                  matchId: match._id,
                                  status: "dismissed",
                                }),
                              )
                            }
                            type="button"
                          >
                            Dismiss
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </>
            ) : null}
            {mode === "waiting" || mode === "paused" ? (
              <>
                <p className={styles.quiet}>
                  {mode === "paused"
                    ? "Your search is paused. Resume it to refresh your matches."
                    : matches?.length
                      ? `${matches.length} current match${matches.length === 1 ? "" : "es"} for ${need.locationLabel ?? need.locationQuery ?? "this search"}.`
                      : `No current matches for ${need.locationLabel ?? need.locationQuery ?? "this search"} yet.`}
                </p>
                <details className={styles.activity}>
                  <summary>What Scout is doing</summary>
                  <ul>
                    <li>Subscribed to live matches for this search</li>
                    <li>
                      {matches === undefined
                        ? "Reading the current index…"
                        : `${matches.length} current matches`}
                    </li>
                    <li>
                      {opportunities === undefined
                        ? "Checking opportunities…"
                        : `${opportunities.filter((row) => !["dismissed", "expired"].includes(row.status)).length} open opportunities`}
                    </li>
                  </ul>
                </details>
              </>
            ) : null}
            <div className={styles.entryActions}>
              <button
                className={styles.ghost}
                onClick={openVoice}
                type="button"
              >
                <Mic size={16} />
                Mit Scout sprechen
              </button>
              <button
                className={styles.ghost}
                onClick={() => setTextOpen(!textOpen)}
                type="button"
              >
                <MessageSquare size={16} />
                {textOpen ? "Chat schließen" : "Nachricht schreiben"}
              </button>
            </div>
            {textOpen ? (
              <div className={styles.conversation}>
                <ScoutConversation
                  autoFocus={mode === "attention"}
                  busy={sending || !threadId}
                  compact
                  error={error}
                  messages={messages}
                  onSend={send}
                  onVoice={openVoice}
                />
              </div>
            ) : error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}
            <div className={styles.brief}>
              <ScoutBrief facts={facts} />
            </div>
            <div className={styles.topActions}>
              {need.status === "active" ? (
                <button
                  className={styles.ghost}
                  disabled={working}
                  onClick={() =>
                    void run(() => refreshMatches({ savedNeedId: need._id }))
                  }
                  type="button"
                >
                  <RefreshCw aria-hidden="true" size={14} /> Aktualisieren
                </button>
              ) : null}
              <button
                className={styles.ghost}
                disabled={working}
                onClick={() =>
                  void run(() =>
                    setNeedStatus({
                      needId: need._id,
                      status: need.status === "paused" ? "active" : "paused",
                    }),
                  )
                }
                type="button"
              >
                <Pause aria-hidden="true" size={14} />{" "}
                {need.status === "paused" ? "Fortsetzen" : "Pausieren"}
              </button>
            </div>
          </div>
        ) : null}

        {voiceOpen ? (
          <div className={styles.voiceStage}>
            <RealtimeVoiceScout facts={facts} onEnd={finishVoice} />
          </div>
        ) : null}
        <ContextImportDialog
          onOpenChange={setContextImportOpen}
          open={contextImportOpen}
        />
        {draftSignal && selectedDraft ? (
          <ApprovalComposer
            draftId={selectedDraft._id}
            onApprove={() => setDraftSignal(undefined)}
            onOpenChange={(open) => {
              if (!open) setDraftSignal(undefined);
            }}
            open
            search={search}
            signal={draftSignal}
          />
        ) : null}
      </section>
    </WorkspaceShell>
  );
}
