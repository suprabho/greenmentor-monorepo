import { describe, it, expect } from "vitest";
import {
  DEFAULT_DURATION_MINUTES,
  JOIN_OPENS_BEFORE_MS,
  endsAt,
  formatCountdown,
  getWebinarPhase,
  joinOpensAt,
  startsAt,
} from "./status";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// A fixed slot: 29 Jul 2026, 7:00 pm IST — the real cadence of the webinars.
const START_ISO = "2026-07-29T13:30:00.000Z";
const START = Date.parse(START_ISO);
const OPENS = START - JOIN_OPENS_BEFORE_MS;

const webinar = (durationMinutes: number | null = 60) => ({
  scheduledAt: START_ISO,
  durationMinutes,
});

describe("window boundaries", () => {
  it("resolves start, join-open and end times", () => {
    expect(startsAt(webinar())).toBe(START);
    expect(joinOpensAt(webinar())).toBe(START - 10 * MINUTE);
    expect(endsAt(webinar())).toBe(START + 60 * MINUTE);
  });

  it("falls back to the default duration when duration_minutes is null", () => {
    expect(endsAt(webinar(null))).toBe(START + DEFAULT_DURATION_MINUTES * MINUTE);
  });

  it("returns null for a webinar with no date", () => {
    const tba = { scheduledAt: null, durationMinutes: 60 };
    expect(startsAt(tba)).toBeNull();
    expect(joinOpensAt(tba)).toBeNull();
    expect(endsAt(tba)).toBeNull();
  });

  it("returns null for an unparseable date", () => {
    expect(startsAt({ scheduledAt: "not a date", durationMinutes: 60 })).toBeNull();
  });
});

describe("getWebinarPhase", () => {
  it("is scheduled well before the window", () => {
    expect(getWebinarPhase(webinar(), START - 2 * HOUR)).toBe("scheduled");
  });

  it("is still scheduled one millisecond before the window opens", () => {
    expect(getWebinarPhase(webinar(), OPENS - 1)).toBe("scheduled");
  });

  it("becomes joinable exactly 10 minutes before the start", () => {
    expect(getWebinarPhase(webinar(), OPENS)).toBe("joinable");
  });

  it("stays joinable at the start and mid-session", () => {
    expect(getWebinarPhase(webinar(), START)).toBe("joinable");
    expect(getWebinarPhase(webinar(), START + 30 * MINUTE)).toBe("joinable");
    expect(getWebinarPhase(webinar(), START + 60 * MINUTE - 1)).toBe("joinable");
  });

  it("ends exactly at start + duration", () => {
    expect(getWebinarPhase(webinar(), START + 60 * MINUTE)).toBe("ended");
    expect(getWebinarPhase(webinar(), START + 3 * HOUR)).toBe("ended");
  });

  it("applies the default duration when none is set", () => {
    expect(getWebinarPhase(webinar(null), START + DEFAULT_DURATION_MINUTES * MINUTE - 1)).toBe(
      "joinable"
    );
    expect(getWebinarPhase(webinar(null), START + DEFAULT_DURATION_MINUTES * MINUTE)).toBe("ended");
  });

  it("is unscheduled without a date", () => {
    expect(getWebinarPhase({ scheduledAt: null, durationMinutes: 60 }, START)).toBe("unscheduled");
  });
});

describe("formatCountdown", () => {
  it("shows days and hours beyond a day out", () => {
    expect(formatCountdown(2 * DAY + 5 * HOUR + 40 * MINUTE)).toBe("2d 5h");
  });

  it("shows hours and minutes within a day", () => {
    expect(formatCountdown(4 * HOUR + 12 * MINUTE + 30 * 1000)).toBe("4h 12m");
    expect(formatCountdown(DAY - 1)).toBe("23h 59m");
  });

  it("drops a zero minor unit rather than rendering \"1d 0h\"", () => {
    expect(formatCountdown(DAY + 30 * MINUTE)).toBe("1d");
    expect(formatCountdown(4 * HOUR + 30 * 1000)).toBe("4h");
  });

  it("shows whole minutes within the hour", () => {
    expect(formatCountdown(12 * MINUTE + 59 * 1000)).toBe("12m");
    expect(formatCountdown(MINUTE)).toBe("1m");
  });

  it("shows seconds only in the final minute", () => {
    expect(formatCountdown(45 * 1000)).toBe("45s");
    expect(formatCountdown(MINUTE - 1)).toBe("59s");
  });

  it("clamps negatives to zero rather than rendering a minus sign", () => {
    expect(formatCountdown(-5000)).toBe("0s");
  });
});
