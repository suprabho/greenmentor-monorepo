// Streak day-boundaries use the learner's default timezone per PRD §8.3.
const STREAK_TIMEZONE = "Asia/Kolkata";

/** YYYY-MM-DD in Asia/Kolkata, for streak day comparisons. */
export function kolkataDateString(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: STREAK_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Whole calendar days between two YYYY-MM-DD strings (b - a). */
export function daysBetween(a: string, b: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((Date.parse(b) - Date.parse(a)) / msPerDay);
}
