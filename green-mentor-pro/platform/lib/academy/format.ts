/** Duration helpers for academy surfaces. Lesson durations are nullable in the
 * DB, so every consumer must tolerate "unknown" — fmtDuration returns null and
 * sums simply skip nulls, letting the UI omit the segment entirely. */

export function fmtDuration(seconds: number | null): string | null {
  if (seconds == null || seconds <= 0) return null;
  if (seconds < 60) return `${Math.round(seconds)} s`;
  return `${Math.round(seconds / 60)} min`;
}

export function sumDurations(lessons: Array<{ durationSeconds: number | null }>): number {
  return lessons.reduce((total, l) => total + (l.durationSeconds ?? 0), 0);
}
