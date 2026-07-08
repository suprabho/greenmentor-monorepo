-- webinar_rsvps — one-click RSVP by signed-in learners to published webinars.
-- Webinars themselves live in community_webinars (community-engine migration
-- 0005 — apply that first; this table references it) and reach the platform
-- through the webinars_public view. RSVPs follow the follows/reactions "own
-- rows" pattern from 0003_feed.sql; the community-engine admin panel reads
-- the counts through its service-role client.

create table if not exists public.webinar_rsvps (
  user_id    uuid not null references auth.users (id) on delete cascade,
  webinar_id uuid not null references public.community_webinars (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, webinar_id)
);

create index if not exists webinar_rsvps_webinar_idx on public.webinar_rsvps (webinar_id);

alter table public.webinar_rsvps enable row level security;

drop policy if exists "webinar_rsvps own" on public.webinar_rsvps;
create policy "webinar_rsvps own" on public.webinar_rsvps for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
