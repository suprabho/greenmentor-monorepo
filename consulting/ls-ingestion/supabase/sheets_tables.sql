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

-- Column order mirrors the GreenMentor electricity bulk-upload template.
create table if not exists public.electricity_bills (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  bill_date date,
  period_from date,
  period_to date,
  facility text,
  electricity_source text,
  source_type text,
  transaction_type text,
  electricity_board text,
  units_kwh numeric,
  unit text,
  amount_paid numeric,
  currency text,
  ef_of_electricity numeric,
  evidence text,
  -- traceability (status doubles as the template "Status" column)
  bill_id text,
  file_hash text,
  status text,
  confidence numeric,
  raw jsonb
);

-- ── Migration: realign an existing electricity_bills table to the template above.
-- Idempotent — safe to re-run. New installs get the shape directly from create above.
alter table public.electricity_bills add column if not exists facility text;
alter table public.electricity_bills add column if not exists electricity_source text;
alter table public.electricity_bills add column if not exists source_type text;
alter table public.electricity_bills add column if not exists transaction_type text;
alter table public.electricity_bills add column if not exists electricity_board text;
alter table public.electricity_bills add column if not exists unit text;
alter table public.electricity_bills add column if not exists evidence text;
-- carry the old values across before dropping the renamed columns
update public.electricity_bills set electricity_board = discom           where electricity_board is null and discom           is not null;
update public.electricity_bills set facility          = site_combination where facility          is null and site_combination is not null;
-- drop columns no longer in the template
alter table public.electricity_bills drop column if exists discom;
alter table public.electricity_bills drop column if exists account_number;
alter table public.electricity_bills drop column if exists peak_units_kwh;
alter table public.electricity_bills drop column if exists offpeak_units_kwh;
alter table public.electricity_bills drop column if exists solar_export_kwh;
alter table public.electricity_bills drop column if exists sanctioned_load_kw;
alter table public.electricity_bills drop column if exists site_combination;

alter table public.fuel_bills enable row level security;
alter table public.electricity_bills enable row level security;

drop policy if exists fuel_anon_all on public.fuel_bills;
drop policy if exists elec_anon_all on public.electricity_bills;

create policy fuel_anon_all on public.fuel_bills
  for all to anon using (true) with check (true);
create policy elec_anon_all on public.electricity_bills
  for all to anon using (true) with check (true);
