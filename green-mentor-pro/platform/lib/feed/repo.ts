import { parseShareParam, pickCanonical, shareSlug } from "@/lib/share/slug";
import { createClient } from "@/lib/supabase/server";

// Feed reads for the shareable /feed/:slug permalink.
//
// The list page (app/(app)/feed/page.tsx) still queries inline — it batches the
// article, stats, reaction and profile fetches in two Promise.all waves, which
// doesn't decompose cleanly into per-row helpers. This module covers the
// single-article path only, plus the row types both surfaces share.
//
// articles / entities / article_entities all carry a public read policy
// (migration 0003_feed.sql), so these run fine through the anon-key RLS-bound
// server client for signed-out visitors arriving from a shared link.

export type FeedEntity = { slug: string; name: string; kind: string };

export type FeedArticle = {
  id: string;
  /** Canonical URL segment, `{slug}-{idPrefix}`. Use articleHref() to build a path. */
  shareSlug: string;
  source: string;
  title: string;
  /** The publisher's URL — the "Read original" target, not our permalink. */
  url: string;
  summary: string | null;
  image_url: string | null;
  published_at: string | null;
  article_entities: { entities: FeedEntity | null }[] | null;
};

export const ARTICLE_COLUMNS =
  "id, slug, id_prefix, source, title, url, summary, image_url, published_at, article_entities(entities(slug, name, kind))";

/** A row exactly as ARTICLE_COLUMNS returns it, before mapArticle(). */
export type ArticleRowRaw = Omit<FeedArticle, "shareSlug"> & { slug: string | null; id_prefix: string | null };

export function mapArticle(row: ArticleRowRaw): FeedArticle {
  return {
    id: row.id,
    shareSlug: shareSlug(row.slug, row.id),
    source: row.source,
    title: row.title,
    url: row.url,
    summary: row.summary,
    image_url: row.image_url,
    published_at: row.published_at,
    article_entities: row.article_entities,
  };
}

/**
 * Resolve a `[slug]` route param — either a share slug or a bare uuid. See
 * resolveWebinar() in lib/webinars/repo.ts for the canonical-redirect contract.
 */
export async function resolveArticle(param: string): Promise<FeedArticle | null> {
  const parsed = parseShareParam(param);
  if (!parsed) return null;
  const supabase = await createClient();

  const query = supabase.from("articles").select(ARTICLE_COLUMNS);
  const { data, error } =
    parsed.kind === "uuid"
      ? await query.eq("id", parsed.id).limit(1)
      : await query.eq("id_prefix", parsed.idPrefix).limit(2);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as ArticleRowRaw[];
  const row = pickCanonical(rows, parsed.kind === "slug" ? parsed.slug : "");
  return row ? mapArticle(row) : null;
}

export type ArticleSocial = {
  stats: { like_count: number; dislike_count: number; comment_count: number };
  reaction: "like" | "dislike" | null;
};

/**
 * Like/dislike/comment counts for one article, plus the viewer's own reaction.
 *
 * article_social_stats (migration 0004_feed_social.sql) is a definer view, so
 * the counts are readable signed-out; the reaction lookup is skipped without a
 * user. Both degrade to zeroes rather than throwing if 0004 hasn't been
 * applied, matching how the list page handles it.
 */
export async function fetchArticleSocial(articleId: string, userId: string | null): Promise<ArticleSocial> {
  const supabase = await createClient();
  const [{ data: stats }, { data: reaction }] = await Promise.all([
    supabase
      .from("article_social_stats")
      .select("like_count, dislike_count, comment_count")
      .eq("article_id", articleId)
      .maybeSingle(),
    userId
      ? supabase.from("reactions").select("kind").eq("user_id", userId).eq("article_id", articleId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    stats: {
      like_count: stats?.like_count ?? 0,
      dislike_count: stats?.dislike_count ?? 0,
      comment_count: stats?.comment_count ?? 0,
    },
    reaction: (reaction?.kind as ArticleSocial["reaction"]) ?? null,
  };
}
