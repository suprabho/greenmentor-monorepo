-- Region tag on feed articles, so the news feed can lead with Indian coverage.
--
-- The value is written by the RSS worker straight from the source config
-- (lib/feed-sources.ts), not inferred from the article text — entity tagging is
-- LLM-driven and too soft to order the feed on. One source = one region.
--
-- Existing rows default to 'global', which is correct: everything ingested
-- before this migration came from ESG Today, edie and Carbon Brief.
--
-- Apply this BEFORE deploying the code that reads it. lib/feed/repo.ts selects
-- `region` as part of ARTICLE_COLUMNS, and PostgREST 400s the whole query on an
-- unknown column — the feed would go blank rather than degrade.
--
-- Apply via the Supabase SQL Editor (runs as the privileged role) or psql.

alter table public.articles
  add column if not exists region text not null default 'global';

do $$
begin
  alter table public.articles
    add constraint articles_region_check check (region in ('india', 'global'));
exception
  when duplicate_object then null;
end;
$$;

-- Ordering is "region-boosted recency" (lib/feed/rank.ts): the list page pulls
-- the most recent N and re-sorts in memory, so this index serves the fetch.
create index if not exists articles_region_published_idx
  on public.articles (region, published_at desc nulls last);
