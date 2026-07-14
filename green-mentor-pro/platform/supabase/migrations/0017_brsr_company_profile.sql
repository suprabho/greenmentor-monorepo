-- brsr company profile + coverage scorecard — the identity/contact block and
-- turnover-weighted sector classification pulled from BRSR Section A, plus a
-- deterministic disclosure-coverage score, all extracted from the archived XBRL
-- by scrape-brsr.ts stage `profile` (deterministic; lib/brsr/xbrl.ts +
-- lib/brsr/nic-sector.ts + lib/brsr/scorecard.ts).
--
-- Written only by the scrape worker through the service-role client. Contact
-- fields come from public regulatory filings, so unlike the topics free-texts
-- they ARE published through the *_public views below.
--
-- Apply to the shared Supabase project via the SQL Editor or psql — after
-- 0012_brsr_material_topics.sql (the 0013-0016 energy migrations are unrelated).

-- stage `profile` state + extracted profile/sector/scorecard, on brsr_filings
-- alongside the xbrl_/parse_/topics_ columns from 0011-0012.
alter table public.brsr_filings
  -- Section A identity / contact block
  add column if not exists legal_name    text,   -- name as filed (may differ from NSE index company_name)
  add column if not exists cin           text,   -- Corporate Identity Number
  add column if not exists contact_email text,
  add column if not exists contact_phone text,   -- verbatim, not normalized (filers pack multiple numbers in)
  add column if not exists website       text,
  -- turnover-weighted NIC-2008 classification: sector = Section, industry = Division
  add column if not exists primary_section        text,   -- NIC Section letter A-U
  add column if not exists primary_section_title  text,
  add column if not exists super_sector           text,   -- ILO primary|secondary|tertiary
  add column if not exists primary_division        text,  -- NIC 2-digit Division code
  add column if not exists primary_division_title  text,
  add column if not exists sector_mapped_coverage numeric,  -- 0..1: turnover share whose NIC code resolved
  add column if not exists sector_shares          jsonb,   -- [{sectionLetter,sectionTitle,superSector,weight}]
  -- disclosure-coverage scorecard (deterministic, matched/total of BRSR Core keys)
  add column if not exists coverage_score int,             -- overall 0..100, flat for cheap sort/filter
  add column if not exists scorecard      jsonb,           -- {overall,byPillar,byCategory,missingKeys}
  -- stage state
  add column if not exists profile_status text not null default 'pending'
    check (profile_status in ('pending', 'extracted', 'failed')),
  add column if not exists profile_error text,
  add column if not exists profile_extracted_at timestamptz;

alter table public.brsr_filings
  drop constraint if exists brsr_filings_super_sector_check;
alter table public.brsr_filings
  add constraint brsr_filings_super_sector_check
    check (super_sector is null or super_sector in ('primary', 'secondary', 'tertiary'));

create index if not exists brsr_filings_profile_status_idx on public.brsr_filings (profile_status);
create index if not exists brsr_filings_primary_section_idx on public.brsr_filings (primary_section);
create index if not exists brsr_filings_coverage_score_idx on public.brsr_filings (coverage_score desc);

-- One row per product/service the filing reports in the "90% of turnover" table
-- (BRSR Section A). Delete-then-insert per filing on (re)profile, so no
-- updated_at machinery. division_code/section_letter are null when the reported
-- NIC code doesn't resolve onto NIC-2008.
create table if not exists public.brsr_company_activities (
  id            uuid    primary key default gen_random_uuid(),
  filing_id     uuid    not null references public.brsr_filings (id) on delete cascade,
  context_ref   text    not null,   -- XBRL context of the product row, e.g. "D_ProductServiceSold1"
  nic_code      text    not null,   -- as filed (digits only)
  product_name  text,
  turnover      numeric not null,   -- share of turnover as filed (fraction like 0.94, or a percent)
  division_code text,               -- resolved NIC Division (2-digit); null if unmapped
  section_letter text,              -- resolved NIC Section (A-U); null if unmapped
  super_sector  text,
  created_at    timestamptz not null default now(),
  unique (filing_id, context_ref)
);

create index if not exists brsr_company_activities_filing_idx on public.brsr_company_activities (filing_id);
create index if not exists brsr_company_activities_section_idx on public.brsr_company_activities (section_letter);

alter table public.brsr_company_activities enable row level security;

-- Republish brsr_filings_public with the new profile/sector/scorecard columns
-- (drop first: adding columns changes the view's output shape). Definer view,
-- same as 0011 — reads past RLS to expose safe columns only.
drop view if exists public.brsr_filings_public;
create view public.brsr_filings_public as
  select id, symbol, company_name, legal_name, cin, contact_email, contact_phone, website,
         fy_from, fy_to, submission_date, revision_date, pdf_url, xbrl_url,
         primary_section, primary_section_title, super_sector,
         primary_division, primary_division_title, sector_mapped_coverage, sector_shares,
         coverage_score, scorecard,
         parse_status, indicator_count
  from public.brsr_filings;

-- The products/turnover split, only for filings whose profile extracted cleanly.
create or replace view public.brsr_company_activities_public as
  select f.symbol, f.company_name, f.fy_from, f.fy_to,
         a.nic_code, a.product_name, a.turnover,
         a.division_code, a.section_letter, a.super_sector
  from public.brsr_company_activities a
  join public.brsr_filings f on f.id = a.filing_id
  where f.profile_status = 'extracted';

grant select on public.brsr_filings_public to anon, authenticated;
grant select on public.brsr_company_activities_public to anon, authenticated;
