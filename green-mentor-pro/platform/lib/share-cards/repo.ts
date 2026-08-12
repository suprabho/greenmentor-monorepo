import { createClient } from "@/lib/supabase/server";

// Share cards are composed in the community-engine Share Cards Studio and
// published to learners through the share_cards_public view
// (community_share_card_publications, RLS with no policies) — the same
// authoring→publish boundary as lib/jobs/repo.ts / lib/webinars/repo.ts.
// All reads go through the RLS-bound server client.

export interface ShareCard {
  id: string;
  /** The studio card this publication renders (stable across republishes). */
  cardId: string;
  title: string;
  caption: string | null;
  /** Output aspect ratio, e.g. "1:1" | "4:5" | "9:16" | "16:9". */
  ratio: string;
  /** Public URL of the rendered PNG in the share-cards bucket. */
  imageUrl: string;
  publishedAt: string;
}

const SHARE_CARD_COLUMNS = "id, card_id, title, caption, ratio, image_url, published_at";

interface ShareCardRowRaw {
  id: string;
  card_id: string;
  title: string;
  caption: string | null;
  ratio: string | null;
  image_url: string;
  published_at: string;
}

function mapShareCard(row: ShareCardRowRaw): ShareCard {
  return {
    id: row.id,
    cardId: row.card_id,
    title: row.title,
    caption: row.caption,
    ratio: row.ratio ?? "1:1",
    imageUrl: row.image_url,
    publishedAt: row.published_at,
  };
}

/** CSS aspect-ratio ("4 / 5") for a card's ratio string, so the feed can
 *  reserve the right box before the image loads. Unknown shapes read square. */
export function cardAspect(ratio: string): string {
  const m = /^(\d+):(\d+)$/.exec(ratio.trim());
  if (!m) return "1 / 1";
  return `${m[1]} / ${m[2]}`;
}

/** Every published share card, newest first. */
export async function fetchShareCards(): Promise<ShareCard[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("share_cards_public")
    .select(SHARE_CARD_COLUMNS)
    .order("published_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ShareCardRowRaw[]).map(mapShareCard);
}

/** One published share card by its stable studio card id (the /feed/card/:id
 *  permalink identifier), or null if the card isn't currently published. */
export async function fetchShareCard(cardId: string): Promise<ShareCard | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("share_cards_public")
    .select(SHARE_CARD_COLUMNS)
    .eq("card_id", cardId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapShareCard(data as ShareCardRowRaw) : null;
}

export type ShareCardSocial = {
  stats: { like_count: number; comment_count: number };
  reaction: "like" | null;
};

/**
 * Like and comment counts for one share card, plus the viewer's own reaction —
 * the card twin of fetchArticleSocial (lib/feed/repo.ts). card_social_stats
 * (migration 0031_share_card_social.sql) is a definer view, so the counts are
 * readable signed-out; cards with no activity have no stats row at all. Both
 * lookups degrade to zeroes rather than throwing if 0031 hasn't been applied.
 */
export async function fetchCardSocial(cardId: string, userId: string | null): Promise<ShareCardSocial> {
  const supabase = await createClient();
  const [{ data: stats }, { data: reaction }] = await Promise.all([
    supabase
      .from("card_social_stats")
      .select("like_count, comment_count")
      .eq("card_id", cardId)
      .maybeSingle(),
    userId
      ? supabase.from("card_reactions").select("kind").eq("user_id", userId).eq("card_id", cardId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    stats: {
      like_count: stats?.like_count ?? 0,
      comment_count: stats?.comment_count ?? 0,
    },
    reaction: reaction?.kind === "like" ? "like" : null,
  };
}
