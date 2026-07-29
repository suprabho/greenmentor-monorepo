// Pure query-sanitising and ranking helpers for global search. Deliberately
// free of any Supabase / next/headers import so the logic most likely to
// harbour a silent bug (escaping, ordering) is unit-testable on its own —
// see rank.test.ts. The I/O lives in repo.ts.

export type SearchKind = "course" | "lesson" | "job" | "webinar" | "article";

export interface SearchHit {
  kind: SearchKind;
  id: string;
  title: string;
  /** Context line under the title — "GHG Accounting › Module 2", "Acme · Mumbai". */
  subtitle: string | null;
  href: string;
  /** Articles have no in-app detail route, so they link out to the publisher. */
  external?: boolean;
  score: number;
}

export interface SearchResults {
  hits: SearchHit[];
  /** True when the viewer is signed out, so course/lesson hits were never possible. */
  limitedBySignIn: boolean;
}

export const MIN_QUERY_LENGTH = 2;
export const MAX_QUERY_LENGTH = 64;

/**
 * Make a raw user query safe for a PostgREST `or=` filter.
 *
 * Two separate escaping problems, both of which silently corrupt results
 * rather than erroring loudly:
 *   1. PostgREST parses `,` `(` `)` and `.` as filter *syntax*, so `a,b` would
 *      be read as two conditions and `(` breaks the parse outright.
 *   2. `%` and `_` are `ilike` wildcards, so searching `100%` would otherwise
 *      match everything starting with `100`.
 *
 * Order matters: user backslashes are stripped *before* we add our own, so a
 * query of `\%` can't smuggle an unescaped wildcard through.
 *
 * Returns null for queries not worth a round trip.
 */
export function sanitizeQuery(raw: string): string | null {
  const stripped = raw
    .slice(0, MAX_QUERY_LENGTH)
    .replace(/[,().*:"'\\]/g, " ") // PostgREST filter delimiters
    .replace(/\s+/g, " ")
    .trim();
  if (stripped.length < MIN_QUERY_LENGTH) return null;
  return stripped.replace(/[%_]/g, (c) => `\\${c}`); // ilike wildcards
}

/**
 * Rank a hit by where the query matched. Title matches beat body matches, so
 * "Scope 3 Analyst" outranks a job whose only mention of "scope 3" is buried
 * in the description.
 */
export function scoreHit(title: string, q: string, otherFields: (string | null)[]): number {
  const t = title.toLowerCase();
  const needle = q.toLowerCase();
  if (t === needle) return 100;
  if (t.startsWith(needle)) return 80;
  if (t.includes(needle)) return 60;
  if (otherFields.some((f) => f?.toLowerCase().includes(needle))) return 30;
  return 10; // Postgres matched on a column we don't re-check here
}

/** Kind weight, applied as a sub-point tiebreak so equal-quality title matches
 *  surface learning content above news chatter. */
export const KIND_WEIGHT: Record<SearchKind, number> = {
  course: 0.5,
  lesson: 0.4,
  job: 0.3,
  webinar: 0.2,
  article: 0.1,
};

/** Build a PostgREST `or` expression: any of `cols` ilike %q%. */
export function anyColumnMatches(cols: string[], q: string): string {
  return cols.map((c) => `${c}.ilike.%${q}%`).join(",");
}

/**
 * Sort globally by score, then cap each kind so one noisy group can't crowd
 * out the others — the palette shows a slice of every kind that matched.
 */
export function rankAndCap(hits: SearchHit[], perKind: number): SearchHit[] {
  const sorted = [...hits].sort(
    (a, b) => b.score + KIND_WEIGHT[b.kind] - (a.score + KIND_WEIGHT[a.kind])
  );
  const kept: SearchHit[] = [];
  const seen = new Map<SearchKind, number>();
  for (const hit of sorted) {
    const n = seen.get(hit.kind) ?? 0;
    if (n >= perKind) continue;
    seen.set(hit.kind, n + 1);
    kept.push(hit);
  }
  return kept;
}
