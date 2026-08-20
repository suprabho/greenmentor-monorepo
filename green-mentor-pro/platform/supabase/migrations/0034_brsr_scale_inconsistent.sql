-- brsr indicator scale: add the `inconsistent` verdict.
--
-- 0033 assumed the Rs 1 crore floor was the only trigger for doubting a turnover
-- fact. It has a blind spot: a unit error that leaves the value still above the
-- floor passes unexamined. DALBHARAT FY2021 filed 1.35e9 next to 1.47e11 in its
-- own other years — plausible on its own, impossible as the same company's
-- revenue two years earlier. 17 rows sit >= 1.5 dex below their company's median.
--
-- Eight of those snap tightly onto a real unit (all x1e2, residuals <= 0.065) and
-- are now recovered like any other rescale. The rest disagree with the series by
-- an amount no reporting convention explains, so they get `inconsistent`: a third
-- state meaning "plausible in isolation, contradicted by the company's own
-- filings, not corrected and not trusted". Consumers must treat it exactly like
-- unresolved — lib/brsr/scale.ts isUsable() returns false for both, and the scale
-- stage leaves value_normalized null — but keeping it distinct in the data says
-- WHY the value was withheld, which 'unresolved' (no signal at all) does not.
--
-- Note the asymmetry this encodes: reporting in lakh or crore only ever shrinks a
-- number, so a value LARGER than its own series cannot be a unit error and is
-- always flagged rather than scaled. SHAKTIPUMP and ANANDRATHI each have one
-- inflated year like that.
--
-- Apply via the SQL Editor or psql after 0033_brsr_indicator_scale.sql, then
-- re-run:  pnpm --filter @gm/platform brsr:scrape -- --stage=scale
-- The stage is idempotent, so re-running simply restamps every row.

alter table public.brsr_indicators
  drop constraint if exists brsr_indicators_scale_source_chk;
alter table public.brsr_indicators
  add constraint brsr_indicators_scale_source_chk
  check (scale_source is null or scale_source in
    ('as_filed', 'cross_tag', 'cross_year', 'both', 'unresolved', 'inconsistent'));

alter table public.brsr_indicators
  drop constraint if exists brsr_indicators_scale_confidence_chk;
alter table public.brsr_indicators
  add constraint brsr_indicators_scale_confidence_chk
  check (scale_confidence is null or scale_confidence in
    ('high', 'medium', 'unresolved', 'inconsistent'));
