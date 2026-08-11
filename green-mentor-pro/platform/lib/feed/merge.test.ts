import { describe, expect, it } from "vitest";
import { mergeFeed, type FeedItem } from "./merge";

type TestArticle = { id: string; published_at: string | null; region: string | null };
type TestCard = { id: string; publishedAt: string };

const article = (id: string, published_at: string | null, region: string | null = null): TestArticle => ({
  id,
  published_at,
  region,
});
const card = (id: string, publishedAt: string): TestCard => ({ id, publishedAt });

const ids = (items: FeedItem<TestArticle, TestCard>[]) =>
  items.map((i) => (i.kind === "article" ? `a:${i.article.id}` : `c:${i.card.id}`));

describe("mergeFeed", () => {
  it("returns articles unchanged when there are no cards", () => {
    const items = mergeFeed([article("1", "2026-08-10T00:00:00Z")], []);
    expect(ids(items)).toEqual(["a:1"]);
  });

  it("returns cards alone when there are no articles", () => {
    const items = mergeFeed([], [card("x", "2026-08-01T00:00:00Z"), card("y", "2026-08-05T00:00:00Z")]);
    expect(ids(items)).toEqual(["c:y", "c:x"]);
  });

  it("slots cards by publish time between newest-first articles", () => {
    const items = mergeFeed(
      [article("new", "2026-08-10T00:00:00Z"), article("old", "2026-08-01T00:00:00Z")],
      [card("mid", "2026-08-05T00:00:00Z")]
    );
    expect(ids(items)).toEqual(["a:new", "c:mid", "a:old"]);
  });

  it("puts a card newer than every article first", () => {
    const items = mergeFeed(
      [article("a", "2026-08-10T00:00:00Z")],
      [card("fresh", "2026-08-11T00:00:00Z")]
    );
    expect(ids(items)).toEqual(["c:fresh", "a:a"]);
  });

  it("appends cards older than every listed article", () => {
    const items = mergeFeed(
      [article("a", "2026-08-10T00:00:00Z")],
      [card("ancient", "2026-01-01T00:00:00Z")]
    );
    expect(ids(items)).toEqual(["a:a", "c:ancient"]);
  });

  it("compares against the region-boosted key, preserving article order", () => {
    // The Indian article ranks above the newer global one (36h boost). A card
    // published between the two raw times is still older than both *effective*
    // keys, so it must not split the boosted pair — it lands below them.
    const india = article("india", "2026-08-09T00:00:00Z", "india");
    const global = article("global", "2026-08-09T12:00:00Z");
    const items = mergeFeed(
      [india, global],
      [card("between", "2026-08-09T06:00:00Z")]
    );
    expect(ids(items)).toEqual(["a:india", "a:global", "c:between"]);
  });

  it("keeps multiple cards newest-first regardless of input order", () => {
    const items = mergeFeed([], [card("older", "2026-08-01T00:00:00Z"), card("newer", "2026-08-02T00:00:00Z")]);
    expect(ids(items)).toEqual(["c:newer", "c:older"]);
  });
});
