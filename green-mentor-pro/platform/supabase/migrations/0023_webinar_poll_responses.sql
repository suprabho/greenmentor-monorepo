-- webinar_poll_responses — a signed-in learner's answer to a webinar poll.
-- The polls themselves live in webinar_polls / webinar_poll_options
-- (community-engine migration 0016 — apply that first; this table references
-- them). One answer per user per poll (PK), re-vote via upsert. Follows the
-- same "own rows" RLS pattern as webinar_rsvps (0010) / reactions (0003_feed).
--
-- Aggregate results are exposed through the webinar_poll_results view below:
-- the "own rows" policy means a client can only read its own response, so a
-- SECURITY DEFINER view is the mechanism that lets attendees see vote counts
-- without seeing who voted.

create table if not exists public.webinar_poll_responses (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  poll_id    uuid        not null references public.webinar_polls (id) on delete cascade,
  option_id  uuid        not null references public.webinar_poll_options (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, poll_id)
);

create index if not exists webinar_poll_responses_poll_idx on public.webinar_poll_responses (poll_id);

alter table public.webinar_poll_responses enable row level security;

drop policy if exists "webinar_poll_responses own" on public.webinar_poll_responses;
create policy "webinar_poll_responses own" on public.webinar_poll_responses for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Aggregate vote counts per option, readable by any signed-in learner.
-- SECURITY DEFINER (Postgres default; do NOT set security_invoker) so it reads
-- past the "own rows" policy and returns totals — never individual rows / voter
-- identity.
create or replace view public.webinar_poll_results as
  select poll_id, option_id, count(*)::int as votes
  from public.webinar_poll_responses
  group by poll_id, option_id;

grant select on public.webinar_poll_results to authenticated;
