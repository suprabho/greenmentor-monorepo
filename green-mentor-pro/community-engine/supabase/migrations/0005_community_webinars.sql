-- community_webinars — the Academy's live webinar programme: scheduling and
-- publishing fields plus the post-webinar sales-funnel metrics the team
-- previously tracked in the "Webinar Tracker" spreadsheet.
--
-- Like community_stories, this is admin-hub data: the `/webinars` page and
-- its API routes are gated by requireAdmin() and read exclusively through
-- the service-role client (lib/supabase/admin.ts). RLS is enabled with no
-- policies, so the anon/authenticated roles get zero rows from the table.
--
-- Publishing to the learner platform happens through the `webinars_public`
-- view below, which exposes only the safe columns of published/completed
-- rows — never the revenue/funnel metrics.
--
-- Apply via the Supabase SQL Editor (runs as the privileged role) or psql.

create table if not exists public.community_webinars (
  id               uuid        primary key default gen_random_uuid(),
  title            text        not null,  -- short topic, e.g. "GHG Lead Verifier #2"
  hook             text,                  -- marketing headline shown to learners
  instructors      text[]      not null default '{}',
  scheduled_at     timestamptz,           -- nullable while draft
  duration_minutes integer,
  registration_url text,                  -- learner-facing register/join link
  creatives_url    text,                  -- Drive folder; admin-only, NOT in the view
  cover_image_url  text,
  status           text        not null default 'draft'
                     check (status in ('draft', 'published', 'completed', 'archived')),
  -- Post-webinar metrics, nullable until entered. Admin-only: none of these
  -- appear in webinars_public. Money is whole rupees.
  registrations      integer check (registrations >= 0),
  attendees          integer check (attendees >= 0),
  interest_shown     integer check (interest_shown >= 0),
  unique_attendees   integer check (unique_attendees >= 0),
  sales_calls_booked integer check (sales_calls_booked >= 0),
  buyers             integer check (buyers >= 0),
  avg_ticket_inr     bigint  check (avg_ticket_inr >= 0),
  revenue_inr        bigint  check (revenue_inr >= 0),
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists community_webinars_status_idx on public.community_webinars (status);
create index if not exists community_webinars_scheduled_at_idx on public.community_webinars (scheduled_at);

-- Touch updated_at on every update.
create or replace function public.community_webinars_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists community_webinars_updated_at on public.community_webinars;
create trigger community_webinars_updated_at
  before update on public.community_webinars
  for each row execute function public.community_webinars_set_updated_at();

-- Row-Level Security — enabled, no policies: only the service-role client
-- (already gated by requireAdmin() at the call site) can read or write.
alter table public.community_webinars enable row level security;

-- Publish surface for the learner platform. Deliberately a SECURITY DEFINER
-- view (Postgres default; do NOT set security_invoker) so it can read past
-- the table's RLS — that is the mechanism. It exposes only the safe columns
-- of published/completed webinars; RLS policies are row-level, not
-- column-level, so a plain read policy on the table would leak the funnel
-- metrics to the anon key via PostgREST. The Supabase linter flags definer
-- views as an advisory — intentional here.
create or replace view public.webinars_public as
  select id, title, hook, instructors, scheduled_at, duration_minutes,
         registration_url, cover_image_url, status
  from public.community_webinars
  where status in ('published', 'completed');

grant select on public.webinars_public to anon, authenticated;
