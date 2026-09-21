/**
 * The viewing label is the one place a date leaves the backend's Berlin wall
 * clock and becomes words. Two promises are pinned here: the stored day is the
 * day that is shown (no timezone shifts it back to Thursday), and the agreed
 * time is printed verbatim rather than re-derived. The exact punctuation and
 * month abbreviation are ICU's and deliberately not asserted.
 */

import { describe, expect, it } from "vitest";
import { formatViewingLabel, formatViewingSentenceDate } from "./formatViewing";

const demoSlot = { date: "2026-09-25", time: "17:00" };

describe("formatViewingLabel", () => {
  it("names the weekday, the day and the agreed time in English", () => {
    const label = formatViewingLabel(demoSlot, "en");
    expect(label).toContain("Viewing");
    expect(label).toMatch(/Fri/);
    expect(label).toMatch(/Sep\w*/);
    expect(label).toContain("25");
    expect(label).toContain("17:00");
  });

  it("names the weekday, the day and the agreed time in German", () => {
    const label = formatViewingLabel(demoSlot, "de");
    expect(label).toContain("Besichtigung");
    expect(label).toMatch(/Fr\.?/);
    expect(label).toMatch(/Sep\w*/);
    expect(label).toContain("25");
    expect(label).toContain("17:00");
  });

  it("keeps the stored day and never converts the time", () => {
    // 00:30 is the hour a naive local-time render would move to the day before.
    expect(formatViewingLabel({ date: "2026-01-05", time: "00:30" }, "de")).toContain("5");
    expect(formatViewingLabel({ date: "2026-01-05", time: "00:30" }, "de")).toMatch(/Mo\.?/);
    expect(formatViewingLabel({ date: "2026-01-05", time: "00:30" }, "de")).toContain("00:30");
    // Summer time: the backend already wrote the Berlin wall clock down.
    expect(formatViewingLabel({ date: "2026-07-01", time: "23:45" }, "en")).toContain("23:45");
  });

  it("shows a malformed date as stored rather than as Invalid Date", () => {
    const label = formatViewingLabel({ date: "not-a-day", time: "17:00" }, "de");
    expect(label).toBe("Besichtigung · not-a-day, 17:00");
  });
});

describe("formatViewingSentenceDate", () => {
  it("spells the day out for the spoken congratulation, without the time", () => {
    const spoken = formatViewingSentenceDate(demoSlot, "en");
    expect(spoken).toContain("Friday");
    expect(spoken).toContain("25");
    expect(spoken).toContain("September");
    expect(spoken).toContain("2026");
    expect(spoken).not.toContain("17:00");

    const gesprochen = formatViewingSentenceDate(demoSlot, "de");
    expect(gesprochen).toContain("Freitag");
    expect(gesprochen).toContain("25");
    expect(gesprochen).toContain("September");
    expect(gesprochen).toContain("2026");
  });

  it("falls back to the stored day when it cannot be parsed", () => {
    expect(formatViewingSentenceDate({ date: "2026-13-40", time: "17:00" }, "en")).toBe("2026-13-40");
  });
});
