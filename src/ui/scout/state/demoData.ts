/**
 * Scout surface — DEMO DATA.
 *
 * Every constant of `design-system/ui_kits/roomscout-app/*.jsx`, ported as copy
 * *references* instead of German literals: the kit's `FINAL_FACTS`, `SCRIPT`,
 * `SOURCES0`, `RULES0`, `KNOW0`, `ACT`, `STATUS`, `CANDS` and `CHAPTERS`.
 * Resolve a reference with `t()` / `resolveCopy()` at render time — never store
 * a rendered string in machine state.
 *
 * Not a data source. The real app fills the same shapes from Convex.
 */

import type { FactId } from "@/components/ui/fact-list";
import type { StringCopyKey } from "@/ui/copy";
import type {
  ActivityEntry,
  CompromiseTarget,
  CopyRef,
  DemoFact,
  DemoFlags,
  DemoRules,
  DemoSource,
  ScoutStage,
  Speaker,
} from "./stages";

/* ---------------------------------------------------------------------------
 * Facts — App.jsx `FINAL_FACTS`, `FACT_CAT`
 * ------------------------------------------------------------------------- */

/**
 * Budget label keys by amount. §18.8 ships exactly two („Bis 400 € / Monat“ and
 * „Bis 350 € / Monat“), which is every value the demo can reach: the dead-end
 * compromise lifts 350 to 400 and there is no third step. A budget outside the
 * table keeps the 400 forms rather than inventing German — see openQuestions.
 */
export const BUDGET_LABEL_KEY: Readonly<Record<number, StringCopyKey>> = {
  350: "scout.facts.budget.350",
  400: "scout.facts.budget.400",
};

/** Lowercase full label („bis 350 € / Monat“) — the approval message's `{budget}`. */
export const BUDGET_LOWER_KEY: Readonly<Record<number, StringCopyKey>> = {
  350: "scout.facts.budget.lower.350",
  400: "scout.facts.budget.lower.400",
};

/** Compact label („bis 350 €“) — the autopilot brief pill's `{budget}`. */
export const BUDGET_COMPACT_KEY: Readonly<Record<number, StringCopyKey>> = {
  350: "scout.facts.budget.compact.350",
  400: "scout.facts.budget.compact.400",
};

/** §18.10 / §20.12 fallbacks for a budget the dictionary has no label for. */
export const BUDGET_LOWER_FALLBACK: StringCopyKey =
  "scout.autopilot.approval.budget.fallback";
export const BUDGET_COMPACT_FALLBACK: StringCopyKey =
  "scout.autopilot.brief.pill.budget.fallback";

/** The default budget the prototype falls back to everywhere (350). */
export const DEFAULT_BUDGET = 350;

/** The brief a completed conversation produces (App.jsx `FINAL_FACTS`). */
export const FINAL_FACTS: readonly DemoFact[] = [
  { id: "ort", labelKey: "scout.facts.ort.text" },
  { id: "budget", labelKey: "scout.facts.budget.350" },
  { id: "band", labelKey: "scout.facts.band" },
  { id: "zeit", labelKey: "scout.facts.zeit.donnerstag" },
  { id: "equip", labelKey: "scout.facts.equip" },
];

/**
 * Read a budget number out of a rendered label („Bis 350 € / Monat“ → 350), the
 * way ScreensC.jsx does. Digit extraction, so it survives a hand-edited label.
 */
export function budgetNumberFromLabel(label: string): number {
  const digits = label.replace(/\D/g, "");
  const parsed = Number(digits);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_BUDGET;
}

/* ---------------------------------------------------------------------------
 * Discovery script — ScreensA.jsx `SCRIPT`
 * ------------------------------------------------------------------------- */

export interface ScriptFact {
  readonly id: FactId;
  readonly labelKey: StringCopyKey;
}

export interface ScriptLine {
  readonly id: string;
  readonly who: Speaker;
  readonly key: StringCopyKey;
  /** Facts this utterance extracts, in the order the capsules fly. */
  readonly facts?: readonly ScriptFact[];
  /** Last line: the Scout offers to start, and the stage morphs to the brief. */
  readonly end?: true;
}

export const SCRIPT: readonly ScriptLine[] = [
  { id: "s1", who: "scout", key: "scout.script.s1.scout" },
  {
    id: "s2",
    who: "user",
    key: "scout.script.s2.user",
    facts: [
      { id: "ort", labelKey: "scout.facts.ort.text" },
      { id: "budget", labelKey: "scout.facts.budget.400" },
      { id: "band", labelKey: "scout.facts.band" },
    ],
  },
  { id: "s3", who: "scout", key: "scout.script.s3.scout" },
  {
    id: "s4",
    who: "user",
    key: "scout.script.s4.user",
    facts: [{ id: "zeit", labelKey: "scout.facts.zeit.donnerstag" }],
  },
  { id: "s5", who: "scout", key: "scout.script.s5.scout" },
  {
    id: "s6",
    who: "user",
    key: "scout.script.s6.user",
    facts: [{ id: "equip", labelKey: "scout.facts.equip" }],
  },
  {
    id: "s7",
    who: "user",
    key: "scout.script.s7.user",
    facts: [{ id: "budget", labelKey: "scout.facts.budget.350" }],
  },
  { id: "s8", who: "scout", key: "scout.script.s8.scout", end: true },
];

/* ---------------------------------------------------------------------------
 * Activity — ScreensB.jsx `ACT`
 * ------------------------------------------------------------------------- */

export const ACTIVITY = {
  start: { id: "start", text: { key: "scout.activity.start" } },
  found: {
    id: "found",
    text: { key: "scout.activity.found.text" },
    metaKey: "scout.activity.found.meta",
  },
  contacted: { id: "contacted", text: { key: "scout.activity.contacted" } },
  waiting: { id: "waiting", text: { key: "scout.activity.waiting" } },
  notif: { id: "notif", text: { key: "scout.activity.notif" } },
  read: { id: "read", text: { key: "scout.activity.read" } },
  confirmed: { id: "confirmed", text: { key: "scout.activity.confirmed" } },
  alt: { id: "alt", text: { key: "scout.activity.alt" } },
  offer: { id: "offer", text: { key: "scout.activity.offer" } },
  declined: { id: "declined", text: { key: "scout.activity.declined" } },
  noMatch: { id: "noMatch", text: { key: "scout.activity.noMatch" } },
  found2: {
    id: "found2",
    text: { key: "scout.activity.found2.text" },
    metaKey: "scout.activity.found2.meta",
  },
} satisfies Record<string, ActivityEntry>;

/** „Suchauftrag angepasst: {label}“ — one entry per dead-end compromise. */
export function briefAdjustedActivity(labelKey: StringCopyKey): ActivityEntry {
  return {
    id: `briefAdjusted:${labelKey}`,
    text: { key: "scout.activity.briefAdjusted", varKeys: { label: labelKey } },
  };
}

/** „Angebot angefragt: {short}“ — one entry per candidate the band picks. */
export function offerRequestedActivity(shortKey: StringCopyKey): ActivityEntry {
  return {
    id: `offerRequested:${shortKey}`,
    text: { key: "scout.activity.offerRequested", varKeys: { short: shortKey } },
  };
}

/* ---------------------------------------------------------------------------
 * Sources / rules / flags — App.jsx `SOURCES0`, `RULES0`, `flags`
 * ------------------------------------------------------------------------- */

export const INITIAL_SOURCES: readonly DemoSource[] = [
  {
    id: "roomscout",
    nameKey: "scout.data.source.roomscout.name",
    descKey: "scout.data.source.roomscout.desc",
    enabled: true,
    access: "connected",
    kind: "portal",
    lastAccess: null,
  },
  {
    id: "musiker",
    nameKey: "scout.data.source.musiker.name",
    descKey: "scout.data.source.musiker.desc",
    enabled: true,
    access: "public",
    kind: "public",
    lastAccess: null,
  },
  {
    id: "bandnet",
    nameKey: "scout.data.source.bandnet.name",
    descKey: "scout.data.source.bandnet.desc",
    enabled: false,
    access: "public",
    kind: "public",
    lastAccess: null,
  },
];

export const INITIAL_RULES: DemoRules = {
  mode: "autopilot",
  contact: true,
  viewings: true,
  publishAd: false,
  shareProfile: true,
  sharePrivate: false,
  perDay: 5,
};

export const INITIAL_FLAGS: DemoFlags = { voice: true, publicSearch: false };

/** The portal the demo works through; the blockers are all about this one. */
export const PORTAL_SOURCE_ID = "roomscout";

/* ---------------------------------------------------------------------------
 * Candidates — ScreensC.jsx `CANDS`
 * ------------------------------------------------------------------------- */

export type CandidateId = "west" | "esslingen" | "ost";

export interface DemoCandidate {
  readonly id: CandidateId;
  readonly priceNum: number;
  /** false → „Schlagzeug müsste abgebaut werden“. */
  readonly storageOk: boolean;
  /** `null` renders the „Foto folgt vom Anbieter“ placeholder (DECISIONS item 28). */
  readonly photo: string | null;
  readonly nameKey: StringCopyKey;
  readonly shortKey: StringCopyKey;
  readonly priceKey: StringCopyKey;
  readonly timeKey: StringCopyKey;
  readonly timeLowerKey: StringCopyKey;
  readonly storageKey: StringCopyKey;
  readonly wayKey: StringCopyKey;
  readonly sizeKey: StringCopyKey;
  readonly noteKey: StringCopyKey;
}

const WEST: DemoCandidate = {
  id: "west",
  priceNum: 280,
  storageOk: true,
  photo: "/design/proberaum.png",
  nameKey: "scout.candidates.west.name",
  shortKey: "scout.candidates.west.short",
  priceKey: "scout.candidates.west.price",
  timeKey: "scout.candidates.west.time",
  timeLowerKey: "scout.candidates.west.timeLower",
  storageKey: "scout.candidates.west.storage",
  wayKey: "scout.candidates.west.way",
  sizeKey: "scout.candidates.west.size",
  noteKey: "scout.candidates.west.note",
};

const ESSLINGEN: DemoCandidate = {
  id: "esslingen",
  priceNum: 320,
  storageOk: true,
  photo: null,
  nameKey: "scout.candidates.esslingen.name",
  shortKey: "scout.candidates.esslingen.short",
  priceKey: "scout.candidates.esslingen.price",
  timeKey: "scout.candidates.esslingen.time",
  timeLowerKey: "scout.candidates.esslingen.timeLower",
  storageKey: "scout.candidates.esslingen.storage",
  wayKey: "scout.candidates.esslingen.way",
  sizeKey: "scout.candidates.esslingen.size",
  noteKey: "scout.candidates.esslingen.note",
};

const OST: DemoCandidate = {
  id: "ost",
  priceNum: 350,
  storageOk: false,
  photo: null,
  nameKey: "scout.candidates.ost.name",
  shortKey: "scout.candidates.ost.short",
  priceKey: "scout.candidates.ost.price",
  timeKey: "scout.candidates.ost.time",
  timeLowerKey: "scout.candidates.ost.timeLower",
  storageKey: "scout.candidates.ost.storage",
  wayKey: "scout.candidates.ost.way",
  sizeKey: "scout.candidates.ost.size",
  noteKey: "scout.candidates.ost.note",
};

/** The three rooms, in the kit's order. */
export const CANDIDATES: readonly DemoCandidate[] = [WEST, ESSLINGEN, OST];

export const DEFAULT_CANDIDATE_ID: CandidateId = "west";

/** The offer the flow starts on (`CANDS[0]`), and the fallback for an unknown id. */
export function candidateById(id: CandidateId): DemoCandidate {
  return CANDIDATES.find((candidate) => candidate.id === id) ?? WEST;
}


/* ---------------------------------------------------------------------------
 * Dead end — ScreensC.jsx `opts`
 * ------------------------------------------------------------------------- */

export interface DeadEndOption {
  readonly target: CompromiseTarget;
  readonly factId: FactId;
  readonly titleKey: StringCopyKey;
  readonly subKey: StringCopyKey;
  readonly replyKey: StringCopyKey;
  /** The fact label this compromise writes; the budget option resolves it dynamically. */
  readonly labelKey?: StringCopyKey;
}

/**
 * The three compromises, in the kit's order. The budget option's label key is
 * derived from the current budget (DECISIONS item 27 — dynamic, not the frozen
 * „Budget bis 400 €“ literal).
 */
export const DEAD_END_OPTIONS: readonly DeadEndOption[] = [
  {
    target: "budget",
    factId: "budget",
    titleKey: "scout.deadEnd.option.budget.title",
    subKey: "scout.deadEnd.option.budget.sub",
    replyKey: "scout.deadEnd.reply.budget",
  },
  {
    target: "umland",
    factId: "ort",
    titleKey: "scout.deadEnd.option.umland.title",
    subKey: "scout.deadEnd.option.umland.sub",
    replyKey: "scout.deadEnd.reply.umland",
    labelKey: "scout.facts.ort.umland",
  },
  {
    target: "zeit",
    factId: "zeit",
    titleKey: "scout.deadEnd.option.zeit.title",
    subKey: "scout.deadEnd.option.zeit.sub",
    replyKey: "scout.deadEnd.reply.zeit",
    labelKey: "scout.facts.zeit.mittwochOderDonnerstag",
  },
];

/** The budget step a dead-end compromise offers (`budgetNum + 50`). */
export const DEAD_END_BUDGET_STEP = 50;

/* ---------------------------------------------------------------------------
 * Review terms — ScreensB.jsx `rows`
 * ------------------------------------------------------------------------- */

/** The fixed rows; the offer's own „time“ row is spliced in at index 1, as in the kit. */
export const REVIEW_TERM_KEYS: readonly StringCopyKey[] = [
  "scout.review.terms.shared",
  "scout.review.terms.storage",
  "scout.review.terms.start",
  "scout.review.terms.deposit",
  "scout.review.terms.notice",
];

/* ---------------------------------------------------------------------------
 * Status lines — ScreensB.jsx `STATUS`, `START_LINE`, `FOLLOW_STATUS`, `ALT_STATUS`
 * ------------------------------------------------------------------------- */

export const STATUS = {
  start: { key: "scout.autopilot.status.start" },
  searching: { key: "scout.autopilot.status.searching" },
  found: { key: "scout.autopilot.status.found" },
  asked: { key: "scout.autopilot.status.asked" },
  waiting: { key: "scout.autopilot.status.waiting" },
  followUp: { key: "scout.autopilot.status.followUp" },
  alternative: { key: "scout.autopilot.status.alternative" },
  noSource: { key: "scout.autopilot.status.noSource" },
  noAccess: { key: "scout.autopilot.status.noAccess" },
  prepared: { key: "scout.autopilot.status.prepared" },
  searchAgain: { key: "scout.autopilot.status.searchAgain" },
  keepSearching: { key: "scout.autopilot.status.keepSearching" },
  keepWaiting: { key: "scout.autopilot.status.keepWaiting" },
} satisfies Record<string, CopyRef>;

/** „Ich frage beim {roomName} nach einem Angebot …“ */
export function requestOfferStatus(roomNameKey: StringCopyKey): CopyRef {
  return {
    key: "scout.autopilot.status.requestOffer",
    varKeys: { roomName: roomNameKey },
  };
}

/* ---------------------------------------------------------------------------
 * Demo chapter picker — App.jsx `CHAPTERS`, copy from `src/ui/copy/de/dev.ts`
 * ------------------------------------------------------------------------- */

export type ChapterTarget =
  | { readonly kind: "stage"; readonly stage: ScoutStage }
  | { readonly kind: "view"; readonly view: "settings" | "operator" };

export interface Chapter {
  readonly id: string;
  /** A key of `devDe`, dotted from its root (`demo.chapter.welcome`). */
  readonly labelPath: string;
  readonly target: ChapterTarget;
}

/**
 * The kit's ten chapters plus the two panel entries its `<select>` appends.
 * `demo.chapter.waiting` and `demo.chapter.following_up` are dictionary
 * chapters without a stage of their own in this kit — see openQuestions.
 */
export const CHAPTERS: readonly Chapter[] = [
  { id: "welcome", labelPath: "demo.chapter.welcome", target: { kind: "stage", stage: "welcome" } },
  { id: "discovery", labelPath: "demo.chapter.discovery", target: { kind: "stage", stage: "discovery" } },
  { id: "brief", labelPath: "demo.chapter.brief_review", target: { kind: "stage", stage: "brief" } },
  { id: "scouting", labelPath: "demo.chapter.scouting", target: { kind: "stage", stage: "scouting" } },
  { id: "clarification", labelPath: "demo.chapter.clarification", target: { kind: "stage", stage: "clarification" } },
  { id: "dead_end", labelPath: "demo.chapter.dead_end", target: { kind: "stage", stage: "dead_end" } },
  { id: "candidates", labelPath: "demo.chapter.candidates", target: { kind: "stage", stage: "candidates" } },
  { id: "offer", labelPath: "demo.chapter.offer", target: { kind: "stage", stage: "offer" } },
  { id: "offer_review", labelPath: "demo.chapter.offer_review", target: { kind: "stage", stage: "offer_review" } },
  { id: "complete", labelPath: "demo.chapter.complete", target: { kind: "stage", stage: "complete" } },
  { id: "settings", labelPath: "demo.settings", target: { kind: "view", view: "settings" } },
  { id: "operator", labelPath: "demo.operator", target: { kind: "view", view: "operator" } },
];

/** Demo playback speeds (`demo.speed.*`). */
export const DEMO_SPEEDS = [
  { id: "1x", labelPath: "demo.speed.1x", factor: 1 },
  { id: "1_6x", labelPath: "demo.speed.1_6x", factor: 1.6 },
] as const;

export type DemoSpeedId = (typeof DEMO_SPEEDS)[number]["id"];
