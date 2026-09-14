/**
 * Scout surface — stage vocabulary and the shapes the demo machine stores.
 *
 * DEMO DATA / DEMO STATE. Everything in `src/ui/scout/state/` is the ported
 * prototype engine from `design-system/ui_kits/roomscout-app/App.jsx`,
 * `ScreensA.jsx`, `ScreensB.jsx` and `ScreensC.jsx`. No Convex, no network —
 * the flow is scripted timers over local state, exactly as the kit sequences
 * them. The real app replaces `useScoutDemoMachine` with backend state; the
 * stage components only ever read `m`.
 *
 * Nothing here holds a visible string. Copy lives in `src/ui/copy/de/scout.ts`
 * and is referenced by key ({@link CopyRef}), so the machine stays language
 * agnostic and a stage resolves through `useCopy()` at render time.
 */

import type { Fact, FactId } from "@/components/ui/fact-list";
import type { CopyVarName, CopyVars, StringCopyKey } from "@/ui/copy";

/* ---------------------------------------------------------------------------
 * Copy references
 * ------------------------------------------------------------------------- */

/** `t` as the machine's data files see it. */
export type CopyT = (key: StringCopyKey, vars?: CopyVars) => string;

/**
 * A string the machine stores without rendering it: a dictionary key plus the
 * variables it interpolates. `varKeys` names a variable whose value is itself a
 * dictionary key („Suchauftrag angepasst: {label}“ where `label` is a fact
 * label), so a composed sentence never bakes one language into state.
 */
export interface CopyRef {
  readonly key: StringCopyKey;
  readonly vars?: CopyVars;
  readonly varKeys?: Partial<Record<CopyVarName, StringCopyKey>>;
}

/** Resolve a {@link CopyRef} against the active dictionary. */
export function resolveCopy(t: CopyT, ref: CopyRef): string {
  const vars: CopyVars = { ...ref.vars };
  if (ref.varKeys) {
    for (const [name, key] of Object.entries(ref.varKeys)) {
      if (key) vars[name as CopyVarName] = t(key);
    }
  }
  return t(ref.key, vars);
}

/* ---------------------------------------------------------------------------
 * Stages and views
 * ------------------------------------------------------------------------- */

/** The kit's flow: `welcome → discovery → brief → scouting → …`. */
export const SCOUT_STAGES = [
  "welcome",
  "discovery",
  "brief",
  "scouting",
  "clarification",
  "dead_end",
  "candidates",
  "offer",
  "offer_review",
  "complete",
] as const;

export type ScoutStage = (typeof SCOUT_STAGES)[number];

/** One adaptive surface: the Scout, or a full-bleed panel over it. */
export type ScoutView = "scout" | "settings" | "operator";

/** Discovery runs as a voice conversation or as a written one. */
export type ScoutMode = "voice" | "text";

/** Stages that are „in flow“ — the Scout is working on a Suchauftrag (App.jsx `inFlow`). */
export const FLOW_STAGES: readonly ScoutStage[] = [
  "scouting",
  "clarification",
  "dead_end",
  "candidates",
  "offer",
  "offer_review",
  "complete",
];

/** Stages that imply a finished brief; entering one fills the facts (App.jsx `go`). */
export const BRIEFED_STAGES: readonly ScoutStage[] = ["brief", ...FLOW_STAGES];

/** Stages the autopilot sequence may be resumed from (App.jsx `go`, `setAp`). */
export const AUTOPILOT_RETURN_STAGES: readonly ScoutStage[] = [
  "clarification",
  "dead_end",
  "candidates",
];

export function isBriefedStage(stage: ScoutStage): boolean {
  return BRIEFED_STAGES.includes(stage);
}

export function isFlowStage(stage: ScoutStage): boolean {
  return FLOW_STAGES.includes(stage);
}

/* ---------------------------------------------------------------------------
 * Facts
 * ------------------------------------------------------------------------- */

/**
 * A row of the brief. Either a dictionary key (everything the demo produces) or
 * a free-text `label` (what „Noch etwas ändern“ and the Settings knowledge edit
 * write). `changed` drives the atom's correction flash and is cleared by the
 * machine, never by the atom.
 */
export interface DemoFact {
  readonly id: FactId;
  readonly labelKey?: StringCopyKey;
  readonly label?: string;
  readonly changed?: boolean;
}

/** The rendered value of a fact. */
export function factLabel(t: CopyT, fact: DemoFact): string {
  if (fact.label !== undefined) return fact.label;
  return fact.labelKey ? t(fact.labelKey) : "";
}

export function findFact(facts: readonly DemoFact[], id: FactId): DemoFact | undefined {
  return facts.find((fact) => fact.id === id);
}

/** The brief as the `FactList` atom takes it — labels resolved, flags carried. */
export function toFactRows(t: CopyT, facts: readonly DemoFact[]): Fact[] {
  return facts.map((fact) => ({
    id: fact.id,
    label: factLabel(t, fact),
    changed: fact.changed,
  }));
}

/* ---------------------------------------------------------------------------
 * Transcript, activity, status
 * ------------------------------------------------------------------------- */

export type Speaker = "scout" | "user";

/** One turn of the Mitschrift. `text` is what a person actually typed. */
export interface TranscriptEntry {
  readonly id: string;
  readonly who: Speaker;
  readonly key?: StringCopyKey;
  readonly text?: string;
}

/** One line of the autopilot activity log. Deduplicated by `id`, as the kit does by text. */
export interface ActivityEntry {
  readonly id: string;
  readonly text: CopyRef;
  readonly metaKey?: StringCopyKey;
}

/* ---------------------------------------------------------------------------
 * Autopilot
 * ------------------------------------------------------------------------- */

/** The autopilot sequence the machine is running (App.jsx / ScreensB.jsx `ap`). */
export type ApKind =
  | "start"
  | "retry"
  | "contact"
  | "follow"
  | "alt"
  | "compromise"
  | "keep";

/** Which criterion a dead-end compromise moved. */
export type CompromiseTarget = "budget" | "umland" | "zeit";

export interface ApState {
  readonly kind: ApKind;
  /** Opening status line for `follow` / `compromise` / `keep`. */
  readonly line?: CopyRef;
  readonly target?: CompromiseTarget;
}

/** What the Scout is blocked on; every one of them is user-resolvable. */
export type WaitingFor = "source" | "access" | "release";

/** The „Freigabe nötig“ card (ScreensB.jsx `pending`). */
export interface PendingRelease {
  /** Why the message needs a release: contacting is off, or the Handlungsspielraum is „Mit Rücksprache“. */
  readonly reason: "contact" | "review";
  /** `facts.budget.lower.*`, or the documented fallback when the budget is free text. */
  readonly budgetKey: StringCopyKey;
}

/* ---------------------------------------------------------------------------
 * Sources, rules, flags — the Settings state the Scout reads
 * ------------------------------------------------------------------------- */

export type SourceAccess = "connected" | "expired" | "public";

export interface DemoSource {
  readonly id: string;
  readonly nameKey: StringCopyKey;
  readonly descKey: StringCopyKey;
  readonly enabled: boolean;
  readonly access: SourceAccess;
  readonly kind: "portal" | "public";
  /** „Heute, 9:41“ — set when a portal login is renewed. */
  readonly lastAccess: string | null;
}

/** Handlungsspielraum (App.jsx `RULES0`). */
export interface DemoRules {
  readonly mode: "autopilot" | "review";
  readonly contact: boolean;
  readonly viewings: boolean;
  readonly publishAd: boolean;
  readonly shareProfile: boolean;
  readonly sharePrivate: boolean;
  readonly perDay: number;
}

/** Operator feature flags (App.jsx `flags`). */
export interface DemoFlags {
  readonly voice: boolean;
  readonly publicSearch: boolean;
}
