/**
 * Berlin wall-clock time without `Intl`: the Convex runtime carries no
 * guaranteed IANA time-zone database, so the CET/CEST rule is computed here.
 * Central European Summer Time (UTC+2) runs from the last Sunday of March at
 * 01:00 UTC until the last Sunday of October at 01:00 UTC; outside that window
 * Berlin is UTC+1. Pure arithmetic, so a query, a mutation and a test all agree.
 */

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export type BerlinWeekday = (typeof WEEKDAYS)[number];
export type BerlinParts = { date: string; time: string; weekday: BerlinWeekday };

export const BERLIN_TIME_ZONE = "Europe/Berlin" as const;

/** 01:00 UTC on the last Sunday of `month` (0-based) in `year`. */
function lastSundayAtOneUtc(year: number, month: number): number {
  const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0));
  return Date.UTC(year, month, lastDayOfMonth.getUTCDate() - lastDayOfMonth.getUTCDay(), 1);
}

/** Minutes Berlin runs ahead of UTC at this instant: 120 in summer, 60 otherwise. */
export function berlinOffsetMinutes(epochMs: number): number {
  const year = new Date(epochMs).getUTCFullYear();
  return epochMs >= lastSundayAtOneUtc(year, 2) && epochMs < lastSundayAtOneUtc(year, 9) ? 120 : 60;
}

const pad = (value: number) => String(value).padStart(2, "0");

/** Berlin calendar date, 24-hour wall clock and weekday for an instant. */
export function berlinParts(epochMs: number): BerlinParts {
  const local = new Date(epochMs + berlinOffsetMinutes(epochMs) * 60_000);
  return {
    date: `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`,
    time: `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`,
    weekday: WEEKDAYS[local.getUTCDay()]!,
  };
}

/**
 * Weekday of a stored "YYYY-MM-DD" viewing date. The date is already a Berlin
 * calendar date, so it is read at midday UTC: no offset can move it a day.
 */
export function berlinWeekdayOfDate(date: string): BerlinWeekday | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = Date.parse(`${date}T12:00:00Z`);
  return Number.isNaN(parsed) ? null : WEEKDAYS[new Date(parsed).getUTCDay()]!;
}

/** One trusted case-card line so the model can resolve "Friday" to a date. */
export function berlinNowLine(epochMs: number): string {
  const { weekday, date, time } = berlinParts(epochMs);
  return `Current date and time in Europe/Berlin: ${weekday} ${date} ${time}. Resolve relative dates (Friday, tomorrow, next week) from it.`;
}
