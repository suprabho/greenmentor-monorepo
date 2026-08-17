import { createClient } from "@/lib/supabase/server";
import { parseShareParam, pickCanonical, shareSlug } from "@/lib/share/slug";

// Scrollytelling stories are composed in the community-engine Stories hub and
// published to learners through the stories_public view
// (community_story_publications, RLS with no policies) — the same
// authoring→publish boundary as lib/jobs/repo.ts / lib/share-cards/repo.ts.
// Unlike share cards (a PNG snapshot), a story publication snapshots the
// DOCUMENT (markdown + config text + charts) and this app re-renders it live
// through the vismay engine. All reads go through the RLS-bound server client.

export interface PublishedStorySummary {
  id: string;
  storyId: string;
  /** Canonical URL segment, `{slug}-{idPrefix}`. Use storyHref() to build a path. */
  shareSlug: string;
  slug: string | null;
  title: string;
  subtitle: string | null;
  byline: string | null;
  coverImageUrl: string | null;
  publishedAt: string;
}

export interface PublishedStory extends PublishedStorySummary {
  format: "map" | "deck";
  markdown: string;
  configJson: string;
  configFormat: "yaml" | "json";
  charts: Record<string, unknown>;
}

const SUMMARY_COLUMNS = "id, story_id, slug, id_prefix, title, subtitle, byline, cover_image_url, published_at";
const FULL_COLUMNS = `${SUMMARY_COLUMNS}, format, markdown, config_json, config_format, charts`;

interface RowRaw {
  id: string;
  story_id: string;
  slug: string | null;
  id_prefix: string | null;
  title: string;
  subtitle: string | null;
  byline: string | null;
  cover_image_url: string | null;
  published_at: string;
  format?: "map" | "deck";
  markdown?: string;
  config_json?: string;
  config_format?: "yaml" | "json";
  charts?: Record<string, unknown>;
}

function mapSummary(row: RowRaw): PublishedStorySummary {
  return {
    id: row.id,
    storyId: row.story_id,
    shareSlug: shareSlug(row.slug, row.id),
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    byline: row.byline,
    coverImageUrl: row.cover_image_url,
    publishedAt: row.published_at,
  };
}

function mapFull(row: RowRaw): PublishedStory {
  return {
    ...mapSummary(row),
    format: row.format === "map" ? "map" : "deck",
    markdown: row.markdown ?? "",
    configJson: row.config_json ?? "",
    configFormat: row.config_format === "yaml" ? "yaml" : "json",
    charts: row.charts ?? {},
  };
}

export function storyHref(story: Pick<PublishedStorySummary, "shareSlug">): string {
  return `/stories/${story.shareSlug}`;
}

/** Newest-first list for the index. Tolerant of an unapplied migration —
 *  a missing view degrades to an empty shelf, not a 500. */
export async function fetchStories(): Promise<PublishedStorySummary[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("stories_public")
      .select(SUMMARY_COLUMNS)
      .order("published_at", { ascending: false });
    if (error) return [];
    return ((data as RowRaw[] | null) ?? []).map(mapSummary);
  } catch {
    return [];
  }
}

/**
 * Resolve a /stories/[slug] param to the full publication. Same contract as
 * resolveJob(): accepts the canonical `{slug}-{idPrefix}` or a bare
 * publication uuid; the page redirects non-canonical hits.
 */
export async function resolveStory(param: string): Promise<PublishedStory | null> {
  const parsed = parseShareParam(param);
  if (!parsed) return null;
  try {
    const supabase = await createClient();
    if (parsed.kind === "uuid") {
      const { data, error } = await supabase
        .from("stories_public")
        .select(FULL_COLUMNS)
        .eq("id", parsed.id)
        .maybeSingle();
      if (error || !data) return null;
      return mapFull(data as RowRaw);
    }
    const { data, error } = await supabase
      .from("stories_public")
      .select(FULL_COLUMNS)
      .eq("id_prefix", parsed.idPrefix);
    if (error) return null;
    const row = pickCanonical((data as RowRaw[] | null) ?? [], parsed.slug);
    return row ? mapFull(row) : null;
  } catch {
    return null;
  }
}
