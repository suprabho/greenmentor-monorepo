import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Chart data for vismay-format stories (migration 0020). One row per
 * (story, chart id); `data` is the ECharts-option JSON the core `chart`
 * module fetches via /api/chart-data/<storyId>/<chartId>. Deliberately a
 * separate table from community_stories so chart writes never bump the
 * story row's updated_at (the section-CAS token).
 */
export const STORY_CHARTS_TABLE = "community_story_charts";

export interface StoryChartRow {
  story_id: string;
  chart_id: string;
  data: unknown;
  updated_at: string;
}

export async function listStoryCharts(
  supabase: SupabaseClient,
  storyId: string
): Promise<StoryChartRow[]> {
  const { data, error } = await supabase
    .from(STORY_CHARTS_TABLE)
    .select("*")
    .eq("story_id", storyId)
    .order("chart_id");
  if (error) throw new Error(error.message);
  return (data as StoryChartRow[]) ?? [];
}

export async function getStoryChart(
  supabase: SupabaseClient,
  storyId: string,
  chartId: string
): Promise<StoryChartRow | null> {
  const { data, error } = await supabase
    .from(STORY_CHARTS_TABLE)
    .select("*")
    .eq("story_id", storyId)
    .eq("chart_id", chartId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as StoryChartRow | null) ?? null;
}

export async function upsertStoryChart(
  supabase: SupabaseClient,
  storyId: string,
  chartId: string,
  data: unknown
): Promise<void> {
  const { error } = await supabase
    .from(STORY_CHARTS_TABLE)
    .upsert({ story_id: storyId, chart_id: chartId, data }, { onConflict: "story_id,chart_id" });
  if (error) throw new Error(error.message);
}

export async function deleteStoryChart(
  supabase: SupabaseClient,
  storyId: string,
  chartId: string
): Promise<void> {
  const { error } = await supabase
    .from(STORY_CHARTS_TABLE)
    .delete()
    .eq("story_id", storyId)
    .eq("chart_id", chartId);
  if (error) throw new Error(error.message);
}
