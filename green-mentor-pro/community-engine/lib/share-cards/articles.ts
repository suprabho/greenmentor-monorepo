import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShareCardArticle, ShareCardEntity } from "./types";

/** The pipeline page's nested select, plus image_url (cards want the picture). */
const ARTICLE_SELECT =
  "id, source, title, url, summary, image_url, published_at, created_at, article_entities(entities(slug, name, kind))";

type ArticleRow = {
  id: string;
  source: string;
  title: string;
  url: string;
  summary: string | null;
  image_url: string | null;
  published_at: string | null;
  created_at: string;
  article_entities: { entities: ShareCardEntity | null }[] | null;
};

const NAMED_ENTITIES: Record<string, string> = {
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
};

/** RSS feeds ship titles/summaries with HTML entities still encoded (e.g.
 *  `&#124;`, `&amp;`), and React correctly escapes text — so without decoding,
 *  cards and pickers display the raw entity. Decode numeric + common named
 *  entities; `&amp;` last so double-encoded input resolves one level only. */
function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (m, hex: string) => {
      try {
        return String.fromCodePoint(parseInt(hex, 16));
      } catch {
        return m;
      }
    })
    .replace(/&#(\d+);/g, (m, dec: string) => {
      try {
        return String.fromCodePoint(Number(dec));
      } catch {
        return m;
      }
    })
    .replace(/&([a-zA-Z]+);/g, (m, name: string) => NAMED_ENTITIES[name] ?? m)
    .replace(/&amp;/g, "&");
}

function flatten(row: ArticleRow): ShareCardArticle {
  return {
    id: row.id,
    source: decodeEntities(row.source),
    title: decodeEntities(row.title),
    url: row.url,
    summary: row.summary ? decodeEntities(row.summary) : row.summary,
    image_url: row.image_url,
    published_at: row.published_at,
    entities: (row.article_entities ?? [])
      .map((ae) => ae.entities)
      .filter((e): e is ShareCardEntity => !!e),
  };
}

/**
 * News-pipe articles in the shape the card modules consume. `ids` scopes the
 * query to specific articles (the export route resolving a snapshot's picks);
 * otherwise returns the newest `limit` (the studio's picker list).
 */
export async function fetchShareCardArticles(
  supabase: SupabaseClient,
  opts: { ids?: string[]; limit?: number } = {}
): Promise<ShareCardArticle[]> {
  let query = supabase.from("articles").select(ARTICLE_SELECT);
  if (opts.ids && opts.ids.length > 0) {
    query = query.in("id", opts.ids);
  } else {
    query = query.order("created_at", { ascending: false }).limit(opts.limit ?? 60);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as ArticleRow[]).map(flatten);
}
