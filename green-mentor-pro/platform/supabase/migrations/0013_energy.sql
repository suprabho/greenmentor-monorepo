-- Energy module (Scope 1 + 2) — the first native ESG data-entry surface, a
-- ground-up rebuild of the legacy greenmentor-in-fe Energy module (Fuel +
-- Electricity) on Supabase. Replaces the legacy React/Redux app that posted to
-- greenmentor-in-be; emission math now lives server-side in the platform
-- (lib/energy/calc.ts) grounded by the EFDB factor lookup (@gm/orchestrator).
--
-- Entries are org-scoped (esg_organizations / esg_is_member, same tenancy bridge
-- lib/tenancy.ts uses). All app writes go through the service-role admin client
-- (lib/supabase/admin.ts) — RLS below is the defensive layer, not the hot path —
-- so the read policy is member-wide (a checker must see peers' rows to approve).
--
-- Master tables are seeded reference data (0014_energy_seed.sql) and readable by
-- any authenticated user.
--
-- Apply to the shared Supabase project via the SQL Editor (privileged role) or
-- psql — both platform and community-engine point at it.

-- ── shared updated_at trigger fn (mirrors brsr_filings_set_updated_at, 0011) ──
create or replace function public.energy_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Master / reference tables (global; seeded in 0014). Authenticated read only.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.energy_fuel_types (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  source_type text not null default 'Non-Renewable'
                check (source_type in ('Renewable', 'Non-Renewable')),
  sort        int  not null default 0
);

create table if not exists public.energy_use_types (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique,   -- e.g. Stationary Combustion, Mobile Combustion
  sort int  not null default 0
);

create table if not exists public.energy_units (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique,   -- litres, kg, tonnes, m3, GJ, kWh, MWh
  kind text not null default 'both'
         check (kind in ('fuel', 'electricity', 'both')),
  sort int  not null default 0
);

create table if not exists public.energy_currencies (
  id   uuid primary key default gen_random_uuid(),
  code text not null unique,   -- INR, USD, EUR, …
  name text not null,
  sort int  not null default 0
);

create table if not exists public.energy_electricity_sources (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,   -- Grid, Solar, Wind, DG Set, …
  source_type text not null default 'Non-Renewable'
                check (source_type in ('Renewable', 'Non-Renewable')),
  sort        int  not null default 0
);

create table if not exists public.energy_transaction_types (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique,   -- Captive, Purchased
  sort int  not null default 0
);

create table if not exists public.energy_electricity_boards (
  id     uuid primary key default gen_random_uuid(),
  name   text not null unique,   -- DISCOM name
  region text,
  sort   int  not null default 0
);

-- Reference tables: enable RLS, allow read to all authenticated users (writes
-- happen via the privileged seed / service role only — no write policy).
do $$
declare t text;
begin
  foreach t in array array[
    'energy_fuel_types','energy_use_types','energy_units','energy_currencies',
    'energy_electricity_sources','energy_transaction_types','energy_electricity_boards'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "read %1$s" on public.%1$I', t);
    execute format('create policy "read %1$s" on public.%1$I for select to authenticated using (true)', t);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Facility hierarchy — org-scoped, 2 levels (Business Unit / Location).
-- Rebuild of the legacy BidirectionalHierarchyFilter's level_2 / level_3.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.energy_sites (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.esg_organizations(id) on delete cascade,
  user_id       uuid not null,
  business_unit text not null,
  location      text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (org_id, business_unit, location)
);
create index if not exists energy_sites_org_idx on public.energy_sites (org_id, business_unit, location);

-- ─────────────────────────────────────────────────────────────────────────────
-- Fuel entries (Scope 1)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.energy_fuel_entries (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.esg_organizations(id) on delete cascade,
  user_id         uuid not null,
  site_id         uuid references public.energy_sites(id) on delete set null,
  bill_date       date not null,
  fuel_type_id    uuid references public.energy_fuel_types(id),
  fuel_type_name  text,                 -- denormalized snapshot for display/analyze
  use_type_id     uuid references public.energy_use_types(id),
  use_type_name   text,
  source_type     text,                 -- Renewable / Non-Renewable (from fuel type)
  quantity        numeric not null,
  unit_id         uuid references public.energy_units(id),
  unit_name       text,
  amount_paid     numeric,
  currency_id     uuid references public.energy_currencies(id),
  currency_code   text,
  heat_content    numeric,              -- optional (kWh/unit)
  carbon_content  numeric,              -- optional
  manual_ef       numeric,              -- user-supplied EF override (ef_of_fuel)
  emission_factor numeric,              -- EF actually used (kg CO2e per unit)
  ef_source       text default 'none'
                    check (ef_source in ('manual', 'efdb', 'none')),
  ef_provenance   jsonb,                -- EFDB candidate detail when ef_source='efdb'
  tco2e           numeric,              -- computed emissions (tonnes CO2e)
  calc_formula    text,
  scope           int not null default 1,
  evidence_paths  jsonb not null default '[]'::jsonb,
  status          text not null default 'Submitted'
                    check (status in ('Draft', 'Submitted', 'Accepted', 'Rejected')),
  comment         text,                 -- reviewer feedback on reject
  reviewed_by     uuid,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists energy_fuel_entries_org_idx on public.energy_fuel_entries (org_id, bill_date desc);
create index if not exists energy_fuel_entries_status_idx on public.energy_fuel_entries (org_id, status);

drop trigger if exists energy_fuel_entries_updated_at on public.energy_fuel_entries;
create trigger energy_fuel_entries_updated_at
  before update on public.energy_fuel_entries
  for each row execute function public.energy_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Electricity entries (Scope 2)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.energy_electricity_entries (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references public.esg_organizations(id) on delete cascade,
  user_id                uuid not null,
  site_id                uuid references public.energy_sites(id) on delete set null,
  bill_date              date not null,
  bill_start             date,
  bill_end               date,
  electricity_source_id  uuid references public.energy_electricity_sources(id),
  electricity_source_name text,
  source_type            text,          -- Renewable / Non-Renewable
  transaction_type       text,          -- Captive / Purchased
  electricity_board      text,          -- DISCOM (free text; "Other" allowed)
  unit_used              numeric,       -- kWh consumed
  unit_id                uuid references public.energy_units(id),
  unit_name              text,
  solar_export_kwh       numeric,       -- netted out of Scope 2 in calc
  amount_paid            numeric,
  currency_id            uuid references public.energy_currencies(id),
  currency_code          text,
  manual_ef              numeric,       -- user-supplied EF override
  emission_factor        numeric,
  ef_source              text default 'none'
                           check (ef_source in ('manual', 'efdb', 'none')),
  ef_provenance          jsonb,
  tco2e                  numeric,
  calc_formula           text,
  scope                  int not null default 2,
  evidence_paths         jsonb not null default '[]'::jsonb,
  status                 text not null default 'Submitted'
                           check (status in ('Draft', 'Submitted', 'Accepted', 'Rejected')),
  comment                text,
  reviewed_by            uuid,
  reviewed_at            timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists energy_electricity_entries_org_idx on public.energy_electricity_entries (org_id, bill_date desc);
create index if not exists energy_electricity_entries_status_idx on public.energy_electricity_entries (org_id, status);

drop trigger if exists energy_electricity_entries_updated_at on public.energy_electricity_entries;
create trigger energy_electricity_entries_updated_at
  before update on public.energy_electricity_entries
  for each row execute function public.energy_set_updated_at();

-- ── RLS for org-scoped tables ──
-- Member-wide (not owner-only): a checker with admin/manager role must read a
-- peer's Submitted rows to approve/reject them. Writes go through the service
-- role, so this policy only backstops direct client reads.
alter table public.energy_sites enable row level security;
alter table public.energy_fuel_entries enable row level security;
alter table public.energy_electricity_entries enable row level security;

drop policy if exists "members manage energy_sites" on public.energy_sites;
create policy "members manage energy_sites" on public.energy_sites for all to authenticated
  using (public.esg_is_member(org_id)) with check (public.esg_is_member(org_id));

drop policy if exists "members manage energy_fuel_entries" on public.energy_fuel_entries;
create policy "members manage energy_fuel_entries" on public.energy_fuel_entries for all to authenticated
  using (public.esg_is_member(org_id)) with check (public.esg_is_member(org_id));

drop policy if exists "members manage energy_electricity_entries" on public.energy_electricity_entries;
create policy "members manage energy_electricity_entries" on public.energy_electricity_entries for all to authenticated
  using (public.esg_is_member(org_id)) with check (public.esg_is_member(org_id));

-- ── Private bucket for uploaded bills/evidence (accessed via service-role
--    signed URLs, like chat-uploads in 0004). ──
insert into storage.buckets (id, name, public)
values ('energy-uploads', 'energy-uploads', false)
on conflict (id) do nothing;
