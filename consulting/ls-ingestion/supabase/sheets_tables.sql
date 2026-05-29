-- ─────────────────────────────────────────────────────────────────────────────
-- Bill "sheets" tables for ls-ingestion. Run once in the Supabase SQL editor
-- (project grbrfpaznehikakupavx). Column order mirrors the bulk-upload templates;
-- the trailing meta columns (bill_id, file_hash, status, confidence, raw) give
-- traceability back to the extracted bill.
--
-- ⚠️ RLS below grants the anon role full read/write — acceptable for an internal
-- MVP. If this app is ever exposed publicly, replace with authenticated policies.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.fuel_bills (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  bill_date date,
  fuel_type text,
  use_type text,
  quantity numeric,
  unit text,
  amount_paid numeric,
  currency text,
  site_combination text,
  heat_content_of_fuel numeric,
  carbon_content_of_fuel numeric,
  ef_of_fuel numeric,
  -- traceability
  bill_id text,
  file_hash text,
  status text,
  confidence numeric,
  raw jsonb
);

create table if not exists public.electricity_bills (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  bill_date date,
  period_from date,
  period_to date,
  discom text,
  account_number text,
  units_kwh numeric,
  peak_units_kwh numeric,
  offpeak_units_kwh numeric,
  solar_export_kwh numeric,
  sanctioned_load_kw numeric,
  amount_paid numeric,
  currency text,
  site_combination text,
  ef_of_electricity numeric,
  -- traceability
  bill_id text,
  file_hash text,
  status text,
  confidence numeric,
  raw jsonb
);

alter table public.fuel_bills enable row level security;
alter table public.electricity_bills enable row level security;

drop policy if exists fuel_anon_all on public.fuel_bills;
drop policy if exists elec_anon_all on public.electricity_bills;

create policy fuel_anon_all on public.fuel_bills
  for all to anon using (true) with check (true);
create policy elec_anon_all on public.electricity_bills
  for all to anon using (true) with check (true);
