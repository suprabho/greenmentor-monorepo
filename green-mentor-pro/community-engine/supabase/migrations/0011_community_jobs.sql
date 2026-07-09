-- community_jobs — the ESG & sustainability jobs board CMS. Curated openings
-- (the "Greenmentor Daily Jobs" digests) authored in the admin hub and
-- published to the learner platform's /jobs board.
--
-- Like community_webinars, this is admin-hub data: the `/jobs` page and its API
-- routes are gated by requireAdmin() and read/write exclusively through the
-- service-role client (lib/supabase/admin.ts). RLS is enabled with no policies,
-- so the anon/authenticated roles get zero rows from the table itself.
--
-- Publishing to the learner platform happens through the `jobs_public` view
-- below, which exposes only the safe columns of published rows — never the
-- admin-only `notes`.
--
-- Apply via the Supabase SQL Editor (runs as the privileged role) or psql.

create table if not exists public.community_jobs (
  id                   uuid        primary key default gen_random_uuid(),
  title                text        not null,   -- role, e.g. "Sustainability & CSR Manager"
  company              text,                   -- nullable ("Confidential" / not specified)
  location             text,                   -- free text, e.g. "Pune, India"
  country              text,                   -- filter facet: India, UAE, Bangladesh, …
  employment_type      text        not null default 'Full-time',
  experience           text,                   -- raw, e.g. "3–5 years", "8+ years"
  seniority            text        check (seniority in ('entry', 'mid', 'senior', 'lead')),
  details              text,                   -- responsibilities / skills blurb
  tags                 text[]      not null default '{}',  -- skill chips (EPR, BRSR, LEED…)
  apply_url            text,                   -- external application link
  apply_email          text,                   -- email-only applications
  salary               text,                   -- optional / rare
  application_deadline date,                   -- optional / rare
  preferred            text,                   -- optional preferred qualifications
  posted_on            date,                   -- digest date; primary sort key
  notes                text,                   -- admin-only, NOT in the view
  status               text        not null default 'draft'
                         check (status in ('draft', 'published', 'archived')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists community_jobs_status_idx on public.community_jobs (status);
create index if not exists community_jobs_posted_on_idx on public.community_jobs (posted_on);
create index if not exists community_jobs_country_idx on public.community_jobs (country);

-- Touch updated_at on every update.
create or replace function public.community_jobs_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists community_jobs_updated_at on public.community_jobs;
create trigger community_jobs_updated_at
  before update on public.community_jobs
  for each row execute function public.community_jobs_set_updated_at();

-- Row-Level Security — enabled, no policies: only the service-role client
-- (already gated by requireAdmin() at the call site) can read or write.
alter table public.community_jobs enable row level security;

-- Publish surface for the learner platform. Deliberately a SECURITY DEFINER
-- view (Postgres default; do NOT set security_invoker) so it can read past the
-- table's RLS — that is the mechanism. It exposes only the safe columns of
-- published jobs; RLS policies are row-level, not column-level, so a plain read
-- policy on the table would leak the admin-only `notes` column to the anon key
-- via PostgREST. The Supabase linter flags definer views as an advisory —
-- intentional here.
create or replace view public.jobs_public as
  select id, title, company, location, country, employment_type, experience,
         seniority, details, tags, apply_url, apply_email, salary,
         application_deadline, preferred, posted_on, status
  from public.community_jobs
  where status = 'published';

grant select on public.jobs_public to anon, authenticated;
