import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Published scrollytelling stories (migration 0021). One row per story;
 * republishing upserts in place (stable story_id keeps the platform URL's
 * id_prefix constant). The platform reads the stories_public view; this
 * module is the CE-side service-role writer.
 */
export const STORY_PUBLICATIONS_TABLE = "community_story_publications";

export interface StoryPublicationRow {
  id: string;
  story_id: string;
  slug: string | null;
  id_prefix: string | null;
  title: string;
  subtitle: string | null;
  byline: string | null;
  format: "map" | "deck";
  cover_image_url: string | null;
  markdown: string;
  config_json: string;
  config_format: "yaml" | "json";
  charts: Record<string, unknown>;
  published_by: string | null;
  published_at: string;
  updated_at: string;
}

export async function getStoryPublication(
  supabase: SupabaseClient,
  storyId: string
): Promise<StoryPublicationRow | null> {
  const { data, error } = await supabase
    .from(STORY_PUBLICATIONS_TABLE)
    .select("*")
    .eq("story_id", storyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as StoryPublicationRow | null) ?? null;
}

export async function upsertStoryPublication(
  supabase: SupabaseClient,
  input: {
    story_id: string;
    title: string;
    subtitle?: string | null;
    byline?: string | null;
    format?: "map" | "deck";
    markdown: string;
    config_json: string;
    charts: Record<string, unknown>;
    published_by?: string | null;
  }
): Promise<StoryPublicationRow> {
  const { data, error } = await supabase
    .from(STORY_PUBLICATIONS_TABLE)
    .upsert({ ...input, published_at: new Date().toISOString() }, { onConflict: "story_id" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as StoryPublicationRow;
}

export async function deleteStoryPublication(
  supabase: SupabaseClient,
  storyId: string
): Promise<void> {
  const { error } = await supabase
    .from(STORY_PUBLICATIONS_TABLE)
    .delete()
    .eq("story_id", storyId);
  if (error) throw new Error(error.message);
}
