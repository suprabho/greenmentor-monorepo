import type { SupabaseClient } from "@supabase/supabase-js";
import type { RecapCategoryId } from "../recaps/framework";

/**
 * Weekly ESG recaps — AI-generated multi-topic digests that seed the Stories
 * compose flow. `community_recaps` has RLS enabled with no policies (see
 * migration 0023), so every call here expects the service-role client —
 * callers must already be past the requireAdmin() gate.
 */
export const RECAPS_TABLE = "community_recaps";

/** A topic's grounding source, RESOLVED (real title/url) at generation time. */
export type RecapSourceRef =
  | { type: "article"; id: string; title: string; url: string }
  | { type: "url"; url: string; title: string };

export interface RecapTopic {
  /** "t1".."tN", assigned in code after generation. */
  id: string;
  title: string;
  category: RecapCategoryId;
  /** 2-3 sentence thesis of what happened and why it matters. */
  summary: string;
  keyFacts: string[];
  sourceRefs: RecapSourceRef[];
}

export interface RecapRow {
  id: string;
  title: string;
  period_start: string;
  period_end: string;
  markdown: string;
  topics: RecapTopic[];
  curated_urls: { url: string; title: string }[];
  article_ids: string[];
  model: string | null;
  status: "complete" | "failed";
  error: string | null;
  generated_at: string;
  created_by: string | null;
  created_at: string;
}

/** List columns only — `markdown` is big and the list is a picker. */
export type RecapListRow = Omit<RecapRow, "markdown">;

const LIST_SELECT =
  "id, title, period_start, period_end, topics, curated_urls, article_ids, model, status, error, generated_at, created_by, created_at";

export async function listRecaps(
  supabase: SupabaseClient,
  opts: { limit?: number } = {}
): Promise<RecapListRow[]> {
  const { data, error } = await supabase
    .from(RECAPS_TABLE)
    .select(LIST_SELECT)
    .order("generated_at", { ascending: false })
    .limit(opts.limit ?? 30);
  if (error) throw new Error(error.message);
  return (data as RecapListRow[]) ?? [];
}

export async function getRecap(supabase: SupabaseClient, id: string): Promise<RecapRow | null> {
  const { data, error } = await supabase.from(RECAPS_TABLE).select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as RecapRow | null) ?? null;
}

export async function insertRecap(
  supabase: SupabaseClient,
  input: {
    title: string;
    period_start: string;
    period_end: string;
    markdown: string;
    topics: RecapTopic[];
    curated_urls: { url: string; title: string }[];
    article_ids: string[];
    model?: string | null;
    created_by?: string | null;
  }
): Promise<RecapRow> {
  const { data, error } = await supabase.from(RECAPS_TABLE).insert(input).select("*").single();
  if (error) throw new Error(error.message);
  return data as RecapRow;
}

export async function deleteRecap(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from(RECAPS_TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}
