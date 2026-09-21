/**
 * An arranged viewing, in words — the goal state of a Scout run, shown on the
 * candidate rail, the room card, the provider thread, and spoken once by the
 * live Scout.
 *
 * The stored slot is already Berlin wall clock: the backend resolved the
 * provider's own sentence once (`convex/lib/berlinTime.ts`) and wrote the day
 * and the time down. Nothing here converts a time zone again. The day is read
 * as noon UTC — far from any boundary — so `Intl` can name the weekday and the
 * month without the date ever slipping to its neighbour, and the time is
 * printed exactly as it was agreed (24-hour, both languages: DECISIONS.md
 * item 44).
 */

import type { Locale } from "../../ui/copy/types";

/** The viewing as `conversations.listMine` / `providerConversations.listMine` carry it. */
export interface ViewingSlot {
  /** Berlin calendar day, `YYYY-MM-DD`. */
  date: string;
  /** Berlin wall clock, 24-hour `HH:MM`. */
  time: string;
}

/**
 * The one word in front of the slot. It lives here rather than in the
 * dictionary for the same reason `MESSAGE_DAY_WORDS` does in `copy/format.ts`:
 * the label is that word plus punctuation plus what `Intl` produced, so
 * splitting it across the copy layer would only hand callers two halves to
 * reassemble.
 */
const VIEWING_WORD: Record<string, string> = {
  de: "Besichtigung",
  en: "Viewing",
};

/** Noon UTC on the stored day; `undefined` for anything that is not a date. */
function storedDay(date: string): Date | undefined {
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function word(locale: Locale | string): string {
  return VIEWING_WORD[String(locale).slice(0, 2)] ?? VIEWING_WORD.en!;
}

/**
 * The status label beside a room: „Besichtigung · Fr., 25. Sept., 17:00“ /
 * "Viewing · Fri, Sep 25, 17:00". The exact weekday and month abbreviations
 * are ICU's, the time is the stored string.
 */
export function formatViewingLabel(viewing: ViewingSlot, locale: Locale | string): string {
  const day = storedDay(viewing.date);
  const shown = day
    ? new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(day)
    : viewing.date;
  return `${word(locale)} · ${shown}, ${viewing.time}`;
}

/**
 * The spoken form of the day for the Scout's one congratulation:
 * „Freitag, 25. September 2026“ / "Friday, September 25, 2026". The time is
 * said separately, so it is not part of this.
 */
export function formatViewingSentenceDate(viewing: ViewingSlot, locale: Locale | string): string {
  const day = storedDay(viewing.date);
  return day
    ? new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(day)
    : viewing.date;
}
