-- Lets a Stories source be pulled from the Pipeline's already-ingested (and
-- AI-summarized) articles, instead of only a manually pasted link/text.
--
-- Apply via the Supabase SQL Editor (runs as the privileged role) or psql.

alter table public.story_sources
  drop constraint if exists story_sources_kind_check;

alter table public.story_sources
  add constraint story_sources_kind_check check (kind in ('link', 'text', 'pipeline'));
