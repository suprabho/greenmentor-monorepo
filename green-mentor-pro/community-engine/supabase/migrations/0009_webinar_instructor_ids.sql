-- Switch community_webinars from free-text instructor names to id references
-- into community_instructors (migration 0008). Rename-safe: names/photos now
-- resolve live from the roster, so editing an instructor updates every webinar.
--
-- Apply after 0008 (needs the roster to backfill against).

alter table public.community_webinars
  add column if not exists instructor_ids uuid[] not null default '{}';

-- Backfill from the legacy `instructors` names, preserving order, by matching
-- community_instructors.name case-insensitively. Names with no roster match are
-- dropped (best-effort) — re-select them in the admin picker afterwards.
update public.community_webinars w
set instructor_ids = coalesce((
  select array_agg(ci.id order by n.ord)
  from unnest(w.instructors) with ordinality as n(name, ord)
  join public.community_instructors ci on lower(ci.name) = lower(n.name)
), '{}')
where array_length(w.instructors, 1) is not null;

-- Rebuild the publish view to expose instructor_ids instead of the names.
-- SECURITY DEFINER (default) so it reads past the table's RLS; still exposes
-- only the safe columns of published/completed rows — never the funnel metrics.
drop view if exists public.webinars_public;
create or replace view public.webinars_public as
  select id, title, hook, instructor_ids, scheduled_at, duration_minutes,
         registration_url, cover_image_url, status
  from public.community_webinars
  where status in ('published', 'completed');

grant select on public.webinars_public to anon, authenticated;

-- Drop the legacy names column now that instructor_ids is the source of truth.
alter table public.community_webinars drop column if exists instructors;
