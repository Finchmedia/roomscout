/**
 * DEMO DATA — the landing page's scripted example search.
 *
 * Nothing here is product state: the conversation, the brief, the offer and the
 * FAQ are the fixed marketing script of
 * `design-system/ui_kits/landing/Landing.jsx` (spec: `docs/UI_PORT/LANDING_SCREENS.md`
 * §6–§12). Every visible string is a key into `src/ui/copy/de/landing.ts` and is
 * read through `useCopy().t()` at render time — this module holds structure and
 * order only, never German text.
 *
 * The conversation follows LANDING_SCREENS §6.3's four-line table (the kit's
 * static recreation drops the „Donnerstags“ line; the spec and the shipped copy
 * dictionary both keep it), including the budget correction on the last line —
 * `landing.fact.budget.initial` (400 €) is overwritten by
 * `landing.fact.budget.corrected` (350 €) under the same `budget` id.
 */

import type { FactId } from "@/components/ui/fact-list"
import type { StringCopyKey } from "@/ui/copy"

/**
 * The page's anchor targets. Written as ids and composed into `#…` hrefs at the
 * call site: a literal `"#features"` reads as a colour to the design-system
 * lint rule (`#fea` is valid hex), and one list beats five scattered strings.
 */
export const SECTION_IDS = {
  top: "top",
  how: "how",
  work: "work",
  features: "features",
  control: "control",
} as const

/** Where every „Demo“ CTA points until the real app route exists (task brief). */
export const DEMO_HREF = "/design/scout"

/** LANDING_SCREENS §12: the closing secondary CTA and the footer link. */
export const PROJECT_HREF = "https://github.com/Finchmedia/roomscout"

/** `public/design/` — the two shipped landing assets (§15). */
export const HERO_PREVIEW_SRC = "/design/hero-preview.png"
export const ROOM_PHOTO_SRC = "/design/proberaum.png"

/** One chip a spoken line drops into the brief. */
export interface DemoChip {
  readonly id: FactId
  readonly labelKey: StringCopyKey
}

/** One spoken line of the scripted conversation. */
export interface DemoLine {
  readonly id: string
  readonly textKey: StringCopyKey
  readonly chips: readonly DemoChip[]
}

/** LANDING_SCREENS §6.3 „LINES“, verbatim in order. */
export const CONVERSATION_LINES: readonly DemoLine[] = [
  {
    id: "line1",
    textKey: "landing.convo.line1",
    chips: [
      { id: "ort", labelKey: "landing.fact.ort" },
      { id: "band", labelKey: "landing.fact.band" },
    ],
  },
  {
    id: "line2",
    textKey: "landing.convo.line2",
    chips: [
      { id: "budget", labelKey: "landing.fact.budget.initial" },
      { id: "equip", labelKey: "landing.fact.equip" },
    ],
  },
  {
    id: "line3",
    textKey: "landing.convo.line3",
    chips: [{ id: "zeit", labelKey: "landing.fact.zeit" }],
  },
  {
    id: "line4",
    textKey: "landing.convo.line4",
    chips: [{ id: "budget", labelKey: "landing.fact.budget.corrected" }],
  },
]

/** §6.4 `ORDER` — the live panel always renders the brief in this order. */
export const FACT_ORDER: readonly FactId[] = ["ort", "budget", "band", "zeit", "equip"]

/** §6.5 the summary card's five static rows. */
export const BRIEF_ROWS: readonly DemoChip[] = [
  { id: "ort", labelKey: "landing.brief.card.row1" },
  { id: "budget", labelKey: "landing.brief.card.row2" },
  { id: "band", labelKey: "landing.brief.card.row3" },
  { id: "zeit", labelKey: "landing.brief.card.row4" },
  { id: "equip", labelKey: "landing.brief.card.row5" },
]

/** §7 the three cross-faded status lines of „Der Scout arbeitet“. */
export const WORK_STATUS_KEYS: readonly StringCopyKey[] = [
  "landing.work.status1",
  "landing.work.status2",
  "landing.work.status3",
]

/** §9 the offer card's two check rows. */
export const OFFER_FEATURE_KEYS: readonly StringCopyKey[] = [
  "landing.offer.feature1",
  "landing.offer.feature2",
]

/** §11 the three FAQ items; item 0 is open on load. */
export const FAQ_ITEMS: readonly {
  readonly id: string
  readonly questionKey: StringCopyKey
  readonly answerKey: StringCopyKey
}[] = [
  { id: "faq-0", questionKey: "landing.faq.q1", answerKey: "landing.faq.a1" },
  { id: "faq-1", questionKey: "landing.faq.q2", answerKey: "landing.faq.a2" },
  { id: "faq-2", questionKey: "landing.faq.q3", answerKey: "landing.faq.a3" },
]

/** §8 the user's Rückfrage answer. `null` = not answered yet. */
export type ClarifyChoice = "wednesday" | "thursday" | null
