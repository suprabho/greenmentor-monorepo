import { effectiveTime, type RankableArticle } from "./rank";

/**
 * Interleave community share cards into the ranked article feed.
 *
 * Articles arrive already ordered by rankFeed() — newest-first by
 * {@link effectiveTime}, which shifts Indian coverage forward. Cards are
 * slotted into that order by their publish time compared against the same
 * key, so a card published today surfaces at the top of today's stories and
 * ages down the scroll like any other item. Article order is never changed —
 * cards are inserted, not re-sorted, so the region boost keeps working.
 *
 * Cards older than every listed article append at the end rather than being
 * dropped: the article list is a trimmed page (top N), not the full archive.
 *
 * Structural generics keep this module pure — the page instantiates it with
 * FeedArticle / ShareCard, the unit test with bare literals.
 */

export type MergeableCard = { publishedAt: string };

export type FeedItem<A, C> = { kind: "article"; article: A } | { kind: "card"; card: C };

export function mergeFeed<A extends RankableArticle, C extends MergeableCard>(
  articles: A[],
  cards: C[]
): FeedItem<A, C>[] {
  // Newest-first, so the single pass below can consume them in order.
  const queue = [...cards].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  const items: FeedItem<A, C>[] = [];
  let next = 0;
  for (const article of articles) {
    const articleTime = effectiveTime(article);
    while (next < queue.length && new Date(queue[next].publishedAt).getTime() >= articleTime) {
      items.push({ kind: "card", card: queue[next++] });
    }
    items.push({ kind: "article", article });
  }
  while (next < queue.length) items.push({ kind: "card", card: queue[next++] });
  return items;
}
