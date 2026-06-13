import type { SupabaseClient } from "@supabase/supabase-js";
import type { HeaderConfig } from "@/lib/header/types";

/**
 * Saved header configs. One Supabase table, namespaced in `public` so it works
 * with supabase-js out of the box and stays clear of efdb's own schema.
 * Access is enforced by RLS: owners manage their own rows; every signed-in user
 * can read rows marked `shared`.
 */
export const HEADERS_TABLE = "community_headers";

export type Visibility = "personal" | "shared";

export interface SavedHeaderRow {
  id: string;
  user_id: string;
  title: string;
  config: HeaderConfig;
  visibility: Visibility;
  created_at: string;
  updated_at: string;
}

export async function insertHeader(
  supabase: SupabaseClient,
  input: { title: string; config: HeaderConfig; visibility: Visibility }
): Promise<SavedHeaderRow> {
  // user_id defaults to auth.uid() in the DB, so we don't set it here.
  const { data, error } = await supabase
    .from(HEADERS_TABLE)
    .insert({ title: input.title, config: input.config, visibility: input.visibility })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as SavedHeaderRow;
}

export async function updateHeader(
  supabase: SupabaseClient,
  id: string,
  input: { title?: string; config?: HeaderConfig; visibility?: Visibility }
): Promise<void> {
  const { error } = await supabase.from(HEADERS_TABLE).update(input).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteHeader(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from(HEADERS_TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getHeader(
  supabase: SupabaseClient,
  id: string
): Promise<SavedHeaderRow | null> {
  const { data, error } = await supabase
    .from(HEADERS_TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SavedHeaderRow) ?? null;
}

/** Everything this user owns (any visibility), newest first. */
export async function listMine(
  supabase: SupabaseClient,
  userId: string
): Promise<SavedHeaderRow[]> {
  const { data, error } = await supabase
    .from(HEADERS_TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as SavedHeaderRow[]) ?? [];
}

/** Headers other people have shared with the team, newest first. */
export async function listSharedByOthers(
  supabase: SupabaseClient,
  userId: string
): Promise<SavedHeaderRow[]> {
  const { data, error } = await supabase
    .from(HEADERS_TABLE)
    .select("*")
    .eq("visibility", "shared")
    .neq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as SavedHeaderRow[]) ?? [];
}
