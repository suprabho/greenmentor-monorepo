-- Lets a Stories source be an attached weekly recap (community_recaps row),
-- so the compose flow can show a topic picker and steer angles from it.
-- Mirrors 0014, which added 'pipeline' the same way.
--
-- Apply via the Supabase SQL Editor (runs as the privileged role) or psql.

alter table public.story_sources
  drop constraint if exists story_sources_kind_check;

alter table public.story_sources
  add constraint story_sources_kind_check check (kind in ('link', 'text', 'pipeline', 'recap'));
