import type { Doc, Id } from "../../../convex/_generated/dataModel";
import type { CopyVars, StringCopyKey } from "../../ui/copy/types";

type SavedNeedProjection = Omit<Doc<"savedNeeds">, "city" | "districts"> & {
  city?: string;
  districts?: string[];
};

/** `useCopy().t`, passed in so this module stays a pure function. */
export type Translate = (key: StringCopyKey, vars?: CopyVars) => string;

/**
 * One row of „Euer Suchauftrag“.
 *
 * `key` is also the `FactList` row id, so the five ids the design system
 * carries glyphs for (`ort`, `band`, `budget`, `zeit`, `equip`) are the ids
 * used here; everything else renders with the neutral dot.
 */
export type ScoutFact = {
  key: string;
  /** The German category („Ort“, „Band“) — the row's screen-reader label. */
  label: string;
  /** The rendered German value („Stuttgart · 20 km Umkreis“). */
  value: string;
};

export type ScoutWorkspaceMode =
  "discovery" | "waiting" | "attention" | "results" | "paused";

type MatchProjection = {
  signalId: Id<"signals">;
  reasons: string[];
  uncertainties: string[];
};

type OpportunityProjection = {
  status:
    | "new"
    | "reviewing"
    | "saved"
    | "dismissed"
    | "contacted"
    | "converted"
    | "expired";
  uncertainties: string[];
};

type Facet = NonNullable<Doc<"savedNeeds">["facets"]>[number];

/**
 * How one known facet renders.
 *
 * `copy` names the string under `liveScout.facets.*`; `kind` says how the
 * stored value enters it — `flag` renders the label alone and only when the
 * value is true, `text` interpolates `{text}`, `count` interpolates `{count}`.
 */
type FacetRule = { copy: string; kind: "flag" | "text" | "count" };

/**
 * The facets that have a German label — **an allowlist**. The Scout writes
 * `namespace`/`key` freely (`convex/scout.ts` `updateSearchDraft`), so a facet
 * this table does not know is dropped from the brief rather than shown as a
 * raw key: „on_site_or_storage_allowed“ and a bare „4“ were exactly what the
 * musician saw in the 2026-09-15 test run. A new facet becomes visible by
 * getting a row here and a string in `liveScout.facets`.
 */
const FACET_RULES: Record<string, FacetRule> = {
  "equipment.storage": { copy: "equipmentStorage", kind: "flag" },
  "equipment.drum_storage": { copy: "equipmentStorage", kind: "flag" },
  "equipment.on_site_or_storage_allowed": { copy: "equipmentStorage", kind: "flag" },
  "equipment.drums": { copy: "equipmentDrums", kind: "flag" },
  "equipment.pa": { copy: "equipmentPa", kind: "flag" },
  "equipment.backline": { copy: "equipmentBackline", kind: "flag" },
  "access.parking": { copy: "accessParking", kind: "flag" },
  "access.transport": { copy: "accessTransport", kind: "text" },
  "access.around_the_clock": { copy: "accessAnytime", kind: "flag" },
  "noise.night_allowed": { copy: "noiseNight", kind: "flag" },
  "room.size_sqm": { copy: "roomSize", kind: "count" },
  "contract.min_term_months": { copy: "contractMinTerm", kind: "count" },
  "cost.deposit_eur": { copy: "costDeposit", kind: "count" },
};

/**
 * The facets that mean „so many people are in the band“. They never become a
 * row of their own: they are folded into the one „Band“ fact, so the brief
 * says „4er-Rockband · Schlagzeug“ instead of a bullet reading „4“.
 */
const BAND_SIZE_KEYS = new Set([
  "band.size",
  "band.members",
  "band.member_count",
  "band.people",
]);

/** The words a string facet uses for „no“; everything else counts as set. */
const FALSE_WORDS = new Set(["false", "nein", "no", "0", "none", "keine", ""]);

function facetId(facet: Facet): string {
  return `${facet.namespace}.${facet.key}`.trim().toLowerCase();
}

function isSet(value: Facet["value"]): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (Array.isArray(value)) return value.length > 0;
  return !FALSE_WORDS.has(value.trim().toLowerCase());
}

function facetText(value: Facet["value"]): string {
  if (Array.isArray(value)) return value.join(" · ");
  if (typeof value === "boolean") return "";
  return String(value).trim();
}

function facetCount(value: Facet["value"]): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normalise(value: string): string {
  return value.trim().toLocaleLowerCase("de-DE");
}

/** Parts of a composed value that the requirements sentence already says. */
function withoutKnown(parts: string[], known: string): string[] {
  const haystack = normalise(known);
  const kept: string[] = [];
  for (const part of parts) {
    const text = part.trim();
    if (!text) continue;
    const value = normalise(text);
    if (haystack && haystack.includes(value)) continue;
    if (kept.some((row) => normalise(row) === value)) continue;
    kept.push(text);
  }
  return kept;
}

/**
 * One fact per key, and no fact that another fact already says.
 *
 * A value contained in a longer value is the duplicate („Rock“ inside
 * „4er-Rockband“, „Schlagzeug“ inside the requirements sentence); between two
 * equal values the earlier one wins, so the display order decides.
 */
function dedupe(facts: ScoutFact[]): ScoutFact[] {
  const dropped = new Set<number>();
  const keys = new Set<string>();
  facts.forEach((fact, index) => {
    const value = normalise(fact.value);
    if (!value || keys.has(fact.key)) {
      dropped.add(index);
      return;
    }
    const covered = facts.some((other, otherIndex) => {
      if (otherIndex === index || dropped.has(otherIndex)) return false;
      const otherValue = normalise(other.value);
      if (!otherValue.includes(value)) return false;
      return otherValue.length > value.length || otherIndex < index;
    });
    if (covered) {
      dropped.add(index);
      return;
    }
    keys.add(fact.key);
  });
  return facts.filter((_, index) => !dropped.has(index));
}

/**
 * „Euer Suchauftrag“ as the aside and the review card render it: German
 * throughout, one row per criterion, nothing the musician did not say.
 *
 * Three rules come out of the maintainer's test run (issue 3):
 *  1. A facet renders through {@link FACET_RULES} or not at all — never as its
 *     raw key, and a boolean facet renders its label only while it is true.
 *  2. Genres, instruments, band size, the arrangement and an open
 *     collaboration are **one** „Band“ fact („Geteilter Raum · 4er-Rockband ·
 *     Schlagzeug“), not four bullets repeating each other.
 *  3. Anything the requirements sentence already contains is dropped, in both
 *     directions and case-insensitively.
 */
export function factsFromNeed(need: SavedNeedProjection, t: Translate): ScoutFact[] {
  const facts: ScoutFact[] = [];
  const requirements = need.requirements.join(" · ");
  const facets = need.facets ?? [];

  const location = withoutKnown(
    [
      need.locationLabel?.trim() || need.locationQuery?.trim() || need.city?.trim() || "",
      need.radiusKm === undefined ? "" : t("liveScout.radius", { count: need.radiusKm }),
    ],
    "",
  ).join(" · ");
  if (location) facts.push({ key: "ort", label: t("liveScout.location"), value: location });

  facts.push({ key: "band", label: t("liveScout.band"), value: bandValue(need, facets, requirements, t) });

  if (need.maxBudgetEur !== undefined) {
    facts.push({
      key: "budget",
      label: t("liveScout.budget"),
      value: t("liveScout.budgetValue", { count: need.maxBudgetEur }),
    });
  }
  if (need.schedule.length) {
    facts.push({ key: "zeit", label: t("liveScout.schedule"), value: need.schedule.join(" · ") });
  }
  if (requirements) {
    facts.push({ key: "equip", label: t("liveScout.requirements"), value: requirements });
  }
  if (need.openToSharing !== undefined) {
    facts.push({
      key: "sharing",
      label: t("liveScout.sharing"),
      value: t(need.openToSharing ? "liveScout.sharingYes" : "liveScout.sharingNo"),
    });
  }
  for (const facet of facets) {
    const fact = facetFact(facet, t);
    if (fact) facts.push(fact);
  }
  return dedupe(facts);
}

/** The band in one line: room type, band profile, instruments, openness. */
function bandValue(
  need: SavedNeedProjection,
  facets: Facet[],
  requirements: string,
  t: Translate,
): string {
  const size = facets
    .filter((facet) => BAND_SIZE_KEYS.has(facetId(facet)))
    .map((facet) => facetCount(facet.value))
    .find((count): count is number => count !== undefined && count > 0);
  const genres = (need.genres ?? []).map((genre) => genre.trim()).filter(Boolean);
  const parts: string[] = [];

  const arrangement = need.arrangement.map((value) => t(`liveScout.${value}`)).join(" · ");
  if (arrangement) parts.push(arrangement);
  if (size !== undefined && genres[0]) {
    parts.push(t("liveScout.bandProfile", { count: size, text: genres[0] }), ...genres.slice(1));
  } else if (size !== undefined) {
    parts.push(t("liveScout.facets.bandSize", { count: size }));
  } else {
    parts.push(...genres);
  }
  parts.push(...(need.instruments ?? []));
  // „Nur Raumsuche“ is not a wish — it is the absence of one, and it read as
  // noise next to the band line. Only the open case says anything.
  if (need.collaborationOpen === true) parts.push(t("liveScout.connectionsYes"));

  return withoutKnown(parts, requirements).join(" · ");
}

function facetFact(facet: Facet, t: Translate): ScoutFact | undefined {
  const id = facetId(facet);
  if (BAND_SIZE_KEYS.has(id)) return undefined;
  const rule = FACET_RULES[id];
  if (!rule) return undefined;
  const copy = `liveScout.facets.${rule.copy}` as StringCopyKey;

  let value: string | undefined;
  if (rule.kind === "flag") {
    value = isSet(facet.value) ? t(copy) : undefined;
  } else if (rule.kind === "count") {
    const count = facetCount(facet.value);
    value = count === undefined ? undefined : t(copy, { count });
  } else {
    const text = facetText(facet.value);
    value = text ? t(copy, { text }) : undefined;
  }
  if (!value) return undefined;
  return {
    key: `facet:${rule.copy}`,
    label: value,
    value: facet.confidence < 0.75 ? t("liveScout.factUnsure", { text: value }) : value,
  };
}

export function getScoutWorkspaceMode(
  need: SavedNeedProjection,
  matches: MatchProjection[] | undefined,
  opportunities: OpportunityProjection[] | undefined,
): ScoutWorkspaceMode {
  if (need.status === "draft") return "discovery";
  if (need.status === "paused") return "paused";
  if (
    opportunities?.some(
      (row) =>
        ["new", "reviewing", "contacted"].includes(row.status) &&
        row.uncertainties.length > 0,
    )
  )
    return "attention";
  if (matches?.length) return "results";
  return "waiting";
}

export function activeMatchCount(
  matches: MatchProjection[] | undefined,
): number {
  return matches?.length ?? 0;
}
