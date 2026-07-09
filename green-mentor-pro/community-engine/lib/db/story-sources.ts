import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Link/pasted-text material an admin grounds a story's AI-assisted draft in.
 * `story_sources` has RLS enabled with no policies (see migration 0005), so
 * every call here expects the service-role client — callers must already be
 * past the requireAdmin() gate.
 */
export const STORY_SOURCES_TABLE = "story_sources";

export type StorySourceKind = "link" | "text" | "pipeline";
export type StorySourceStatus = "pending" | "extracted" | "failed";

export interface StorySourceRow {
  id: string;
  story_id: string;
  kind: StorySourceKind;
  title: string | null;
  url: string | null;
  extracted_text: string | null;
  status: StorySourceStatus;
  error: string | null;
  created_at: string;
}

export async function listStorySources(
  supabase: SupabaseClient,
  storyId: string
): Promise<StorySourceRow[]> {
  const { data, error } = await supabase
    .from(STORY_SOURCES_TABLE)
    .select("*")
    .eq("story_id", storyId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as StorySourceRow[]) ?? [];
}

export async function insertStorySource(
  supabase: SupabaseClient,
  input: {
    story_id: string;
    kind: StorySourceKind;
    title?: string | null;
    url?: string | null;
    extracted_text?: string | null;
    status: StorySourceStatus;
    error?: string | null;
  }
): Promise<StorySourceRow> {
  const { data, error } = await supabase
    .from(STORY_SOURCES_TABLE)
    .insert(input)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as StorySourceRow;
}

/** Scoped by both ids — the service-role client bypasses RLS entirely, so
 *  without this a mismatched (storyId, sourceId) pair in the URL could delete
 *  a source belonging to a different story. */
export async function deleteStorySource(
  supabase: SupabaseClient,
  storyId: string,
  sourceId: string
): Promise<void> {
  const { error } = await supabase
    .from(STORY_SOURCES_TABLE)
    .delete()
    .eq("id", sourceId)
    .eq("story_id", storyId);
  if (error) throw new Error(error.message);
}
