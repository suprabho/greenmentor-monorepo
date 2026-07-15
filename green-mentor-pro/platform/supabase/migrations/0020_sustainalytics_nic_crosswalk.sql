-- sustainalytics_subindustry_nic — curated crosswalk from each Sustainalytics
-- subindustry to a NIC-2008 Section + Division, so the Sustainalytics materiality
-- taxonomy (0019) can join our BRSR data, which is coded against NIC.
--
-- Populated by scripts/seed-sustainalytics-nic.ts from the curated map in
-- lib/sustainalytics/nic-crosswalk.ts (NIC titles resolved via lib/brsr/nic-sector.ts).
-- Not scraped — reviewable committed data; `confidence` flags the judgment calls.
--
-- Same conventions as 0019: RLS enabled with no policies (service-role writes),
-- read through the _public view. Apply after 0019_sustainalytics_mei.sql.

create table if not exists public.sustainalytics_subindustry_nic (
  subindustry_slug   text        primary key references public.sustainalytics_subindustries (slug) on delete cascade,
  nic_section        text        not null,   -- NIC Section letter (A–U)
  nic_section_title  text        not null,
  nic_division       text        not null,   -- NIC Division (2-digit)
  nic_division_title text        not null,
  confidence         text        not null check (confidence in ('high', 'medium', 'low')),
  seeded_at          timestamptz not null default now()
);

create index if not exists sustainalytics_subindustry_nic_section_idx
  on public.sustainalytics_subindustry_nic (nic_section);

alter table public.sustainalytics_subindustry_nic enable row level security;

-- Publish surface — SECURITY DEFINER view (Postgres default), with the
-- subindustry name joined in for convenience.
create or replace view public.sustainalytics_subindustry_nic_public as
  select x.subindustry_slug,
         s.name as subindustry_name,
         x.nic_section,
         x.nic_section_title,
         x.nic_division,
         x.nic_division_title,
         x.confidence
  from public.sustainalytics_subindustry_nic x
  join public.sustainalytics_subindustries s on s.slug = x.subindustry_slug;

grant select on public.sustainalytics_subindustry_nic_public to anon, authenticated;
