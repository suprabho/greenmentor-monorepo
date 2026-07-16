-- sasb_industry_nic — curated crosswalk from each SASB SICS industry to a NIC-2008
-- Section + Division, so the SASB materiality taxonomy (0021) can join our BRSR
-- data, which is coded against NIC.
--
-- Populated by scripts/seed-sasb-nic.ts from the curated map in
-- lib/sasb/nic-crosswalk.ts (NIC titles resolved via lib/brsr/nic-sector.ts).
-- Not scraped — reviewable committed data; `confidence` flags the judgment calls.
--
-- Same conventions as 0021: RLS enabled with no policies (service-role writes),
-- read through the _public view. Apply after 0021_sasb_materiality.sql.

create table if not exists public.sasb_industry_nic (
  industry_code      text        primary key references public.sasb_industries (code) on delete cascade,
  nic_section        text        not null,   -- NIC Section letter (A–U)
  nic_section_title  text        not null,
  nic_division       text        not null,   -- NIC Division (2-digit)
  nic_division_title text        not null,
  confidence         text        not null check (confidence in ('high', 'medium', 'low')),
  seeded_at          timestamptz not null default now()
);

create index if not exists sasb_industry_nic_section_idx
  on public.sasb_industry_nic (nic_section);

alter table public.sasb_industry_nic enable row level security;

-- Publish surface — SECURITY DEFINER view (Postgres default), with the industry
-- name + sector joined in for convenience.
create or replace view public.sasb_industry_nic_public as
  select x.industry_code,
         i.name   as industry_name,
         i.sector as sector,
         x.nic_section,
         x.nic_section_title,
         x.nic_division,
         x.nic_division_title,
         x.confidence
  from public.sasb_industry_nic x
  join public.sasb_industries i on i.code = x.industry_code;

grant select on public.sasb_industry_nic_public to anon, authenticated;
