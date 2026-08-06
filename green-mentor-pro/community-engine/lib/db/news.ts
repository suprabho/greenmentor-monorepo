/**
 * News (public.articles) reads and writes for the admin panel.
 *
 * Articles are otherwise insert-only, written by the platform's nightly RSS
 * worker. The one thing an editor needs to change by hand is the picture:
 * regulators (SEBI) and most wire copy publish no image at all, and the worker's
 * og:image fallback can't invent one. Everything here goes through the
 * service-role client — `articles` carries a public-read policy and no write
 * policy, so RLS would reject an admin's own session.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type NewsRow = {
  id: string;
  source: string;
  title: string;
  url: string;
  image_url: string | null;
  published_at: string | null;
  region: string | null;
};

const NEWS_COLUMNS = "id, source, title, url, image_url, published_at, region";

export async function listNews(supabase: SupabaseClient, limit = 120): Promise<NewsRow[]> {
  const { data, error } = await supabase
    .from("articles")
    .select(NEWS_COLUMNS)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as NewsRow[];
}

/** Set or clear one article's image. Returns the row as saved. */
export async function updateNewsImage(
  supabase: SupabaseClient,
  id: string,
  imageUrl: string | null,
): Promise<NewsRow> {
  const { data, error } = await supabase
    .from("articles")
    .update({ image_url: imageUrl })
    .eq("id", id)
    .select(NEWS_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as NewsRow;
}
