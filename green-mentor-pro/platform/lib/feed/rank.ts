/**
 * Feed ordering: recency, with Indian coverage boosted.
 *
 * The news feed should open on Indian ESG news without walling world news off
 * into a separate tab or a hard "all India, then all global" block. So instead
 * of partitioning, each Indian article is sorted as if it were published
 * {@link INDIA_BOOST_HOURS} later than it was: it outranks anything global from
 * the same window, and global stories re-enter the mix as you scroll.
 *
 * Two properties that matter:
 *  - With no Indian articles (the state before the worker first runs the new
 *    sources) this degrades to plain recency ordering.
 *  - A stale Indian article can't pin itself to the top forever — a global
 *    story published more than INDIA_BOOST_HOURS later still beats it.
 *
 * Applied in memory rather than in SQL: PostgREST can't express an ORDER BY
 * over a computed expression, and the list page already over-fetches and
 * filters client-side.
 */

export const INDIA_BOOST_HOURS = 36;

const BOOST_MS = INDIA_BOOST_HOURS * 60 * 60 * 1000;

export type RankableArticle = {
  region?: string | null;
  published_at: string | null;
};

/** Sort key: publish time shifted forward for Indian articles. Undated sinks. */
export function effectiveTime(row: RankableArticle): number {
  const t = row.published_at ? new Date(row.published_at).getTime() : Number.NaN;
  if (Number.isNaN(t)) return Number.NEGATIVE_INFINITY;
  return row.region === "india" ? t + BOOST_MS : t;
}

/** Newest-first by {@link effectiveTime}. Stable, so ties keep query order. */
export function rankFeed<T extends RankableArticle>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const at = effectiveTime(a);
    const bt = effectiveTime(b);
    // Not `bt - at`: two undated rows would subtract to NaN and leave the
    // comparator undefined.
    if (at === bt) return 0;
    return bt > at ? 1 : -1;
  });
}
