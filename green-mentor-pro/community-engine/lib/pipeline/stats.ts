import { createClient } from "@/lib/supabase/server";

/**
 * Ingest-pipeline health for the admin Pipeline tab: article quality counts,
 * freshness, per-source quality, 14-day ingest volume, entity counts by kind,
 * and the most-tagged entities. Reads the same `articles` / `entities` /
 * `article_entities` tables the platform feed uses (public-read under RLS).
 *
 * Adapted from vismay's `fetchFootshortsPipelineStats`; the ESG schema has no
 * `status` column, so "summarized" means `summary` is present and there is no
 * failed/pending split.
 */

export interface SourceStat {
  source: string;
  total: number;
  summarized: number;
  withImage: number;
  withTags: number;
}

export interface PipelineDayPoint {
  /** YYYY-MM-DD (UTC). */
  day: string;
  count: number;
}

export interface PipelineTopEntity {
  entity_id: string;
  name: string;
  kind: string;
  article_count: number;
}

export interface PipelineStats {
  articles: {
    total: number;
    summarized: number;
    withImage: number;
    withTags: number;
  };
  entities: {
    frameworks: number;
    topics: number;
    regions: number;
    companies: number;
  };
  freshness: {
    latestIngestedAt: string | null;
    minutesSinceLatest: number | null;
  };
  bySource: SourceStat[];
  byDay: PipelineDayPoint[];
  topEntities: PipelineTopEntity[];
}

/** Newest-first article cap for the stats scan — plenty for a daily feed. */
const STATS_ARTICLE_CAP = 2000;

const dayKey = (iso: string): string => iso.slice(0, 10);

export async function fetchPipelineStats(): Promise<PipelineStats> {
  const supabase = await createClient();

  const [articlesRes, entitiesRes, linksRes, totalRes] = await Promise.all([
    supabase
      .from("articles")
      .select("id, source, summary, image_url, created_at")
      .order("created_at", { ascending: false })
      .limit(STATS_ARTICLE_CAP),
    supabase.from("entities").select("id, name, kind"),
    supabase.from("article_entities").select("article_id, entity_id"),
    supabase.from("articles").select("id", { count: "exact", head: true }),
  ]);

  if (articlesRes.error) throw articlesRes.error;
  if (entitiesRes.error) throw entitiesRes.error;
  if (linksRes.error) throw linksRes.error;

  type ArticleRow = {
    id: string;
    source: string;
    summary: string | null;
    image_url: string | null;
    created_at: string;
  };
  type EntityRow = { id: string; name: string; kind: string };

  const articles = (articlesRes.data ?? []) as ArticleRow[];
  const entities = (entitiesRes.data ?? []) as EntityRow[];
  const links = (linksRes.data ?? []) as { article_id: string; entity_id: string }[];

  const taggedArticleIds = new Set(links.map((r) => r.article_id));

  const totals = {
    total: totalRes.count ?? articles.length,
    summarized: 0,
    withImage: 0,
    withTags: 0,
  };
  for (const a of articles) {
    if (a.summary) totals.summarized++;
    if (a.image_url) totals.withImage++;
    if (taggedArticleIds.has(a.id)) totals.withTags++;
  }

  const ent = { frameworks: 0, topics: 0, regions: 0, companies: 0 };
  for (const e of entities) {
    if (e.kind === "framework") ent.frameworks++;
    else if (e.kind === "topic") ent.topics++;
    else if (e.kind === "region") ent.regions++;
    else if (e.kind === "company") ent.companies++;
  }

  const latest = articles[0]?.created_at ?? null;
  const minutesSinceLatest = latest
    ? Math.floor((Date.now() - new Date(latest).getTime()) / 60_000)
    : null;

  const srcMap = new Map<string, SourceStat>();
  for (const a of articles) {
    let s = srcMap.get(a.source);
    if (!s) {
      s = { source: a.source, total: 0, summarized: 0, withImage: 0, withTags: 0 };
      srcMap.set(a.source, s);
    }
    s.total++;
    if (a.summary) s.summarized++;
    if (a.image_url) s.withImage++;
    if (taggedArticleIds.has(a.id)) s.withTags++;
  }
  const bySource = Array.from(srcMap.values()).sort((a, b) => b.total - a.total);

  const dayMap = new Map<string, number>();
  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
  for (const a of articles) {
    if (new Date(a.created_at).getTime() < cutoff) continue;
    dayMap.set(dayKey(a.created_at), (dayMap.get(dayKey(a.created_at)) ?? 0) + 1);
  }
  const byDay: PipelineDayPoint[] = [];
  for (let i = 13; i >= 0; i--) {
    const k = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    byDay.push({ day: k, count: dayMap.get(k) ?? 0 });
  }

  const entById = new Map(entities.map((e) => [e.id, e]));
  const entityCount = new Map<string, number>();
  for (const r of links) {
    entityCount.set(r.entity_id, (entityCount.get(r.entity_id) ?? 0) + 1);
  }
  const topEntities: PipelineTopEntity[] = Array.from(entityCount.entries())
    .map(([id, count]) => {
      const e = entById.get(id);
      if (!e) return null;
      return { entity_id: id, name: e.name, kind: e.kind, article_count: count };
    })
    .filter((x): x is PipelineTopEntity => x !== null)
    .sort((a, b) => b.article_count - a.article_count)
    .slice(0, 12);

  return {
    articles: totals,
    entities: ent,
    freshness: { latestIngestedAt: latest, minutesSinceLatest },
    bySource,
    byDay,
    topEntities,
  };
}
