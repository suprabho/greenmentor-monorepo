-- Zoom join details on webinars + admin-authored live polls.
--
-- Two additions:
--   1. zoom_meeting_number / zoom_passcode on community_webinars — the Meeting
--      SDK join credentials for the embedded player on the learner platform.
--      These are deliberately NOT added to webinars_public: the platform hands
--      them out only through an authenticated signature route, never via the
--      public view / anon key.
--   2. webinar_polls + webinar_poll_options — static polls attached to a
--      webinar. Same trust model as community_webinars / story_sources: RLS
--      enabled, NO policies, so only the service-role client (already gated by
--      requireAdmin()) reads/writes the base tables. Learners read published
--      polls through the SECURITY DEFINER *_public views, and record their
--      answers in the platform-side webinar_poll_responses table (platform
--      migration 0023 — apply that after this).
--
-- Apply via the Supabase SQL Editor (runs as the privileged role) or psql.

-- 1. Zoom Meeting SDK join credentials (admin-only; not in webinars_public).
alter table public.community_webinars
  add column if not exists zoom_meeting_number text,
  add column if not exists zoom_passcode       text;

-- 2a. Polls — one question with a small set of options, attached to a webinar.
create table if not exists public.webinar_polls (
  id          uuid        primary key default gen_random_uuid(),
  webinar_id  uuid        not null references public.community_webinars (id) on delete cascade,
  question    text        not null,
  status      text        not null default 'draft'
                check (status in ('draft', 'published', 'closed')),
  position    integer     not null default 0,  -- display order within a webinar
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists webinar_polls_webinar_id_idx on public.webinar_polls (webinar_id);

create or replace function public.webinar_polls_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists webinar_polls_updated_at on public.webinar_polls;
create trigger webinar_polls_updated_at
  before update on public.webinar_polls
  for each row execute function public.webinar_polls_set_updated_at();

-- 2b. Options — ordered choices for a poll (insert-only; replaced wholesale on
-- edit, so no updated_at).
create table if not exists public.webinar_poll_options (
  id          uuid        primary key default gen_random_uuid(),
  poll_id     uuid        not null references public.webinar_polls (id) on delete cascade,
  label       text        not null,
  position    integer     not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists webinar_poll_options_poll_id_idx on public.webinar_poll_options (poll_id);

-- RLS — enabled, no policies: service-role only on the base tables.
alter table public.webinar_polls        enable row level security;
alter table public.webinar_poll_options enable row level security;

-- Learner-facing publish surfaces. SECURITY DEFINER (Postgres default; do NOT
-- set security_invoker) so they read past the tables' RLS — same mechanism as
-- webinars_public. Only published polls (and their options) are exposed.
create or replace view public.webinar_polls_public as
  select id, webinar_id, question, position
  from public.webinar_polls
  where status = 'published';

create or replace view public.webinar_poll_options_public as
  select o.id, o.poll_id, o.label, o.position
  from public.webinar_poll_options o
  join public.webinar_polls p on p.id = o.poll_id
  where p.status = 'published';

grant select on public.webinar_polls_public        to anon, authenticated;
grant select on public.webinar_poll_options_public to anon, authenticated;
