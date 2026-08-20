-- brsr markets served — BRSR Section A Q20/21 extracted from the archived XBRL
-- by scrape-brsr.ts stage `profile` (deterministic; lib/brsr/xbrl.ts
-- extractMarketsServed): plant/office locations split national vs international,
-- the number of states/countries the entity serves, exports as a percentage of
-- turnover, and the free-text customer-types brief. Grounds the Market dimension
-- of the peer-research agent (packages/orchestrator/agents/peer-research) —
-- until a filing is re-profiled these stay null and the agent falls back to web
-- research for that company.
--
-- Written only by the scrape worker through the service-role client. All fields
-- come from public regulatory filings, so they publish through the
-- brsr_filings_public view like the 0017 profile columns.
--
-- Apply to the shared Supabase project via the SQL Editor or psql — after
-- 0017_brsr_company_profile.sql. Backfill with:
--   pnpm --filter @gm/platform brsr:scrape -- --stage=profile --reprofile

alter table public.brsr_filings
  -- Q20: number of locations where plants / offices are situated
  add column if not exists plants_national        int,
  add column if not exists offices_national       int,
  add column if not exists plants_international   int,
  add column if not exists offices_international  int,
  -- Q21a: markets served — locations
  add column if not exists states_served          int,
  add column if not exists countries_served       int,
  -- Q21b: contribution of exports as a percentage of total turnover (0..100 as filed)
  add column if not exists exports_pct_turnover   numeric,
  -- Q21c: a brief on types of customers (free text, capped at extract time)
  add column if not exists customer_types         text,
  -- field → XBRL local name that supplied it (audit trail for taxonomy drift)
  add column if not exists markets_matched_tags   jsonb;

-- Republish brsr_filings_public with the markets columns (drop first: adding
-- columns changes the view's output shape). Definer view, same as 0011/0017 —
-- reads past RLS to expose safe columns only.
drop view if exists public.brsr_filings_public;
create view public.brsr_filings_public as
  select id, symbol, company_name, legal_name, cin, contact_email, contact_phone, website,
         fy_from, fy_to, submission_date, revision_date, pdf_url, xbrl_url,
         primary_section, primary_section_title, super_sector,
         primary_division, primary_division_title, sector_mapped_coverage, sector_shares,
         coverage_score, scorecard,
         plants_national, offices_national, plants_international, offices_international,
         states_served, countries_served, exports_pct_turnover, customer_types,
         parse_status, indicator_count
  from public.brsr_filings;

grant select on public.brsr_filings_public to anon, authenticated;
