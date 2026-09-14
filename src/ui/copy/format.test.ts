/**
 * `formatMessageStamp` — the timestamp under every Nachrichten bubble and next
 * to every conversation row.
 *
 * The exact month abbreviation is ICU's (`Sep.` / `Sept.` depending on the
 * runtime's CLDR), so the assertions pin what the surface actually promises:
 * the day words, the 24-hour zero-padded time, the calendar-day boundary, and
 * the short form used in the list.
 */

import { describe, expect, it } from "vitest";
import { formatMessageStamp } from "./format";

const now = new Date(2026, 8, 14, 11, 0).getTime();
const today = new Date(2026, 8, 14, 9, 41).getTime();
const yesterday = new Date(2026, 8, 13, 18, 2).getTime();
const earlier = new Date(2026, 8, 12, 9, 41).getTime();

describe("formatMessageStamp", () => {
  it("names today and yesterday, then falls back to the calendar date", () => {
    expect(formatMessageStamp("de", today, now)).toBe("Heute, 09:41");
    expect(formatMessageStamp("de", yesterday, now)).toBe("Gestern, 18:02");
    expect(formatMessageStamp("de", earlier, now)).toMatch(/^12\.\s*Sep\w*\.?, 09:41$/);
  });

  it("drops the time on every day but today in the short form", () => {
    expect(formatMessageStamp("de", today, now, { short: true })).toBe("09:41");
    expect(formatMessageStamp("de", yesterday, now, { short: true })).toBe("Gestern");
    expect(formatMessageStamp("de", earlier, now, { short: true })).toMatch(/^12\.\s*Sep\w*\.?$/);
  });

  it("splits on the calendar day, not on 24 hours", () => {
    const justAfterMidnight = new Date(2026, 8, 14, 0, 5).getTime();
    const justBeforeMidnight = new Date(2026, 8, 13, 23, 55).getTime();
    expect(formatMessageStamp("de", justAfterMidnight, now)).toBe("Heute, 00:05");
    expect(formatMessageStamp("de", justBeforeMidnight, now)).toBe("Gestern, 23:55");
  });

  it("reads a future timestamp as today instead of a negative day", () => {
    const ahead = new Date(2026, 8, 14, 23, 30).getTime();
    expect(formatMessageStamp("de", ahead, now)).toBe("Heute, 23:30");
  });

  it("translates the day words and never renders AM/PM", () => {
    expect(formatMessageStamp("en", today, now)).toBe("Today, 09:41");
    expect(formatMessageStamp("en", yesterday, now)).toBe("Yesterday, 18:02");
    expect(formatMessageStamp("en", yesterday, now)).not.toMatch(/[AaPp]\.?[Mm]/);
  });
});
