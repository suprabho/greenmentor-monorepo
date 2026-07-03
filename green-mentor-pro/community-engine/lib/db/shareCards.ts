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
