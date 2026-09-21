import { describe, expect, it } from "vitest";
import { berlinNowLine, berlinOffsetMinutes, berlinParts, berlinWeekdayOfDate } from "./berlinTime";

const at = (iso: string) => Date.parse(iso);

describe("Berlin wall clock without Intl", () => {
  it("turns the demo instant into the Berlin date, 24-hour time and weekday", () => {
    expect(berlinParts(at("2026-09-25T15:00:00Z"))).toEqual({ date: "2026-09-25", time: "17:00", weekday: "Friday" });
  });

  it("springs forward at the last Sunday of March, 01:00 UTC", () => {
    expect(berlinOffsetMinutes(at("2026-03-29T00:59:59Z"))).toBe(60);
    expect(berlinParts(at("2026-03-29T00:59:00Z"))).toEqual({ date: "2026-03-29", time: "01:59", weekday: "Sunday" });
    expect(berlinOffsetMinutes(at("2026-03-29T01:00:00Z"))).toBe(120);
    expect(berlinParts(at("2026-03-29T01:00:00Z"))).toEqual({ date: "2026-03-29", time: "03:00", weekday: "Sunday" });
  });

  it("falls back at the last Sunday of October, 01:00 UTC", () => {
    expect(berlinOffsetMinutes(at("2026-10-25T00:59:59Z"))).toBe(120);
    expect(berlinParts(at("2026-10-25T00:59:00Z"))).toEqual({ date: "2026-10-25", time: "02:59", weekday: "Sunday" });
    expect(berlinOffsetMinutes(at("2026-10-25T01:00:00Z"))).toBe(60);
    expect(berlinParts(at("2026-10-25T01:00:00Z"))).toEqual({ date: "2026-10-25", time: "02:00", weekday: "Sunday" });
  });

  it("keeps midwinter on CET and crosses midnight into the next Berlin day", () => {
    expect(berlinParts(at("2026-01-15T08:30:00Z"))).toEqual({ date: "2026-01-15", time: "09:30", weekday: "Thursday" });
    expect(berlinParts(at("2026-01-15T23:30:00Z"))).toEqual({ date: "2026-01-16", time: "00:30", weekday: "Friday" });
  });

  it("reads a stored viewing date as a Berlin calendar day and rejects a malformed one", () => {
    expect(berlinWeekdayOfDate("2026-09-25")).toBe("Friday");
    expect(berlinWeekdayOfDate("2026-12-31")).toBe("Thursday");
    expect(berlinWeekdayOfDate("25.09.2026")).toBeNull();
  });

  it("states the current Berlin moment as one trusted case-card line", () => {
    expect(berlinNowLine(at("2026-09-25T15:00:00Z")))
      .toBe("Current date and time in Europe/Berlin: Friday 2026-09-25 17:00. Resolve relative dates (Friday, tomorrow, next week) from it.");
  });
});
