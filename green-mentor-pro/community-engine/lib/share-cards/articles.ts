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

function flatten(row: ArticleRow): ShareCardArticle {
  return {
    id: row.id,
    source: row.source,
    title: row.title,
    url: row.url,
    summary: row.summary,
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
