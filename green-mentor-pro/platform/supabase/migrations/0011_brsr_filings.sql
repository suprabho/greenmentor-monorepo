-- brsr_filings + brsr_indicators — the NSE BRSR filings archive. One filing row
-- per (symbol, financial year) scraped from NSE's corporate-filings index by
-- scripts/scrape-brsr.ts, which also archives each filing's XBRL into the
-- private `brsr-filings` bucket and extracts the curated BRSR Core indicators
-- (lib/brsr/tag-map.ts) into brsr_indicators.
--
-- Written only by the scrape worker through the service-role client
-- (lib/supabase/admin.ts). RLS is enabled with no policies, so the
-- anon/authenticated roles get zero rows from the tables themselves; the
-- worker's operational plumbing (attempt counts, error messages, storage paths)
-- never leaves the service role.
--
-- Publishing happens through the `brsr_filings_public` / `brsr_indicators_public`
-- views below — safe columns only, indicators only from successfully parsed
-- filings.
--
-- Apply to the shared Supabase project via the SQL Editor (runs as the
-- privileged role) or psql — both platform and community-engine point at it.

create table if not exists public.brsr_filings (
  id               uuid        primary key default gen_random_uuid(),
  symbol           text        not null,   -- NSE ticker, e.g. "RELIANCE"
  company_name     text        not null,
  fy_from          int         not null,   -- NSE sends bare years, e.g. 2025
  fy_to            int         not null,   -- e.g. 2026 (2025-26 FY); == fy_from for calendar-year filers
  submission_date  date,                   -- parsed from "10-Jul-2026"
  revision_date    date,                   -- null when NSE sends "-"
  pdf_url          text,                   -- nsearchives hotlink; PDFs are NOT mirrored (1-20MB each)
  pdf_size_bytes   bigint,
  xbrl_url         text,
  xbrl_size_bytes  bigint,
  raw              jsonb       not null,   -- verbatim NSE index item (audit / reparse insurance)
  -- stage 2 (XBRL archive) state
  xbrl_status        text        not null default 'pending'
                       check (xbrl_status in ('pending', 'stored', 'failed', 'skipped')),
  xbrl_storage_path  text,                 -- object key in the brsr-filings bucket
  xbrl_attempts      int         not null default 0,
  xbrl_error         text,
  xbrl_downloaded_at timestamptz,
  -- stage 3 (indicator extraction) state
  parse_status     text        not null default 'pending'
                     check (parse_status in ('pending', 'parsed', 'failed')),
  parse_error      text,
  parsed_at        timestamptz,
  indicator_count  int,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- Natural key: NSE emits one index row per company-FY, folding revisions in.
  -- Revisions therefore update in place (the worker resets the stage statuses
  -- when revision_date / xbrl_url change).
  unique (symbol, fy_from, fy_to)
);

create index if not exists brsr_filings_xbrl_status_idx on public.brsr_filings (xbrl_status);
create index if not exists brsr_filings_parse_status_idx on public.brsr_filings (parse_status);
create index if not exists brsr_filings_symbol_idx on public.brsr_filings (symbol);
create index if not exists brsr_filings_submission_date_idx on public.brsr_filings (submission_date desc);

-- Touch updated_at on every update.
create or replace function public.brsr_filings_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists brsr_filings_updated_at on public.brsr_filings;
create trigger brsr_filings_updated_at
  before update on public.brsr_filings
  for each row execute function public.brsr_filings_set_updated_at();

-- One row per extracted fact: a curated indicator key × reporting context
-- (current FY, previous FY, …) for a filing. Delete-then-insert per filing on
-- (re)parse, so no updated_at machinery needed.
create table if not exists public.brsr_indicators (
  id            uuid        primary key default gen_random_uuid(),
  filing_id     uuid        not null references public.brsr_filings (id) on delete cascade,
  indicator_key text        not null,   -- stable key from lib/brsr/tag-map.ts, e.g. "scope1_emissions_total"
  raw_tag       text        not null,   -- XBRL local name it matched, e.g. "TotalScope1Emissions"
  context_ref   text        not null,   -- XBRL contextRef, e.g. "DCYMain" (current FY)
  period_start  date,                   -- resolved from the context definition
  period_end    date,
  unit          text,                   -- XBRL unitRef, e.g. "MtCO2e", "GJ", "KL"
  value_numeric numeric     not null,
  created_at    timestamptz not null default now(),
  unique (filing_id, indicator_key, context_ref)
);

create index if not exists brsr_indicators_filing_idx on public.brsr_indicators (filing_id);
create index if not exists brsr_indicators_key_idx on public.brsr_indicators (indicator_key);

-- Row-Level Security — enabled, no policies: only the service-role client
-- (the scrape worker) can read or write the tables directly.
alter table public.brsr_filings enable row level security;
alter table public.brsr_indicators enable row level security;

-- Publish surfaces. Deliberately SECURITY DEFINER views (Postgres default; do
-- NOT set security_invoker) so they can read past the tables' RLS — that is
-- the mechanism, same as jobs_public. They expose only the safe columns:
-- filing metadata without the worker's error/attempt plumbing, and indicators
-- only from filings that parsed cleanly. The Supabase linter flags definer
-- views as an advisory — intentional here.
create or replace view public.brsr_filings_public as
  select id, symbol, company_name, fy_from, fy_to, submission_date,
         revision_date, pdf_url, xbrl_url, parse_status, indicator_count
  from public.brsr_filings;

create or replace view public.brsr_indicators_public as
  select f.symbol, f.company_name, f.fy_from, f.fy_to,
         i.indicator_key, i.value_numeric, i.unit,
         i.period_start, i.period_end, i.context_ref
  from public.brsr_indicators i
  join public.brsr_filings f on f.id = i.filing_id
  where f.parse_status = 'parsed';

grant select on public.brsr_filings_public to anon, authenticated;
grant select on public.brsr_indicators_public to anon, authenticated;

-- Private bucket for the archived XBRL instances (~700KB per filing). Only the
-- worker (service role) reads/writes it — unlike story-assets there is no
-- public-URL consumer, and keeping it private avoids running an open NSE
-- mirror. The worker also ensureBucket()s on startup, so a fresh project
-- self-heals even if this insert hasn't run.
insert into storage.buckets (id, name, public) values ('brsr-filings', 'brsr-filings', false)
  on conflict (id) do nothing;
