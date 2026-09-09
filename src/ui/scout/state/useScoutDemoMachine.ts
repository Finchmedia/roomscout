/**
 * Scout surface — the DEMO MACHINE.
 *
 * A `useReducer` port of the prototype's shared state
 * (`design-system/ui_kits/roomscout-app/App.jsx`) plus the autopilot timer
 * sequence that `ScreensB.jsx` runs. No Convex, no network: the flow is
 * scripted, the timings are the kit's compressed demo timings, and every
 * transition is reproducible from `stage` + `ap`.
 *
 * Why the sequence lives here and not in `AutopilotStage`: the kit's own
 * comment — „driven by `ap` (kind) from App state so it survives settings /
 * operator overlays“. The stage components are pure views over `m`.
 *
 * Pausable: `paused` stops every scheduled step (the effect clears its pool and
 * re-arms the sequence from the current `ap` when it resumes), and `speed`
 * divides every delay for the demo control bar.
 *
 * Every action is a stable callback (it only ever touches `dispatch` and the
 * timer pools), so a stage may put one in an effect's dependency list.
 */

import * as React from "react";
import type { FactId } from "@/components/ui/fact-list";
import type { StringCopyKey } from "@/ui/copy";
import {
  ACTIVITY,
  BUDGET_COMPACT_FALLBACK,
  BUDGET_COMPACT_KEY,
  BUDGET_LABEL_KEY,
  BUDGET_LOWER_FALLBACK,
  BUDGET_LOWER_KEY,
  DEAD_END_BUDGET_STEP,
  DEAD_END_OPTIONS,
  DEFAULT_BUDGET,
  DEFAULT_CANDIDATE_ID,
  DEMO_SPEEDS,
  FINAL_FACTS,
  INITIAL_FLAGS,
  INITIAL_RULES,
  INITIAL_SOURCES,
  PORTAL_SOURCE_ID,
  STATUS,
  briefAdjustedActivity,
  budgetNumberFromLabel,
  candidateById,
  offerRequestedActivity,
  requestOfferStatus,
  type CandidateId,
  type DemoSpeedId,
} from "./demoData";
import {
  AUTOPILOT_RETURN_STAGES,
  BRIEFED_STAGES,
  type ActivityEntry,
  type ApState,
  type CompromiseTarget,
  type CopyRef,
  type DemoFact,
  type DemoFlags,
  type DemoRules,
  type DemoSource,
  type PendingRelease,
  type ScoutMode,
  type ScoutStage,
  type ScoutView,
  type SourceAccess,
  type Speaker,
  type WaitingFor,
} from "./stages";

/* ---------------------------------------------------------------------------
 * State
 * ------------------------------------------------------------------------- */

export interface TranscriptTurn {
  readonly id: string;
  readonly who: Speaker;
  readonly key?: StringCopyKey;
  readonly text?: string;
}

/** A turn as a caller supplies it; the reducer assigns the id. */
export interface TranscriptInput {
  readonly who: Speaker;
  readonly key?: StringCopyKey;
  readonly text?: string;
}

export interface ScoutDemoState {
  readonly stage: ScoutStage;
  readonly view: ScoutView;
  readonly mode: ScoutMode;
  /** The band's name and initials, as dictionary keys (`scout.data.*`). */
  readonly nameKey: StringCopyKey;
  readonly initialsKey: StringCopyKey;
  readonly facts: readonly DemoFact[];
  readonly transcript: readonly TranscriptTurn[];
  readonly transcriptOpen: boolean;
  readonly menuOpen: boolean;
  readonly paused: boolean;
  /** Fires while the user is away from the Scout (§2.7); manual dismiss only. */
  readonly toast: { readonly id: number; readonly key: StringCopyKey } | null;
  readonly hint: { readonly id: number; readonly text: string } | null;
  readonly status: CopyRef | null;
  readonly activity: readonly ActivityEntry[];
  readonly ap: ApState;
  readonly pending: PendingRelease | null;
  readonly waitingFor: WaitingFor | null;
  readonly offerId: CandidateId;
  readonly offerStale: boolean;
  readonly sources: readonly DemoSource[];
  readonly rules: DemoRules;
  readonly flags: DemoFlags;
  readonly settingsPage: string;
  readonly operatorPage: string;
  readonly speed: DemoSpeedId;
  /** Monotonic ids for transcript turns, hints and toasts. */
  readonly seq: number;
}

const INITIAL_STATE: ScoutDemoState = {
  stage: "welcome",
  view: "scout",
  mode: "voice",
  nameKey: "scout.data.name.default",
  initialsKey: "scout.data.initials.default",
  facts: [],
  transcript: [],
  transcriptOpen: false,
  menuOpen: false,
  paused: false,
  toast: null,
  hint: null,
  status: null,
  activity: [],
  ap: { kind: "start" },
  pending: null,
  waitingFor: null,
  offerId: DEFAULT_CANDIDATE_ID,
  offerStale: false,
  sources: INITIAL_SOURCES,
  rules: INITIAL_RULES,
  flags: INITIAL_FLAGS,
  settingsPage: "sources",
  operatorPage: "overview",
  speed: "1x",
  seq: 0,
};

/* ---------------------------------------------------------------------------
 * Derived helpers (pure, shared by the reducer and the views)
 * ------------------------------------------------------------------------- */

/** The budget number the brief currently carries (350 unless a fact says otherwise). */
export function budgetNumber(facts: readonly DemoFact[]): number {
  const fact = facts.find((entry) => entry.id === "budget");
  if (!fact) return DEFAULT_BUDGET;
  if (fact.label !== undefined) return budgetNumberFromLabel(fact.label);
  for (const [amount, key] of Object.entries(BUDGET_LABEL_KEY)) {
    if (key === fact.labelKey) return Number(amount);
  }
  return DEFAULT_BUDGET;
}

/** `{budget}` for the approval message — the full lowercase label, never a number. */
export function budgetLowerKey(facts: readonly DemoFact[]): StringCopyKey {
  return BUDGET_LOWER_KEY[budgetNumber(facts)] ?? BUDGET_LOWER_FALLBACK;
}

/** `{budget}` for the autopilot brief pill — the compact label. */
export function budgetCompactKey(facts: readonly DemoFact[]): StringCopyKey {
  return BUDGET_COMPACT_KEY[budgetNumber(facts)] ?? BUDGET_COMPACT_FALLBACK;
}

/** The portal the demo works through. */
export function portalSource(sources: readonly DemoSource[]): DemoSource | undefined {
  return sources.find((source) => source.id === PORTAL_SOURCE_ID);
}

/** Sources the Scout may actually use for an enquiry (ScreensB.jsx `usable`). */
export function usableSources(
  sources: readonly DemoSource[],
  flags: DemoFlags,
): readonly DemoSource[] {
  return sources.filter(
    (source) => source.enabled && (source.kind === "portal" || flags.publicSearch),
  );
}

function upsertFact(
  facts: readonly DemoFact[],
  next: { id: FactId; labelKey: StringCopyKey },
): readonly DemoFact[] {
  if (facts.some((fact) => fact.id === next.id)) {
    return facts.map((fact) =>
      fact.id === next.id ? { id: fact.id, labelKey: next.labelKey, changed: true } : fact,
    );
  }
  return facts.concat([{ ...next, changed: true }]);
}

function withActivity(
  activity: readonly ActivityEntry[],
  entry: ActivityEntry,
): readonly ActivityEntry[] {
  return activity.some((item) => item.id === entry.id) ? activity : activity.concat([entry]);
}

function clearChanged(facts: readonly DemoFact[]): readonly DemoFact[] {
  return facts.map((fact) => (fact.changed ? { ...fact, changed: false } : fact));
}

/* ---------------------------------------------------------------------------
 * Actions
 * ------------------------------------------------------------------------- */

export interface GoOptions {
  readonly reset?: boolean;
  readonly mode?: ScoutMode;
}

type Action =
  | { type: "go"; stage: ScoutStage; options?: GoOptions }
  | { type: "setMode"; mode: ScoutMode }
  | { type: "setView"; view: ScoutView; page?: string }
  | { type: "setSettingsPage"; page: string }
  | { type: "setOperatorPage"; page: string }
  | { type: "setMenuOpen"; open: boolean }
  | { type: "toggleMenu" }
  | { type: "setPaused"; paused: boolean }
  | { type: "togglePaused" }
  | { type: "setTranscriptOpen"; open: boolean }
  | { type: "toggleTranscript" }
  | { type: "showHint"; text: string }
  | { type: "clearHint"; id: number }
  | { type: "dismissToast" }
  | { type: "addTranscript"; turns: readonly TranscriptInput[] }
  | { type: "commitFact"; id: FactId; labelKey: StringCopyKey }
  | { type: "clearChangedFacts" }
  | { type: "updateFact"; id: FactId; label: string }
  | { type: "saveBriefEdits"; drafts: Readonly<Record<string, string>> }
  | { type: "setStatus"; status: CopyRef | null }
  | { type: "addActivity"; entry: ActivityEntry }
  | { type: "attemptContact" }
  | { type: "releasePending" }
  | { type: "answerClarification"; yes: boolean }
  | { type: "completeClarification"; yes: boolean }
  | { type: "pickCompromise"; target: CompromiseTarget }
  | { type: "pickCandidate"; id: CandidateId }
  | { type: "keepGoing"; status: CopyRef }
  | { type: "toggleSource"; id: string }
  | { type: "setSourceAccess"; id: string; access: SourceAccess; stamp?: string }
  | { type: "setRules"; rules: Partial<DemoRules> }
  | { type: "setFlags"; flags: Partial<DemoFlags> }
  | { type: "loadIncident" }
  | { type: "setSpeed"; speed: DemoSpeedId };

/** Toast copy per arrival (App.jsx `notify`). */
const ARRIVAL_TOAST: Partial<Record<ScoutStage, StringCopyKey>> = {
  clarification: "scout.toast.clarification",
  dead_end: "scout.toast.decision",
  candidates: "scout.toast.candidates",
  offer: "scout.toast.offer",
};

function reducer(state: ScoutDemoState, action: Action): ScoutDemoState {
  switch (action.type) {
    case "go": {
      const options = action.options ?? {};
      let next: ScoutDemoState = { ...state, menuOpen: false };

      if (options.reset) {
        next = {
          ...next,
          facts: [],
          transcript: [],
          activity: [],
          status: null,
          pending: null,
          waitingFor: null,
          ap: { kind: "start" },
          offerId: DEFAULT_CANDIDATE_ID,
          offerStale: false,
          paused: false,
        };
      }
      if (options.mode) next = { ...next, mode: options.mode };
      if (BRIEFED_STAGES.includes(action.stage) && next.facts.length === 0) {
        next = { ...next, facts: FINAL_FACTS };
      }
      // Entering the autopilot from outside the flow restarts the sequence.
      if (
        action.stage === "scouting" &&
        state.stage !== "scouting" &&
        !AUTOPILOT_RETURN_STAGES.includes(state.stage)
      ) {
        next = {
          ...next,
          ap: { kind: "start" },
          activity: [ACTIVITY.start],
          pending: null,
          waitingFor: null,
        };
      }
      const toastKey = ARRIVAL_TOAST[action.stage];
      if (toastKey && next.view !== "scout") {
        next = { ...next, toast: { id: next.seq + 1, key: toastKey }, seq: next.seq + 1 };
      }
      return { ...next, stage: action.stage };
    }

    case "setMode":
      return { ...state, mode: action.mode };

    case "setView": {
      if (action.view === "scout") {
        return { ...state, view: "scout", toast: null, menuOpen: false };
      }
      const next: ScoutDemoState = {
        ...state,
        view: action.view,
        menuOpen: false,
        transcriptOpen: false,
        settingsPage:
          action.view === "settings" && action.page ? action.page : state.settingsPage,
        operatorPage:
          action.view === "operator" && action.page ? action.page : state.operatorPage,
      };
      // Leaving the Scout while it waits for a release keeps the ask visible.
      if (state.stage === "scouting" && state.pending) {
        return {
          ...next,
          toast: { id: state.seq + 1, key: "scout.toast.approval" },
          seq: state.seq + 1,
        };
      }
      return next;
    }

    case "setSettingsPage":
      return { ...state, settingsPage: action.page };

    case "setOperatorPage":
      return { ...state, operatorPage: action.page };

    case "setMenuOpen":
      return { ...state, menuOpen: action.open };

    case "toggleMenu":
      return { ...state, menuOpen: !state.menuOpen };

    case "setPaused":
      return { ...state, paused: action.paused };

    case "togglePaused":
      return { ...state, paused: !state.paused };

    case "setTranscriptOpen":
      return { ...state, transcriptOpen: action.open };

    case "toggleTranscript":
      return { ...state, transcriptOpen: !state.transcriptOpen };

    case "showHint":
      return { ...state, hint: { id: state.seq + 1, text: action.text }, seq: state.seq + 1 };

    case "clearHint":
      return state.hint?.id === action.id ? { ...state, hint: null } : state;

    case "dismissToast":
      return state.toast === null ? state : { ...state, toast: null };

    case "addTranscript": {
      let seq = state.seq;
      const turns = action.turns.map((turn) => {
        seq += 1;
        return { ...turn, id: `turn-${seq}` };
      });
      return { ...state, transcript: state.transcript.concat(turns), seq };
    }

    case "commitFact":
      return {
        ...state,
        facts: upsertFact(state.facts, { id: action.id, labelKey: action.labelKey }),
      };

    case "clearChangedFacts":
      return { ...state, facts: clearChanged(state.facts) };

    case "updateFact":
      return {
        ...state,
        facts: state.facts.map((fact) =>
          fact.id === action.id ? { id: fact.id, label: action.label, changed: true } : fact,
        ),
        offerStale:
          state.offerStale || state.stage === "offer" || state.stage === "offer_review",
      };

    case "saveBriefEdits":
      // The in-product „Übernehmen“ deliberately does not flash the rows.
      return {
        ...state,
        facts: state.facts.map((fact) => {
          const draft = action.drafts[fact.id];
          if (draft === undefined || draft.trim() === "") return fact;
          return { id: fact.id, label: draft.trim() };
        }),
      };

    case "setStatus":
      return { ...state, status: action.status };

    case "addActivity":
      return { ...state, activity: withActivity(state.activity, action.entry) };

    case "attemptContact": {
      const portal = portalSource(state.sources);
      const usable = usableSources(state.sources, state.flags);
      if (usable.length === 0 || !portal || !portal.enabled) {
        return { ...state, status: STATUS.noSource, waitingFor: "source" };
      }
      if (portal.access !== "connected") {
        return { ...state, status: STATUS.noAccess, waitingFor: "access" };
      }
      if (state.rules.mode === "review" || !state.rules.contact) {
        return {
          ...state,
          pending: {
            reason: state.rules.contact ? "review" : "contact",
            budgetKey: budgetLowerKey(state.facts),
          },
          status: STATUS.prepared,
          waitingFor: "release",
        };
      }
      return { ...state, ap: { kind: "contact" }, waitingFor: null };
    }

    case "releasePending":
      return { ...state, pending: null, waitingFor: null, ap: { kind: "contact" } };

    case "answerClarification": {
      let seq = state.seq;
      const turns: TranscriptTurn[] = [
        {
          id: `turn-${(seq += 1)}`,
          who: "user",
          key: action.yes
            ? "scout.clarification.yes.userText"
            : "scout.clarification.no.userText",
        },
        {
          id: `turn-${(seq += 1)}`,
          who: "scout",
          key: action.yes ? "scout.clarification.yes.reply" : "scout.clarification.no.reply",
        },
      ];
      return {
        ...state,
        seq,
        transcript: state.transcript.concat(turns),
        facts: action.yes
          ? state.facts.map((fact) =>
              fact.id === "zeit"
                ? {
                    id: fact.id,
                    labelKey: "scout.facts.zeit.mittwochOderDonnerstag",
                    changed: true,
                  }
                : fact,
            )
          : state.facts,
      };
    }

    case "completeClarification":
      return {
        ...state,
        facts: clearChanged(state.facts),
        activity: withActivity(
          state.activity,
          action.yes ? ACTIVITY.confirmed : ACTIVITY.alt,
        ),
        ap: action.yes ? { kind: "follow" } : { kind: "alt" },
      };

    case "pickCompromise": {
      const option = DEAD_END_OPTIONS.find((entry) => entry.target === action.target);
      if (!option) return state;
      const nextBudget = budgetNumber(state.facts) + DEAD_END_BUDGET_STEP;
      const labelKey =
        option.labelKey ?? BUDGET_LABEL_KEY[nextBudget] ?? BUDGET_LOWER_FALLBACK;
      const line: CopyRef = { key: option.replyKey };
      const seq = state.seq + 1;
      return {
        ...state,
        seq,
        facts: state.facts.map((fact) =>
          fact.id === option.factId ? { id: fact.id, labelKey, changed: true } : fact,
        ),
        transcript: state.transcript.concat([
          { id: `turn-${seq}`, who: "scout", key: option.replyKey },
        ]),
        activity: withActivity(state.activity, briefAdjustedActivity(labelKey)),
        ap: { kind: "compromise", target: option.target, line },
        status: line,
      };
    }

    case "pickCandidate": {
      const candidate = candidateById(action.id);
      const line = requestOfferStatus(candidate.nameKey);
      return {
        ...state,
        offerId: candidate.id,
        activity: withActivity(state.activity, offerRequestedActivity(candidate.shortKey)),
        ap: { kind: "follow", line },
        status: line,
      };
    }

    case "keepGoing":
      return { ...state, ap: { kind: "keep", line: action.status }, status: action.status };

    case "toggleSource": {
      const sources = state.sources.map((source) =>
        source.id === action.id ? { ...source, enabled: !source.enabled } : source,
      );
      if (state.waitingFor === "source") {
        return { ...state, sources, waitingFor: null, ap: { kind: "retry" } };
      }
      return { ...state, sources };
    }

    case "setSourceAccess": {
      const sources = state.sources.map((source) =>
        source.id === action.id
          ? {
              ...source,
              access: action.access,
              lastAccess:
                action.access === "connected"
                  ? (action.stamp ?? source.lastAccess)
                  : source.lastAccess,
            }
          : source,
      );
      if (state.waitingFor === "access" && action.access === "connected") {
        return { ...state, sources, waitingFor: null, ap: { kind: "retry" } };
      }
      return { ...state, sources };
    }

    case "setRules": {
      const rules = { ...state.rules, ...action.rules };
      if (state.pending && rules.mode === "autopilot" && rules.contact) {
        return { ...state, rules, pending: null, waitingFor: null, ap: { kind: "contact" } };
      }
      return { ...state, rules };
    }

    case "setFlags":
      return { ...state, flags: { ...state.flags, ...action.flags } };

    case "loadIncident":
      return {
        ...state,
        sources: state.sources.map((source) =>
          source.id === PORTAL_SOURCE_ID ? { ...source, access: "expired" } : source,
        ),
        view: "operator",
        operatorPage: "overview",
        menuOpen: false,
      };

    case "setSpeed":
      return { ...state, speed: action.speed };
  }
}

/* ---------------------------------------------------------------------------
 * Timer pool
 * ------------------------------------------------------------------------- */

export interface TimerPool {
  /** Schedule `fn` after `ms` demo-milliseconds (divided by the current speed). */
  readonly after: (ms: number, fn: () => void) => void;
  readonly clear: () => void;
}

function useTimerPool(speedRef: React.RefObject<number>): TimerPool {
  const handles = React.useRef<number[]>([]);

  const clear = React.useCallback(() => {
    for (const handle of handles.current) window.clearTimeout(handle);
    handles.current = [];
  }, []);

  const after = React.useCallback(
    (ms: number, fn: () => void) => {
      const factor = speedRef.current || 1;
      handles.current.push(window.setTimeout(fn, ms / factor));
    },
    [speedRef],
  );

  React.useEffect(() => clear, [clear]);

  return React.useMemo(() => ({ after, clear }), [after, clear]);
}

/* ---------------------------------------------------------------------------
 * The hook
 * ------------------------------------------------------------------------- */

/** How long a hint stays up (App.jsx `showHint`). */
const HINT_MS = 4200;
/** The clarification reply plays out before the stage hands back to the autopilot. */
const CLARIFICATION_MS = 3200;
/** How long a corrected row keeps its orange wash (App.jsx `updateFact`). */
const CHANGED_MS = 1200;

export interface ScoutDemoActions {
  readonly go: (stage: ScoutStage, options?: GoOptions) => void;
  readonly setMode: (mode: ScoutMode) => void;
  readonly showHint: (text: string) => void;
  readonly dismissToast: () => void;
  readonly setMenuOpen: (open: boolean) => void;
  readonly toggleMenu: () => void;
  readonly setTranscriptOpen: (open: boolean) => void;
  readonly toggleTranscript: () => void;
  readonly setPaused: (paused: boolean) => void;
  readonly togglePaused: () => void;
  readonly openSettings: (page?: string) => void;
  readonly openOperator: (page?: string) => void;
  readonly backToScout: () => void;
  readonly setSettingsPage: (page: string) => void;
  readonly setOperatorPage: (page: string) => void;
  readonly addTranscript: (turns: readonly TranscriptInput[]) => void;
  readonly commitFact: (id: FactId, labelKey: StringCopyKey) => void;
  readonly clearChangedFacts: () => void;
  readonly updateFact: (id: FactId, label: string) => void;
  readonly saveBriefEdits: (drafts: Readonly<Record<string, string>>) => void;
  readonly releasePending: () => void;
  readonly answerClarification: (yes: boolean) => void;
  readonly pickCompromise: (target: CompromiseTarget) => void;
  readonly pickCandidate: (id: CandidateId) => void;
  readonly keepSearching: () => void;
  readonly keepWaiting: () => void;
  readonly toggleSource: (id: string) => void;
  readonly setSourceAccess: (id: string, access: SourceAccess, stamp?: string) => void;
  readonly setRules: (rules: Partial<DemoRules>) => void;
  readonly setFlags: (flags: Partial<DemoFlags>) => void;
  readonly loadIncident: () => void;
  readonly setSpeed: (speed: DemoSpeedId) => void;
  readonly restart: () => void;
}

export interface ScoutDemoMachine extends ScoutDemoActions {
  /** The whole demo state; stages read it, nothing writes it directly. */
  readonly s: ScoutDemoState;
  /** Scheduling for stage-local sequences (the discovery script), scaled by `speed`. */
  readonly timers: TimerPool;
}

export function useScoutDemoMachine(): ScoutDemoMachine {
  const [s, dispatch] = React.useReducer(reducer, INITIAL_STATE);

  const speedFactor = DEMO_SPEEDS.find((entry) => entry.id === s.speed)?.factor ?? 1;
  const speedRef = React.useRef(speedFactor);
  // Written after commit, read only when a timer is scheduled (effect or handler).
  React.useEffect(() => {
    speedRef.current = speedFactor;
  }, [speedFactor]);

  /** The autopilot sequence; cleared and re-armed whenever `ap` or a blocker changes. */
  const flow = useTimerPool(speedRef);
  /** One-shot stage transitions (the clarification reply, correction flashes). */
  const oneShot = useTimerPool(speedRef);
  /** Stage-local sequences (the discovery script). */
  const local = useTimerPool(speedRef);

  /* --- hint auto-dismiss ------------------------------------------------- */
  const hintId = s.hint?.id;
  React.useEffect(() => {
    if (hintId === undefined) return;
    const handle = window.setTimeout(() => dispatch({ type: "clearHint", id: hintId }), HINT_MS);
    return () => window.clearTimeout(handle);
  }, [hintId]);

  /* --- the autopilot sequence (ScreensB.jsx) ----------------------------- */
  const portal = portalSource(s.sources);
  const portalAccess = portal?.access;
  const portalEnabled = portal?.enabled ?? false;
  const { stage, ap, paused, waitingFor, pending, rules, flags } = s;
  const { after: flowAfter, clear: flowClear } = flow;

  React.useEffect(() => {
    flowClear();
    if (stage !== "scouting") return;
    if (paused || waitingFor || pending) return;

    const setStatus = (status: CopyRef | null | undefined) =>
      dispatch({ type: "setStatus", status: status ?? null });
    const addActivity = (entry: ActivityEntry) => dispatch({ type: "addActivity", entry });

    switch (ap.kind) {
      case "start": {
        setStatus(STATUS.start);
        flowAfter(3800, () => setStatus(STATUS.searching));
        flowAfter(7800, () => {
          setStatus(STATUS.found);
          addActivity(ACTIVITY.found);
        });
        flowAfter(11800, () => dispatch({ type: "attemptContact" }));
        break;
      }
      case "retry":
        dispatch({ type: "attemptContact" });
        break;
      case "contact": {
        setStatus(STATUS.asked);
        addActivity(ACTIVITY.contacted);
        flowAfter(3000, () => {
          setStatus(STATUS.waiting);
          addActivity(ACTIVITY.waiting);
        });
        flowAfter(10000, () => {
          addActivity(ACTIVITY.notif);
          addActivity(ACTIVITY.read);
          dispatch({ type: "go", stage: "clarification" });
        });
        break;
      }
      case "follow": {
        setStatus(ap.line ?? STATUS.followUp);
        flowAfter(5000, () => {
          addActivity(ACTIVITY.offer);
          dispatch({ type: "go", stage: "offer" });
        });
        break;
      }
      case "alt": {
        setStatus(STATUS.alternative);
        flowAfter(6000, () => {
          addActivity(ACTIVITY.declined);
          addActivity(ACTIVITY.noMatch);
          dispatch({ type: "go", stage: "dead_end" });
        });
        break;
      }
      case "compromise": {
        setStatus(ap.line);
        if (ap.target === "zeit") {
          flowAfter(3500, () => setStatus(STATUS.followUp));
          flowAfter(8500, () => {
            addActivity(ACTIVITY.offer);
            dispatch({ type: "go", stage: "offer" });
          });
        } else {
          flowAfter(3500, () => setStatus(STATUS.searchAgain));
          flowAfter(7000, () => {
            addActivity(ACTIVITY.found2);
            dispatch({ type: "go", stage: "candidates" });
          });
        }
        break;
      }
      case "keep":
        setStatus(ap.line);
        break;
    }

    return flowClear;
  }, [
    stage,
    ap,
    paused,
    waitingFor,
    pending,
    rules.mode,
    rules.contact,
    flags.publicSearch,
    portalAccess,
    portalEnabled,
    flowAfter,
    flowClear,
    speedFactor,
  ]);

  /* --- actions (all stable) ---------------------------------------------- */
  const { clear: oneShotClear, after: oneShotAfter } = oneShot;
  const { clear: localClear } = local;

  const actions = React.useMemo<ScoutDemoActions>(() => {
    const go = (nextStage: ScoutStage, options?: GoOptions) => {
      oneShotClear();
      localClear();
      dispatch({ type: "go", stage: nextStage, options });
    };
    const flashOff = () => oneShotAfter(CHANGED_MS, () => dispatch({ type: "clearChangedFacts" }));

    return {
      go,
      setMode: (mode) => dispatch({ type: "setMode", mode }),
      showHint: (text) => dispatch({ type: "showHint", text }),
      dismissToast: () => dispatch({ type: "dismissToast" }),
      setMenuOpen: (open) => dispatch({ type: "setMenuOpen", open }),
      toggleMenu: () => dispatch({ type: "toggleMenu" }),
      setTranscriptOpen: (open) => dispatch({ type: "setTranscriptOpen", open }),
      toggleTranscript: () => dispatch({ type: "toggleTranscript" }),
      setPaused: (paused_) => dispatch({ type: "setPaused", paused: paused_ }),
      togglePaused: () => dispatch({ type: "togglePaused" }),
      openSettings: (page) => dispatch({ type: "setView", view: "settings", page }),
      openOperator: (page) => dispatch({ type: "setView", view: "operator", page }),
      backToScout: () => dispatch({ type: "setView", view: "scout" }),
      setSettingsPage: (page) => dispatch({ type: "setSettingsPage", page }),
      setOperatorPage: (page) => dispatch({ type: "setOperatorPage", page }),
      addTranscript: (turns) => dispatch({ type: "addTranscript", turns }),
      commitFact: (id, labelKey) => dispatch({ type: "commitFact", id, labelKey }),
      clearChangedFacts: () => dispatch({ type: "clearChangedFacts" }),
      updateFact: (id, label) => {
        dispatch({ type: "updateFact", id, label });
        flashOff();
      },
      saveBriefEdits: (drafts) => dispatch({ type: "saveBriefEdits", drafts }),
      releasePending: () => dispatch({ type: "releasePending" }),
      answerClarification: (yes) => {
        dispatch({ type: "answerClarification", yes });
        oneShotAfter(CLARIFICATION_MS, () => {
          dispatch({ type: "completeClarification", yes });
          dispatch({ type: "go", stage: "scouting" });
        });
      },
      pickCompromise: (target) => {
        dispatch({ type: "pickCompromise", target });
        dispatch({ type: "go", stage: "scouting" });
        flashOff();
      },
      pickCandidate: (id) => {
        dispatch({ type: "pickCandidate", id });
        dispatch({ type: "go", stage: "scouting" });
      },
      keepSearching: () => {
        dispatch({ type: "keepGoing", status: STATUS.keepSearching });
        dispatch({ type: "go", stage: "scouting" });
      },
      keepWaiting: () => {
        dispatch({ type: "keepGoing", status: STATUS.keepWaiting });
        dispatch({ type: "go", stage: "scouting" });
      },
      toggleSource: (id) => dispatch({ type: "toggleSource", id }),
      setSourceAccess: (id, access, stamp) =>
        dispatch({ type: "setSourceAccess", id, access, stamp }),
      setRules: (rules_) => dispatch({ type: "setRules", rules: rules_ }),
      setFlags: (flags_) => dispatch({ type: "setFlags", flags: flags_ }),
      loadIncident: () => dispatch({ type: "loadIncident" }),
      setSpeed: (speed) => dispatch({ type: "setSpeed", speed }),
      restart: () => {
        dispatch({ type: "setView", view: "scout" });
        go("welcome", { reset: true });
      },
    };
  }, [oneShotAfter, oneShotClear, localClear]);

  return React.useMemo(() => ({ ...actions, s, timers: local }), [actions, s, local]);
}
