import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The community team's content pieces (webinars, newsletters, posts, social),
 * tracked from draft through publish. `community_stories` has RLS enabled
 * with no policies (see migration 0004), so every call here expects the
 * service-role client — callers must already be past the requireAdmin() gate.
 */
export const STORIES_TABLE = "community_stories";

export type StoryContentType = "webinar" | "newsletter" | "post" | "social";
export type StoryStatus = "draft" | "review" | "published" | "archived";

export interface StoryRow {
  id: string;
  title: string;
  content_type: StoryContentType;
  status: StoryStatus;
  owner_id: string | null;
  target_publish_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export async function listStories(supabase: SupabaseClient): Promise<StoryRow[]> {
  const { data, error } = await supabase
    .from(STORIES_TABLE)
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as StoryRow[]) ?? [];
}

export async function insertStory(
  supabase: SupabaseClient,
  input: {
    title: string;
    content_type: StoryContentType;
    owner_id?: string | null;
    target_publish_date?: string | null;
    notes?: string | null;
  }
): Promise<StoryRow> {
  const { data, error } = await supabase.from(STORIES_TABLE).insert(input).select("*").single();
  if (error) throw new Error(error.message);
  return data as StoryRow;
}

export async function updateStory(
  supabase: SupabaseClient,
  id: string,
  input: Partial<
    Pick<StoryRow, "title" | "content_type" | "status" | "target_publish_date" | "notes">
  >
): Promise<void> {
  const { error } = await supabase.from(STORIES_TABLE).update(input).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteStory(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from(STORIES_TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}
