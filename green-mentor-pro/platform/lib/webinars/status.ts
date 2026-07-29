import type { Webinar } from "@/lib/webinars/repo";

// Where a webinar sits relative to its scheduled slot. There is no "live" flag
// in the data — the admin hub only tracks the authoring lifecycle
// (draft/published/completed) — so the join window is derived from
// scheduled_at + duration_minutes. `now` is injectable throughout, like
// buildAgenda() in lib/home/agenda.ts, so the logic stays unit-testable.

/** Join opens this long before the scheduled start. */
export const JOIN_OPENS_BEFORE_MS = 10 * 60 * 1000;

/** Assumed session length when duration_minutes is null. */
export const DEFAULT_DURATION_MINUTES = 60;

/**
 * How far back the "upcoming" query looks. PostgREST can't filter on
 * scheduled_at + duration_minutes without rebuilding webinars_public, so the
 * query takes a generous superset and getWebinarPhase() trims it per row. Any
 * session longer than this drops out of Upcoming while still running.
 */
export const UPCOMING_LOOKBACK_MS = 12 * 60 * 60 * 1000;

export type WebinarPhase = "unscheduled" | "scheduled" | "joinable" | "ended";

/** The only fields the window math needs — keeps this usable mid-`map()`. */
export type TimedWebinar = Pick<Webinar, "scheduledAt" | "durationMinutes">;

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Scheduled start as epoch ms, or null when unset or unparseable. */
export function startsAt(webinar: TimedWebinar): number | null {
  if (!webinar.scheduledAt) return null;
  const ms = Date.parse(webinar.scheduledAt);
  return Number.isNaN(ms) ? null : ms;
}

/** When the Join button becomes available. */
export function joinOpensAt(webinar: TimedWebinar): number | null {
  const start = startsAt(webinar);
  return start === null ? null : start - JOIN_OPENS_BEFORE_MS;
}

function durationMs(webinar: TimedWebinar): number {
  return (webinar.durationMinutes ?? DEFAULT_DURATION_MINUTES) * MINUTE_MS;
}

/** When the session is assumed to be over. */
export function endsAt(webinar: TimedWebinar): number | null {
  const start = startsAt(webinar);
  return start === null ? null : start + durationMs(webinar);
}

export function getWebinarPhase(webinar: TimedWebinar, now: number = Date.now()): WebinarPhase {
  const start = startsAt(webinar);
  if (start === null) return "unscheduled";
  if (now >= start + durationMs(webinar)) return "ended";
  if (now >= start - JOIN_OPENS_BEFORE_MS) return "joinable";
  return "scheduled";
}

/**
 * Coarse countdown for the pre-window pill: "2d 5h", "4h 12m", "12m", "45s".
 * Seconds only appear in the final minute so the label isn't re-rendering
 * every second for hours, and a zero minor unit is dropped ("1d", not "1d 0h").
 */
export function formatCountdown(ms: number): string {
  const remaining = Math.max(0, ms);
  const pair = (major: number, majorMs: number, majorUnit: string, minorMs: number, minorUnit: string) => {
    const minor = Math.floor((remaining % majorMs) / minorMs);
    return minor === 0 ? `${major}${majorUnit}` : `${major}${majorUnit} ${minor}${minorUnit}`;
  };
  if (remaining >= DAY_MS) return pair(Math.floor(remaining / DAY_MS), DAY_MS, "d", HOUR_MS, "h");
  if (remaining >= HOUR_MS) return pair(Math.floor(remaining / HOUR_MS), HOUR_MS, "h", MINUTE_MS, "m");
  if (remaining >= MINUTE_MS) return `${Math.floor(remaining / MINUTE_MS)}m`;
  return `${Math.floor(remaining / 1000)}s`;
}
