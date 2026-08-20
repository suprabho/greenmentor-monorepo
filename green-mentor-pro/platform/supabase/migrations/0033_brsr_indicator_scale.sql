-- brsr indicator scale normalization — recovers turnover facts that filers
-- reported in Rs lakh or Rs crore while the XBRL declared unitRef="INR".
--
-- 432 of 4137 turnover rows sit below Rs 1 crore in rupee terms, which no
-- NSE-listed filer plausibly earns. Nothing in the markup disambiguates it:
-- unitRef is INR on every row, `decimals` is precision not scale, and XBRL 2.1
-- instances carry no `scale` attribute (that is Inline XBRL only). The BRSR Core
-- intensity ratios do not help either, because a filer divides by its OWN
-- denominator, so the ratio is co-scaled with the wrong unit.
--
-- scrape-brsr.ts stage `scale` (lib/brsr/scale.ts, deterministic) therefore
-- infers the multiplier from two corroborating signals — the Turnover vs
-- TotalRevenueOfTheCompany pair inside one filing, and the same company's
-- filings that are already plausible — and snaps to a real unit (1e2/1e5/1e7) or
-- refuses. value_numeric stays exactly as filed, matching the convention used
-- for brsr_company_activities.turnover and exports_pct_turnover; the derived
-- figure lands in value_normalized with its provenance beside it.
--
-- Consumers read value_normalized and must honour scale_confidence: 'unresolved'
-- means treat revenue as UNKNOWN, never as the filed number. A wrongly-scaled
-- revenue actively corrupts peer ranking (packages/orchestrator/src/peer
-- /scoring.ts revenueSimilarity scores order-of-magnitude distance, so a
-- lakh-denominated filer scores 0 against an identical-sized peer and drops out),
-- whereas a null revenue degrades gracefully — overallScore redistributes its
-- weight and the Peer-set card omits the figure.
--
-- Apply to the shared Supabase project via the SQL Editor or psql — after
-- 0011_brsr_filings.sql. Then populate, in this order:
--   pnpm --filter @gm/platform brsr:scrape -- --stage=indicators --reparse
--   pnpm --filter @gm/platform brsr:scrape -- --stage=scale
-- The reparse is required first: it adds the `total_revenue` indicator key that
-- supplies the cross-tag signal. Note the ordering dependency in both
-- directions — the indicators stage deletes and re-inserts a filing's rows, so
-- any future --reparse blanks these columns and `scale` must be re-run after it.

alter table public.brsr_indicators
  -- turnover in rupees: value_numeric * scale_multiplier. Null until the scale
  -- stage has run over the row.
  add column if not exists value_normalized numeric,
  -- 1 when as-filed or unresolved; otherwise 1e2 / 1e5 (lakh) / 1e7 (crore)
  add column if not exists scale_multiplier numeric,
  -- which signal decided: both = cross-tag and cross-year agreed
  add column if not exists scale_source     text,
  -- high = plausible as filed, or two signals agreeing; medium = one tight
  -- signal; unresolved = no trustworthy reading, so consumers must skip the value
  add column if not exists scale_confidence text;

alter table public.brsr_indicators
  drop constraint if exists brsr_indicators_scale_source_chk;
alter table public.brsr_indicators
  add constraint brsr_indicators_scale_source_chk
  check (scale_source is null or scale_source in
    ('as_filed', 'cross_tag', 'cross_year', 'both', 'unresolved'));

alter table public.brsr_indicators
  drop constraint if exists brsr_indicators_scale_confidence_chk;
alter table public.brsr_indicators
  add constraint brsr_indicators_scale_confidence_chk
  check (scale_confidence is null or scale_confidence in ('high', 'medium', 'unresolved'));

-- Lets the scale stage and any audit find the unresolved/rescaled rows without a
-- full scan; the table is small but this is the access pattern that matters.
create index if not exists brsr_indicators_scale_idx
  on public.brsr_indicators (indicator_key, scale_confidence);

-- Republish brsr_indicators_public with the normalized value (drop first: adding
-- columns changes the view's output shape). Deliberately a SECURITY DEFINER view
-- — Postgres default, do NOT set security_invoker — so it reads past the table's
-- RLS, same mechanism as 0011/0017/0032. scale_confidence travels with the value
-- so downstream readers can tell a recovered figure from an untrustworthy one.
drop view if exists public.brsr_indicators_public;
create view public.brsr_indicators_public as
  select f.symbol, f.company_name, f.fy_from, f.fy_to,
         i.indicator_key, i.value_numeric, i.unit,
         i.value_normalized, i.scale_multiplier, i.scale_source, i.scale_confidence,
         i.period_start, i.period_end, i.context_ref
  from public.brsr_indicators i
  join public.brsr_filings f on f.id = i.filing_id
  where f.parse_status = 'parsed';

grant select on public.brsr_indicators_public to anon, authenticated;
