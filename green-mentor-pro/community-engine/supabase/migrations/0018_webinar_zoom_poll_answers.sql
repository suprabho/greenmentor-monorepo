-- Zoom-native poll results, synced from the Zoom API after a session ends.
--
-- The live poll experience runs on Zoom itself: the host launches the
-- meeting's polls from the Zoom client and attendees answer inside the
-- embedded player (the Meeting SDK component view supports participant
-- voting). Zoom exposes who answered what only AFTER the meeting ends, via
-- GET /past_meetings/{meetingNumber}/polls — the Webinars panel pulls that
-- with its "Sync from Zoom" button and stores the flattened answers here.
--
-- One row per (respondent, question). A re-sync replaces the webinar's rows
-- wholesale — Zoom is the source of truth. matched_user_id is a best-effort
-- resolution of the respondent's email back to a platform account via this
-- webinar's attendance and RSVP rows, computed at sync time.
--
-- Same trust model as webinar_attendance: RLS enabled, NO policies, so only
-- the service-role client (already behind requireAdmin()) reads/writes it.
--
-- Apply via the Supabase SQL Editor (runs as the privileged role) or psql.

create table if not exists public.webinar_zoom_poll_answers (
  id                uuid        primary key default gen_random_uuid(),
  webinar_id        uuid        not null references public.community_webinars (id) on delete cascade,
  respondent_name   text,
  respondent_email  text,
  matched_user_id   uuid        references auth.users (id) on delete set null,
  question          text        not null,
  answer            text        not null,
  answered_at       timestamptz,          -- Zoom's per-answer timestamp, when it sends one
  synced_at         timestamptz not null default now()
);

create index if not exists webinar_zoom_poll_answers_webinar_id_idx
  on public.webinar_zoom_poll_answers (webinar_id);

alter table public.webinar_zoom_poll_answers enable row level security;
