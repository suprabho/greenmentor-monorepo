// Pure watch-progress math — no I/O — so the anti-cheat core (PRD
// §6.2 FR-V-04) is easy to reason about even with no test runner in this repo.

export type Range = [number, number];

/**
 * Merge newly-watched segments into an existing sorted union, coalescing
 * overlapping or near-adjacent (gap <= 1s) intervals. A scrub-to-the-end only
 * ever contributes a near-zero-length segment at the destination, so it can't
 * inflate the total watched duration.
 */
export function mergeRanges(existing: Range[], incoming: Range[]): Range[] {
  const all = [...existing, ...incoming]
    .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end > start)
    .sort((a, b) => a[0] - b[0]);

  const merged: Range[] = [];
  for (const [start, end] of all) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1] + 1) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }
  return merged;
}

export function watchedSeconds(ranges: Range[]): number {
  return ranges.reduce((sum, [start, end]) => sum + (end - start), 0);
}
