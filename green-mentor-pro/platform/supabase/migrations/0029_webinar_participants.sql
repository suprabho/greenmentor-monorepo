-- Webinar participants — who RSVP'd, who actually turned up, and how to reach
-- them. Until now webinar_rsvps (migration 0010) stored nothing but
-- (user_id, webinar_id), and attendance existed only as integers an admin typed
-- into community_webinars.attendees. The community-engine admin hub needs names,
-- emails and phone numbers for both lists.
--
-- Apply after 0025_profile_details.sql: phone lives on profiles already (E.164
-- + phone_country, collected during onboarding) and this reuses both that shape
-- and the public.set_updated_at() trigger function 0025 defines.
--
-- Two parts:
--   1. A contact snapshot on webinar_rsvps. Snapshot, not a join: the number a
--      learner gave for a specific webinar is the number the team should call
--      about it, even if they change it on their profile afterwards.
--   2. webinar_attendance — one row per (webinar, person), fed by two sources
--      that converge on the same row: an in-app join through the Zoom embed
--      (platform, via record_webinar_join) and the Zoom participant report an
--      admin uploads afterwards (community-engine import). Booleans record which
--      sources saw them, so "joined in the platform" and "was in Zoom's report"
--      stay distinguishable.

-- ── 1. RSVP contact snapshot ────────────────────────────────────────────────
-- phone matches profiles.phone: E.164-joined ("+919876543210"), with the ISO
-- alpha-2 that produced the dial code kept alongside.

alter table public.webinar_rsvps
  add column if not exists full_name     text,
  add column if not exists email         text,
  add column if not exists phone         text,
  add column if not exists phone_country text,
  add column if not exists updated_at    timestamptz not null default now();

comment on column public.webinar_rsvps.phone is 'E.164 phone as given for this webinar, dial code + national number';
comment on column public.webinar_rsvps.phone_country is 'ISO-3166 alpha-2 backing the dial code';

-- Backfill what we can for RSVPs made before the form existed, so the admin
-- lists aren't half empty on day one. Learners who onboarded after 0025 already
-- have a phone on their profile; the rest stay null until they RSVP again.
update public.webinar_rsvps r
set full_name     = coalesce(r.full_name, p.display_name, u.raw_user_meta_data ->> 'full_name'),
    email         = coalesce(r.email, u.email),
    phone         = coalesce(r.phone, p.phone),
    phone_country = coalesce(r.phone_country, p.phone_country)
from auth.users u
  left join public.profiles p on p.id = u.id
where u.id = r.user_id
  and (r.full_name is null or r.email is null or r.phone is null);

-- Reuses the shared trigger function from 0025 rather than defining another.
drop trigger if exists webinar_rsvps_set_updated_at on public.webinar_rsvps;
create trigger webinar_rsvps_set_updated_at
  before update on public.webinar_rsvps
  for each row execute function public.set_updated_at();

-- ── 2. Attendance ───────────────────────────────────────────────────────────
-- participant_key is the identity we de-duplicate on within a webinar: the
-- user's id when we know them, otherwise their lowercased email (a Zoom-report
-- guest who never signed in). The CSV importer resolves emails to user_ids
-- before writing, so a learner who joined in-app *and* appears in the report
-- lands on one row rather than two.

create table if not exists public.webinar_attendance (
  webinar_id            uuid not null references public.community_webinars (id) on delete cascade,
  participant_key       text not null,
  user_id               uuid references auth.users (id) on delete set null,
  full_name             text,
  email                 text,
  phone                 text,
  -- Which sources have seen this person.
  joined_in_app         boolean not null default false,
  in_zoom_report        boolean not null default false,
  first_joined_at       timestamptz,
  last_seen_at          timestamptz,
  -- In-app joins only: how many times they opened the embedded player.
  join_count            integer not null default 0,
  -- From the Zoom report — authoritative watch time when available.
  zoom_duration_minutes integer,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  primary key (webinar_id, participant_key)
);

-- Resolving a Zoom-report email back to a known learner scans by email.
create index if not exists webinar_attendance_email_idx
  on public.webinar_attendance (webinar_id, lower(email));

drop trigger if exists webinar_attendance_set_updated_at on public.webinar_attendance;
create trigger webinar_attendance_set_updated_at
  before update on public.webinar_attendance
  for each row execute function public.set_updated_at();

-- Attendance is admin-only: RLS on with no policies, so anon/authenticated get
-- nothing and only the service-role client reads or writes it. Same shape as
-- community_webinars (community-engine 0005) — learners never need to see who
-- else was in the room.
alter table public.webinar_attendance enable row level security;

-- ── record_webinar_join ─────────────────────────────────────────────────────
-- Called by the platform's zoom-signature route with the service-role client
-- when a learner joins the embedded player, and by the heartbeat route while
-- they stay. One statement so the join_count increment can't race two tabs.
--
-- p_count_join distinguishes an actual join (bump the counter) from a heartbeat
-- (only move last_seen_at).
create or replace function public.record_webinar_join(
  p_webinar_id uuid,
  p_user_id    uuid,
  p_full_name  text default null,
  p_email      text default null,
  p_phone      text default null,
  p_count_join boolean default true
) returns void
language sql
as $$
  insert into public.webinar_attendance as a (
    webinar_id, participant_key, user_id, full_name, email, phone,
    joined_in_app, first_joined_at, last_seen_at, join_count
  )
  values (
    p_webinar_id, p_user_id::text, p_user_id, p_full_name, p_email, p_phone,
    true, now(), now(), case when p_count_join then 1 else 0 end
  )
  on conflict (webinar_id, participant_key) do update
  set joined_in_app   = true,
      last_seen_at    = now(),
      first_joined_at = coalesce(a.first_joined_at, now()),
      join_count      = a.join_count + case when p_count_join then 1 else 0 end,
      -- Never blank out details we already hold with a null from a later call.
      full_name       = coalesce(excluded.full_name, a.full_name),
      email           = coalesce(excluded.email, a.email),
      phone           = coalesce(excluded.phone, a.phone),
      user_id         = coalesce(a.user_id, excluded.user_id);
$$;

-- New functions are executable by `public` in Postgres by default. This one
-- takes the user_id it writes as an argument, so leaving that grant in place
-- would let any signed-in learner forge attendance for someone else. It runs as
-- the invoker (not security definer) — so RLS would block them anyway — but
-- revoking is the layer that states the intent.
revoke all on function public.record_webinar_join(uuid, uuid, text, text, text, boolean) from public;
revoke all on function public.record_webinar_join(uuid, uuid, text, text, text, boolean) from anon, authenticated;
grant execute on function public.record_webinar_join(uuid, uuid, text, text, text, boolean) to service_role;
