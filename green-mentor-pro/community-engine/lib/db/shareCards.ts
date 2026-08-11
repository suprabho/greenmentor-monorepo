import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShareCardSnapshotV1 } from "@/lib/share-cards/types";
import type { Visibility } from "./headers";

/**
 * Saved share-card configs — the community_share_cards table, a 1:1 mirror of
 * community_headers (see lib/db/headers.ts): owners manage their own rows, any
 * signed-in user can read rows marked `shared`. RLS enforces both.
 */
export const SHARE_CARDS_TABLE = "community_share_cards";

export interface SavedShareCardRow {
  id: string;
  user_id: string;
  title: string;
  config: ShareCardSnapshotV1;
  visibility: Visibility;
  created_at: string;
  updated_at: string;
}

export async function insertShareCard(
  supabase: SupabaseClient,
  input: { title: string; config: ShareCardSnapshotV1; visibility: Visibility }
): Promise<SavedShareCardRow> {
  // user_id defaults to auth.uid() in the DB, so we don't set it here.
  const { data, error } = await supabase
    .from(SHARE_CARDS_TABLE)
    .insert({ title: input.title, config: input.config, visibility: input.visibility })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as SavedShareCardRow;
}

export async function updateShareCard(
  supabase: SupabaseClient,
  id: string,
  input: { title?: string; config?: ShareCardSnapshotV1; visibility?: Visibility }
): Promise<void> {
  const { error } = await supabase.from(SHARE_CARDS_TABLE).update(input).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteShareCard(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from(SHARE_CARDS_TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getShareCard(
  supabase: SupabaseClient,
  id: string
): Promise<SavedShareCardRow | null> {
  const { data, error } = await supabase
    .from(SHARE_CARDS_TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SavedShareCardRow) ?? null;
}

/** Everything this user owns (any visibility), newest first. */
export async function listMineCards(
  supabase: SupabaseClient,
  userId: string
): Promise<SavedShareCardRow[]> {
  const { data, error } = await supabase
    .from(SHARE_CARDS_TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as SavedShareCardRow[]) ?? [];
}

// ── publications (publish-to-platform) ──────────────────────────────────────
//
// community_share_card_publications has RLS enabled with NO policies (see
// migration 0019), so the write/delete helpers expect the service-role client —
// callers must already be past the isAdmin() gate. Published state is readable
// by any signed-in client through the share_cards_public view (the same view
// the learner platform renders).

export const SHARE_CARD_PUBLICATIONS_TABLE = "community_share_card_publications";
export const SHARE_CARDS_PUBLIC_VIEW = "share_cards_public";

export interface ShareCardPublicationRow {
  id: string;
  card_id: string;
  title: string;
  caption: string | null;
  ratio: string;
  image_url: string;
  published_at: string;
}

/** Publish (or re-publish) a card — one live publication per card_id. */
export async function upsertShareCardPublication(
  admin: SupabaseClient,
  input: {
    card_id: string;
    title: string;
    caption?: string | null;
    ratio: string;
    image_url: string;
    published_by: string;
  }
): Promise<ShareCardPublicationRow> {
  const { data, error } = await admin
    .from(SHARE_CARD_PUBLICATIONS_TABLE)
    .upsert(
      {
        card_id: input.card_id,
        title: input.title,
        caption: input.caption ?? null,
        ratio: input.ratio,
        image_url: input.image_url,
        published_by: input.published_by,
        // Explicit so a re-publish bumps the stamp (the column default only
        // applies on insert) and the platform gallery sorts it back to the top.
        published_at: new Date().toISOString(),
      },
      { onConflict: "card_id" }
    )
    .select("id, card_id, title, caption, ratio, image_url, published_at")
    .single();
  if (error) throw new Error(error.message);
  return data as ShareCardPublicationRow;
}

export async function deleteShareCardPublication(
  admin: SupabaseClient,
  cardId: string
): Promise<void> {
  const { error } = await admin
    .from(SHARE_CARD_PUBLICATIONS_TABLE)
    .delete()
    .eq("card_id", cardId);
  if (error) throw new Error(error.message);
}

/** This card's live publication, if any — via the public view (any client). */
export async function getPublicationForCard(
  supabase: SupabaseClient,
  cardId: string
): Promise<ShareCardPublicationRow | null> {
  const { data, error } = await supabase
    .from(SHARE_CARDS_PUBLIC_VIEW)
    .select("id, card_id, title, caption, ratio, image_url, published_at")
    .eq("card_id", cardId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ShareCardPublicationRow) ?? null;
}

/** Which of these cards are published — via the public view (any client). */
export async function listPublishedCardIds(
  supabase: SupabaseClient,
  cardIds: string[]
): Promise<Set<string>> {
  if (cardIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from(SHARE_CARDS_PUBLIC_VIEW)
    .select("card_id")
    .in("card_id", cardIds);
  if (error) throw new Error(error.message);
  return new Set(((data ?? []) as Array<{ card_id: string }>).map((r) => r.card_id));
}

/** Cards other people have shared with the team, newest first. */
export async function listSharedCardsByOthers(
  supabase: SupabaseClient,
  userId: string
): Promise<SavedShareCardRow[]> {
  const { data, error } = await supabase
    .from(SHARE_CARDS_TABLE)
    .select("*")
    .eq("visibility", "shared")
    .neq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as SavedShareCardRow[]) ?? [];
}
