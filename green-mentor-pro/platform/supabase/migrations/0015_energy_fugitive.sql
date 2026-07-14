-- Fugitive emissions (Scope 1) — refrigerants & fire suppressants. Third Energy
-- data-entry domain, rebuilt from the legacy greenmentor-in-fe fugitive module.
-- Five estimation methods (screening, purchased gases, material balance,
-- simplified balance, fire suppression); each estimates a released mass of gas,
-- which × its GWP-100 gives CO2e. The GWP master is seeded (0016) with IPCC
-- AR5/AR6 values — the legacy computed GWP server-side and never shipped it.
--
-- Org-scoped + service-role writes + member-wide RLS, exactly like the fuel /
-- electricity tables (0013). Apply after 0014.

-- ── Masters ──────────────────────────────────────────────────────────────────
-- Gas × GWP source. One row per (gas, source); refrigerant_type / gas_type in the
-- forms pick a gas, then the "Database Source for GWP" picks which source's value.
create table if not exists public.energy_gas_gwp (
  id     uuid primary key default gen_random_uuid(),
  gas    text not null,           -- e.g. "R-134a (HFC-134a)", "CO2", "SF6"
  source text not null,           -- e.g. "IPCC AR5", "IPCC AR6"
  gwp    numeric not null,        -- GWP-100
  sort   int not null default 0,
  unique (gas, source)
);

-- Equipment types. category='refrigeration' rows carry a default annual leak
-- rate (fraction/yr) used by the screening method; category='fire_suppression'
-- rows (Fixed Systems / Portable Equipment) carry a default emission factor.
create table if not exists public.energy_equipment_types (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  category     text not null check (category in ('refrigeration', 'fire_suppression')),
  leak_rate    numeric,           -- default annual leak/emission fraction (0–1)
  min_capacity numeric,           -- kg, for the screening capacity slider
  max_capacity numeric,
  sort         int not null default 0,
  unique (name, category)
);

do $$
declare t text;
begin
  foreach t in array array['energy_gas_gwp','energy_equipment_types'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "read %1$s" on public.%1$I', t);
    execute format('create policy "read %1$s" on public.%1$I for select to authenticated using (true)', t);
  end loop;
end $$;

-- ── Entries ──────────────────────────────────────────────────────────────────
-- One table across all 5 methods. Method-specific numeric inputs live in `inputs`
-- (jsonb) for audit; the resolved gas/GWP, the derived released mass, and the
-- computed tCO2e are first-class columns for display and aggregation.
create table if not exists public.energy_fugitive_entries (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.esg_organizations(id) on delete cascade,
  user_id         uuid not null,
  site_id         uuid references public.energy_sites(id) on delete set null,
  method          int  not null check (method between 1 and 5),
  method_label    text,
  reporting_year  int,
  gas             text,                 -- refrigerant_type / gas_type
  database_source text,                 -- GWP source label
  gwp             numeric,              -- resolved GWP-100
  equipment_type  text,                 -- screening / fire-suppression equipment
  unit_name       text,
  inputs          jsonb not null default '{}'::jsonb,  -- raw method-specific fields
  released_kg     numeric,              -- estimated gas released (kg)
  tco2e           numeric,              -- released_kg × gwp ÷ 1000
  calc_formula    text,
  scope           int  not null default 1,
  evidence_paths  jsonb not null default '[]'::jsonb,
  status          text not null default 'Submitted'
                    check (status in ('Draft', 'Submitted', 'Accepted', 'Rejected')),
  comment         text,
  reviewed_by     uuid,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists energy_fugitive_entries_org_idx on public.energy_fugitive_entries (org_id, created_at desc);
create index if not exists energy_fugitive_entries_status_idx on public.energy_fugitive_entries (org_id, status);

drop trigger if exists energy_fugitive_entries_updated_at on public.energy_fugitive_entries;
create trigger energy_fugitive_entries_updated_at
  before update on public.energy_fugitive_entries
  for each row execute function public.energy_set_updated_at();

alter table public.energy_fugitive_entries enable row level security;
drop policy if exists "members manage energy_fugitive_entries" on public.energy_fugitive_entries;
create policy "members manage energy_fugitive_entries" on public.energy_fugitive_entries for all to authenticated
  using (public.esg_is_member(org_id)) with check (public.esg_is_member(org_id));
