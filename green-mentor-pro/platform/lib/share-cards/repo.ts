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

/** CSS aspect-ratio ("4 / 5") for a card's ratio string, so the gallery can
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
